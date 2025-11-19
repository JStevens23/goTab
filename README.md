# goTab

A Chrome extension that lets you navigate to URLs using custom keywords directly from your browser's omnibox.

## Features

- Set personal keyword to URL mappings
- Use the "go" keyword in the omnibox (`go <keyword>`) to jump to your saved destinations
- Manage shortcuts via the extension's popup UI
- **Export your keyword mappings** to JSON files for backup or sharing
- **Import keyword mappings** from JSON files to restore or sync across devices
- Defaults to a Google search if a keyword isn't mapped

## How It Works

1. Click the extension icon to open the popup.
2. Add, edit, or remove keyword-URL pairs.
3. In the omnibox, type `go <keyword>` and hit Enter to jump to the mapped URL, or search Google if the keyword isn't found.
4. Use the **Export** button to download your mappings as a timestamped JSON file.
5. Use the **Import** button to restore mappings from a previously exported JSON file.

## Installation

- Download or clone this repository.
- Go to `chrome://extensions` in Chrome.
- Enable "Developer mode".
- Click "Load unpacked" and select this project folder.

## Usage Examples

### Adding a Keyword
1. Open the extension popup
2. Enter a keyword (e.g., "mail")
3. Enter the URL (e.g., "https://mail.proton.me/u/0/in")
4. Click "Add Keyword"

### Using a Keyword
- Type `go mail` in the omnibox and press Enter to navigate directly to your email

### Backing Up Your Mappings
- Click the "Export" button to download a JSON file containing all your keywords
- The file will be named with a timestamp (e.g., `goTab-mappings-2025-11-18T22-15-00.json`)

### Restoring or Syncing Mappings
- Click the "Import" button and select a previously exported JSON file
- Imported mappings will merge with existing ones (duplicates will be overwritten)

## Permissions

- `storage`: Saves your keyword-URL mappings locally.

## Privacy

- No personal data leaves your device.
- No analytics, tracking, or remote storage.
- Data is stored locally and fully under your control.
- Export files are generated and saved locally on your machine.

## License

[MIT](./LICENSE)
