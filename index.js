const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const js2xmlparser = require("js2xmlparser");
const { pipeline } = require('stream/promises');
const XmlStream = require('xml-stream');
const { Readable } = require('stream');

const MEDIAFLUX_URL = '';
const USERNAME = '';
const PASSWORD = '';
const DOMAIN = '';
const BASE_NAMESPACE = '';
const LOCAL_BASE_PATH = path.join(__dirname, 'downloaded_assets');
const parser = new xml2js.Parser();

async function authenticate() {
    const payload = {
        "@": { name: 'system.logon' },
        args: {
            domain: DOMAIN,
            user: USERNAME,
            password: PASSWORD
        }
    };

    const root = {
        service: payload
    };

    const xmlPayload = js2xmlparser.parse("request", root);

    const response = await fetch(`${MEDIAFLUX_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xmlPayload
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    const sessionKey = await parseSessionKey(responseText);
    return sessionKey;
}

async function parseSessionKey(xmlResponse) {
    const json = await parser.parseStringPromise(xmlResponse);
    const sessionKey = json.response.reply[0].result[0].session[0]._;
    return sessionKey;
}

async function queryMediaflux(options, sessionKey, logAll = false) {
    const payload = {
        service: {
            "@": {
                name: options.service,
                session: sessionKey
            },
            ...(options.args && { args: options.args })
        }
    };

    const xmlPayload = js2xmlparser.parse("request", payload);

    const response = await fetch(options.uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xmlPayload
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Manually collect chunks and convert to buffer
    const chunks = [];
    const reader = response.body.getReader();
    let done, value;
    while (!done) {
        ({ done, value } = await reader.read());
        if (value) {
            chunks.push(value);
        }
    }
    const responseBodyBuffer = Buffer.concat(chunks);
    let wholeXmlString = '';
    // Create a readable stream from the buffer
    const readableStream = new Readable();
    readableStream.push(responseBodyBuffer);
    readableStream.push(null); // Signals the end of the stream (EOF)

    // Use xml-stream to parse the readable stream
    const xmlStream = new XmlStream(readableStream);
    xmlStream.preserve('asset', true)
    // Initialize your storage for parsed data
    const assets = [];
    const directories = [];

    if (logAll) {
        xmlStream.on('data', function(chunk) {
            wholeXmlString += chunk.toString();
        });
    }
    

    // Listen for XML elements of interest. Adjust these to your needs.
    xmlStream.on('endElement: asset', function(item) {
        
        assets.push(item);

        try {
            const assetJsonFilePath = path.join(LOCAL_BASE_PATH, 'json', `${item.path.$text.replace(' ', '-')}.asset-element` + '.json');
            const dirname = path.dirname(assetJsonFilePath);

            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
            }
            
            fs.writeFileSync(assetJsonFilePath, JSON.stringify(item), { flag: 'w' });

        } catch(e) {
        }

    });
    xmlStream.on('endElement: directory', function(item) {
        directories.push(item);
    });

    // Wait for the stream to end
    await new Promise((resolve, reject) => {
        xmlStream.on('end', resolve);
        xmlStream.on('error', reject);
    });


    // Return the parsed data
    return { assets, directories, xml: wholeXmlString };
}

async function queryNamespace(namespace, sessionKey) {
    const pageSize = 10000;
    let sizeFetched = 0;
    const totalSize = 10000;
    const assets = []; 
    const directories = []; 
    let pageNumber = 1;
    while (sizeFetched < totalSize) {
        const options = {
            service: 'asset.query',
            args: {
                where: `namespace>='${namespace}'`,
                action: 'get-meta',
                size: pageSize.toString(),
                idx: pageNumber
            },
            uri: `${MEDIAFLUX_URL}`
        };

        const response = await queryMediaflux(options, sessionKey);
        assets.push(...response.assets);
        directories.push(...response.directories);

        sizeFetched += pageSize;
        pageNumber++;
    }

    return { assets, directories };
}


async function downloadAssetContent(assetId, assetPath, sessionKey) {
    

    let contentResponse;
    try {
        // Fetch content
        const contentOptions = {
            service: 'asset.get',
            args: {
                id: assetId,
            },
            uri: `${MEDIAFLUX_URL}`
        };
        contentResponse = await queryMediaflux(contentOptions, sessionKey, true);
    } catch (e) {
        // Fetch content
        const contentOptions = {
            service: 'asset.get',
            args: {
                id: assetId,
                view: 'content'
            },
            uri: `${MEDIAFLUX_URL}`
        };
        
        try {
            contentResponse = await queryMediaflux(contentOptions, sessionKey, true);

        } catch (e) {
            return ;
        }
    }
     
    const dirname = path.dirname(assetPath);

    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
    fs.writeFileSync(`${assetPath}-${assetId}.content.xml`, contentResponse.xml, { flag: 'w' }); 

    contentResponse?.assets[0]?.$children.forEach((child) => {
        if (child?.$?.id) {
            downloadAssetContent(child.$.id, path.join(LOCAL_BASE_PATH, child.$text  || child.$name), sessionKey)
        }
    });

    // Fetch metadata (if separate from content)

    let metaResponse;
    try {
        const contentOptions = {
            service: 'asset.get',
            args: {
                id: assetId,
            },
            uri: `${MEDIAFLUX_URL}`
        };
        metaResponse = await queryMediaflux(contentOptions, sessionKey, true);
    } catch (e) {
        // Fetch content
        const contentOptions = {
            service: 'asset.get',
            args: {
                id: assetId,
                view: 'content'
            },
            uri: `${MEDIAFLUX_URL}`
        };
        try {

            metaResponse = await queryMediaflux(contentOptions, sessionKey, true);
        } catch (e) {
            return
        }
    }

    fs.writeFileSync(`${assetPath}.meta.xml`, metaResponse.xml, { flag: 'w' });
    metaResponse?.assets[0]?.$children.forEach((child) => {
        if (child?.$?.id) {
            downloadAssetContent(child.$.id, path.join(LOCAL_BASE_PATH, child.$text || child.$name), sessionKey)
        }
    });

}

async function processNamespace(namespace, localPath, sessionKey) {
    fs.mkdirSync(localPath, { recursive: true });

    const { assets, directories } = await queryNamespace(namespace, sessionKey);

    for (const asset of assets) {
        if (!asset.path) {
            return
        }
        const assetLocalPath = path.join(localPath, (asset.path.$text || asset.path.$name).replace(' ', '-'));
        await downloadAssetContent(asset.$.id, assetLocalPath, sessionKey);
    }

    for (const directory of directories) {
        const newNamespace = `${namespace}/${directory.name}`;
        const newLocalPath = path.join(localPath, directory.name);
        await processNamespace(newNamespace, newLocalPath, sessionKey);
    }
}



async function main() {
    try {
        const sessionKey = await authenticate();

        // Uncomment if you want to download all namespaces
        // const namespaces = await listNamespaces(sessionKey);
        // for (const namespace of namespaces) {
        //     const localPath = path.join(LOCAL_BASE_PATH, namespace._);
        //     await processNamespace(namespace._, localPath, sessionKey);
        // }

        // this will just download the base namespace
        const localPath = path.join(LOCAL_BASE_PATH, BASE_NAMESPACE);
        await processNamespace(BASE_NAMESPACE, localPath, sessionKey);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main().then(() => console.log('done'));
