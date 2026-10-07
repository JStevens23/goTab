# goTab

Save sites with custom keywords and open them from Chrome's address bar. Add sites in the extension popup; browse, search, and remove them in **Saved sites**.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the project folder.

## Setup and sync

1. Open **View saved sites** from the popup.
2. Choose a passphrase of at least 16 characters and select **Enable encrypted sync**. Existing shortcuts are migrated automatically.
3. On other machines, use the same Chrome account and extension ID with extension sync enabled. Wait for the vault to sync, then unlock it with the same passphrase.

Unlock once per device. It stays unlocked across browser restarts and extension reloads until you uninstall the extension or select **Forget this device**.

Unpacked installations can have different extension IDs. Automatic sync requires matching IDs; development installations can use the same manifest public `key`. Export a backup before changing an existing installation's ID.

## Usage

- Add a keyword and an `https://` or `http://` URL in the popup. Internal addresses such as `http://intranet` and `http://localhost:8080` are supported.
- Type `go`, press Tab, enter the keyword, and press Enter.
- Search and remove shortcuts in **Saved sites**. Unknown keywords open the library.
- Duplicate keywords are rejected. Remove the existing shortcut before replacing its destination.

The library supports up to 500 sites within Chrome's 100 KB sync limit. URL length and encryption overhead affect capacity; the storage meter shows current usage.

## Backups

- **Encrypted backup** exports your library as JSON.
- **Import sites** accepts encrypted backups and legacy keyword-to-URL JSON files up to 1 MB. Existing keywords are preserved.
- When importing a backup from another vault, enter that backup's passphrase.

## Storage

Keywords and URLs are encrypted before syncing or exporting. The unlock key is saved locally on each device, never synced; access to the local browser profile can expose the library. Passphrases are not stored.

No analytics or external backend. Only the `storage` permission is required.

## License

[MIT](./LICENSE)
