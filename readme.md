# Mediaflux Asset Downloader

This project is a Node.js script designed to interact with a Mediaflux server. It authenticates with the server, fetches assets and directories metadata, and downloads content, organizing it into a local file structure that mirrors the one in Mediaflux. The assets and their metadata are saved locally as JSON and XML files.

## Features

- **Authentication:** Logs into a Mediaflux server using credentials.
- **Data Fetching:** Retrieves assets and directory information from the Mediaflux server.
- **Content Downloading:** Downloads the content of assets from Mediaflux.
- **Local File Organization:** Saves assets and their metadata in a structured local directory, mirroring the structure from Mediaflux.
- **Error Handling:** Gracefully handles errors during fetching and saving, ensuring the process doesn't break midway.

## How to Use

1. **Setup:**
   - Ensure you have Node.js installed on your machine.
   - Clone the repository:
     ```
     git clone git@github.com:Jordan-Hall/mediaflux-download-everything.git
     ```
   - Navigate into the project directory:
     ```
     cd mediaflux-download-everything
     ```
   - Install dependencies:
     ```
     npm install
     ```

2. **Configuration:**
   - Open the script file and fill in your Mediaflux server details:
     - `MEDIAFLUX_URL`: URL of your Mediaflux server.
     - `USERNAME`: Your username for the Mediaflux server.
     - `PASSWORD`: Your password for the Mediaflux server.
     - `DOMAIN`: The domain for your Mediaflux account.
     - `BASE_NAMESPACE`: The base namespace from where you want to start the download.
   - Ensure the `LOCAL_BASE_PATH` is set correctly. It defines where the downloaded files will be saved on your local machine.

3. **Execution:**
   - Run the script:
     ```
     npm start
     ```
   - The script will authenticate with the Mediaflux server, fetch assets and directories, download their content, and save everything locally. The console will log the progress.

4. **Choosing Download Scope:**
   - By default, the script is set to download assets from the `BASE_NAMESPACE`.
   - If you want to download assets from all available namespaces, you need to uncomment certain lines in the script:
     - Locate the following lines in the `main` function:
        ```javascript
        // Uncomment if you want to download all namespaces
        // const namespaces = await listNamespaces(sessionKey);
        // for (const namespace of namespaces) {
        //     const localPath = path.join(LOCAL_BASE_PATH, namespace._);
        //     await processNamespace(namespace._, localPath, sessionKey);
        // }
        ```
     - Remove the comment slashes (`//`) to enable the code block. This will make the script fetch and download assets from all namespaces.
     - If you choose to download all namespaces, ensure your machine has sufficient storage, as this can significantly increase the amount of data downloaded.

   - If you wish to download assets only from the `BASE_NAMESPACE`, ensure the above lines remain commented, and the following line is uncommented:
     ```javascript
     const localPath = path.join(LOCAL_BASE_PATH, BASE_NAMESPACE);
     await processNamespace(BASE_NAMESPACE, localPath, sessionKey);
     ```

Ensure you make the right choice based on your needs and the storage capabilities of your machine. The option to download all namespaces should be used cautiously, especially in large Mediaflux instances.
## Note on Large Mediaflux Instances

For large Mediaflux instances with a significant number of assets, the script may take a long time to complete. It's designed to run as a long-running process, ensuring all assets are fetched and downloaded methodically. Make sure your machine has enough storage and remains connected to the internet during the process.

## Error Handling

The script includes basic error handling, ensuring that it doesn't stop abruptly on encountering an issue. It logs all errors to the console. For a more detailed analysis or debugging, the 'ndb' package is included for Node.js debugging.

For any issues or questions, feel free to open an issue in the GitHub repository.