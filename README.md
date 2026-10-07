# goTab

Navigate to your saved sites using personal keywords in Chrome's address bar. Add sites in the extension popup; browse, search, and remove them in a separate Saved sites tab.

## Set up encrypted sync

1. Load the extension in Chrome 102 or later, then open **View saved sites** from the popup.
2. On your first machine, choose a unique passphrase of at least 16 characters (several randomly chosen words are better). Save it in your password manager and select **Enable encrypted sync**. There is no passphrase recovery service.
3. Existing local shortcuts are encrypted before being written to Chrome Sync. The old local copy is removed only after a successful write. Nothing is uploaded before setup.
4. On another machine, install **the same extension ID**, sign in to the same Chrome account, and enable extension-data syncing. Wait for **Your library is locked**, then enter the same passphrase. Do not create a second vault while waiting for sync.
5. Unlock once per browser session. **Lock library**, a full browser exit, or reloading/disabling the extension removes the session key. Closing one window may leave Chrome running; use **Lock library** when needed.

Chrome stores sync data locally while offline and delivers changes when sync is available. goTab cannot determine whether Chrome Sync is enabled or whether another device has received a change. “Saved” means Chrome accepted the local sync-storage write, not that remote delivery has completed.

### Development installations and extension identity

- Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this folder.
- Unpacked extension IDs can differ between machines because their paths differ. Check the IDs before expecting automatic sync. A store-distributed installation has a stable ID; development distributions need the same manifest public `key` on each machine.
- This update deliberately does not change your manifest identity: doing so could strand your current extension's storage. Before changing an existing installation's ID, create an encrypted backup. Restore that backup into the new installation with the old vault passphrase.
- Do not include private signing keys in the extension. The manifest `key`, when used, is a public key.

## Everyday use

1. Unlock your library in **Saved sites**.
2. Open the popup, enter a keyword and an `https://` URL, then select **Add site**. HTTP is supported for compatibility, but does not secure traffic to the destination. URLs containing embedded usernames/passwords are rejected.
3. Type `go`, press Tab, enter your keyword, and press Enter. A locked library or an unknown keyword opens Saved sites instead of sending the keyword to a search engine.
4. Search or remove sites in the library. Duplicate additions are rejected; remove the old shortcut before replacing its destination.

The storage meter shows encrypted storage usage, including encryption overhead. The application allows up to 500 sites, subject to Chrome's 100 KB total and 8 KB per-item quotas. Longer URLs reduce capacity. Failed writes are shown as errors; they are not reported as successful saves. There is no automatic retry loop that could exhaust Chrome's write-rate quota.

## Backups and imports

- **Encrypted backup** downloads JSON containing encrypted records. Keywords and URLs are not exported in plaintext. Keep the passphrase that was used for that backup.
- **Import sites** accepts these backups and legacy keyword-to-URL JSON files (maximum 1 MB). Imports preserve existing keyword destinations and report how many entries were skipped.
- For a backup from another vault, enter that backup's passphrase. Records are decrypted locally, validated, and re-encrypted into the current vault. To restore after a reinstall, set up a new empty vault, then import the backup with its original passphrase.
- Legacy JSON files are plaintext. Existing plaintext backups are not retroactively protected by this update.
- During migration from another machine's local storage, conflicting local keywords are preserved under names such as `mail-local-1`; synced destinations are retained. If migration fails, the local data remains and the library shows a warning. Unlock again to retry after fixing the cause.

## Privacy and security

- Keywords and URLs are encrypted with AES-256-GCM **before** they enter persistent sync storage or backups. Passphrases are never saved. Chrome receives ciphertext, public cryptographic parameters, and metadata such as record counts and sizes.
- Unlock material is held in `chrome.storage.session`, restricted to trusted extension contexts. Decrypted sites exist in memory while unlocked. Existing local plaintext remains until migration succeeds; deletion is not a guarantee of forensic erasure from disks, system backups, or browser internals.
- No analytics, remote scripts, content scripts, host permissions, or custom backend. Only the `storage` permission is requested. A restrictive Content Security Policy prevents network fetches and inline/evaluated script execution by extension pages.
- Visiting a site still discloses its address to the browser and destination. Do not put passwords or access tokens in shortcut URLs. Encryption cannot protect an unlocked browser against malware, compromised extension code, or someone controlling your device.
- Separate machines can edit concurrently. Different keywords use separate records. Concurrent changes to the **same** keyword follow Chrome's sync conflict resolution; goTab is not a collaborative database. Back up before major changes. Set up the vault on only one machine initially.

See [security design and limitations](./SECURITY.md) for the threat model and verification details.

## Validation

Open [the browser regression suite](./tests/vault.html) in a modern browser. It exercises the actual cryptographic implementation with simulated Chrome storage; it never touches the installed extension's data. The suite covers migration, authentication, tampering, quotas, unsafe input, backup restore, session locking, and a simulated second device.

Open [the worker regression suite](./tests/worker.html) to test message authorization and omnibox navigation with simulated browser APIs. The UI and service-worker behavior also require a loaded-extension smoke test. Real cross-machine delivery requires two Chrome profiles using the same extension ID and Chrome account; mocks cannot verify Google's sync transport.

## License

[MIT](./LICENSE)
