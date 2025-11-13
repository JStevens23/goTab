# goTab

A Chrome extension that lets you navigate to URLs using custom keywords directly from your browser’s omnibox.

## Features

- Set personal keyword-to-URL mappings
- Use the "go" keyword in the omnibox (`go <keyword>`) to jump to your saved destinations
- Manage shortcuts via the extension’s popup UI
- Defaults to a Google search if a keyword isn’t mapped

## How It Works

1. Click the extension icon to open the popup.
2. Add, edit, or remove keyword-URL pairs.
3. In the omnibox, type `go <keyword>` and hit Enter to jump to the mapped URL, or search Google if the keyword isn’t found.

## Installation

- Download or clone this repository.
- Go to `chrome://extensions` in Chrome.
- Enable "Developer mode".
- Click "Load unpacked" and select this project folder.

## Permissions

- `storage`: Saves your keyword-URL mappings locally.
- `tabs`: Used for navigation based on mappings.

## Privacy

- No personal data leaves your device.
- No analytics, tracking, or remote storage.
- Data is stored locally and fully under your control.

## License

[MIT](./LICENSE)
