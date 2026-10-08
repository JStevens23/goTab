# goTab

Save sites with custom keywords and open them from Chrome's address bar. Add sites in the extension popup; browse, search, and remove them in **Saved sites**.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the project folder.

## Setup and sync

1. Open the goTab popup and choose **Create a new library** if you are new, or **Connect an existing library** on another machine.
2. For a new library, create a passphrase of at least 8 characters, then add your first site directly in the popup. Existing local shortcuts are migrated automatically.
3. To connect an existing library, use the same Chrome account and extension ID with extension sync enabled. When the library arrives, unlock it in the popup with your existing passphrase. No new passphrase is needed.

Unlock once per device. It stays unlocked across browser restarts and extension reloads until you uninstall the extension or select **Forget this device**.

Unpacked installations can have different extension IDs. Automatic sync requires matching IDs; development installations can use the same manifest public `key`. Export a backup before changing an existing installation's ID.

## Usage

- Add a keyword and an `https://` or `http://` URL in the popup. Internal addresses such as `http://intranet` and `http://localhost:8080` are supported.
- Type `go`, press Tab, enter the keyword, and press Enter.
- Search and remove shortcuts in **Saved sites**. Unknown keywords open the library.
- Select **Edit** next to a site to update its URL inline, then **Save** or **Cancel**. Duplicate keywords are rejected.

The library supports up to 500 sites within Chrome's 100 KB sync limit. URL length and encryption overhead affect capacity; the storage meter shows current usage.

Use **Change passphrase** in Saved sites to choose a new passphrase. Enter the current passphrase and confirm the new one. Other devices need the new passphrase after syncing; existing backups keep their original passphrase.

## Backups

- **Export to JSON** exports your library as JSON.
- **Import sites** accepts encrypted backups and legacy keyword-to-URL JSON files up to 1 MB. Existing keywords are preserved.
- When importing a backup from another vault or an earlier passphrase, enter that backup's passphrase.

## Storage

Keywords and URLs are encrypted before syncing or exporting. The unlock key is saved locally on each device, never synced; access to the local browser profile can expose the library. Passphrases are not stored.

No analytics or external backend. Only the `storage` permission is required.

## License

[MIT](./LICENSE)
