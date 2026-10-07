# Security design

## Scope and threat model

The goal is to prevent saved keywords and URLs from being readable in Chrome Sync storage or exported backups without the user's passphrase, and to prevent untrusted data from becoming executable HTML or a dangerous navigation target. This is not a claim that the extension is unexploitable or independently audited.

Trusted: the installed extension code, Chrome, the operating system, and the device while unlocked. Untrusted: imported files, synced records, stored legacy data, website content, and message senders. Network destinations selected by the user are outside the vault's confidentiality boundary.

The device stores the decryption key alongside locally cached ciphertext. Local browser-profile access is sufficient to decrypt the library; encryption protects synced data and backups, not this device’s storage. No confidentiality guarantee is made against malware, a compromised browser/extension update, OS memory inspection, shoulder surfing, browser history, weak/compromised passphrases, or user-created plaintext files. Record counts, ciphertext sizes, update timing, salt, and stable opaque record IDs are visible. Authenticated encryption detects modified/reassigned records, but cannot detect deletion or replay of an older valid record by an actor controlling storage.

## Cryptography

- Web Crypto PBKDF2-HMAC-SHA-256, 600,000 iterations, random 128-bit per-vault salt, derives 512 bits. For new vaults, the derived AES key wraps random data keys; a separate random HMAC key identifies records. Original vaults with directly derived data keys remain supported and are upgraded on passphrase change.
- Passphrase changes replace all encrypted records and metadata in one local sync-storage write, after quota and concurrent-change checks. Other devices must unlock again when the change arrives. Chrome does not deliver a multi-item update atomically across devices: pause edits on other devices during rotation and retain a backup.
- AES-256-GCM with fresh random 96-bit IVs and 128-bit authentication tags for every record encryption. AAD binds the format version, vault salt, and record ID. No hand-written encryption primitives.
- HMAC-SHA-256 of the normalized keyword provides an opaque record ID when a site is added. Existing record IDs are retained across key rotation and authenticated through GCM AAD. An unkeyed hash would expose common keywords to dictionary guessing.
- A known encrypted check value authenticates a passphrase. All records are authenticated and validated before unlocking. The passphrase is sent only to the extension's own worker, never stored or logged. Derived material is saved in trusted `storage.local` on each device and is never synced or exported. Unlock survives browser restarts, extension reloads, and disable/re-enable. Uninstalling the extension or selecting **Forget this device** removes the saved key. Existing session-only keys are migrated automatically when available.
- Password input fields are cleared when submitted. Forgetting this device removes the saved unlock key and clears decrypted library content in open extension pages. JavaScript cannot promise immediate or forensic zeroization of garbage-collected strings and buffers.

The 8-character minimum is an input floor, not an entropy guarantee. A long random passphrase and a password manager are recommended. There is no password reset or key escrow. Changing the passphrase requires the current passphrase. It rotates both the AES and HMAC keys and re-encrypts the library while preserving opaque record IDs. Existing exported backups retain their original passphrase.

## Trust boundaries

- The worker accepts requests only from this extension's exact popup and library URLs and matching extension ID. No externally connectable endpoint or content script is declared.
- All local, sync, and session storage areas are restricted to `TRUSTED_CONTEXTS` before data access. Mutations go through a single worker queue on each device.
- Stored/decrypted/imported destinations are restricted to HTTP(S), a hostname, no embedded credentials, no literal whitespace/control characters, and at most 2,048 characters. Keywords are normalized, bounded, and reject control and directional-override characters.
- Records use own-property checks and null-prototype dictionaries where arbitrary keywords become keys. Imported data is validated as a whole before writes. Imports skip existing keywords rather than overwrite them.
- UI uses DOM creation and `textContent`; it never inserts saved data through HTML parsing. External links use `noopener noreferrer`. Unknown omnibox input is not sent to an external search engine.
- CSP permits only packaged scripts, styles, and images, blocks connections, frames/objects, form navigation, and base URL changes. No remote dependencies, host permissions, or privileged message endpoints for web pages.

## Persistence and failure behavior

Setup is opt-in. Migration encrypts existing local data, checks quotas, writes ciphertext, then removes the old plaintext copy. Failed encryption/validation/writes leave local data intact. Failed migration on unlock leaves the vault usable and shows a warning. Historical copies in browser backups or on disk cannot be securely erased by the extension.

Each site occupies a separate sync item. Quotas are conservatively checked before writes; Chrome remains authoritative for actual quota and rate-limit enforcement. The saved key salt must match the synced vault before use. A different or damaged vault fails closed instead of falling back to plaintext or Google search.

Same-device mutations are serialized. Cross-device synchronization is eventually consistent, with no transaction or compare-and-swap API. Concurrent same-keyword edits, deletes versus stale edits, or simultaneous initial vault creation cannot be made atomic with this API. Initial setup must happen on one machine, with others waiting for its metadata. Independent vault creation is rejected when existing data is visible, but cannot detect an offline remote vault. Authentication failures are shown without overwriting the affected data. Keep encrypted backups.

The same extension ID and Chrome account with extension sync enabled are required across devices. The app does not claim that a successful local write confirms cloud delivery.

## Verification

[Regression suite](./tests/vault.html): real Web Crypto with in-memory Chrome-storage doubles. Covers locked reads/writes, migration success and failed writes, trusted storage access, keyword normalization/prototype names, unsafe URL rejection, duplicate preservation, concurrent local adds, all-or-nothing import validation, ciphertext/AAD tampering, wrong passwords, persistent-key removal and restart persistence, cross-device decrypt simulation, encrypted exports/restore, and quota checks.

Browser UI verification uses simulated extension APIs. This does not validate the Chrome service-worker lifecycle, enforcement of the manifest CSP, or actual cross-machine sync. Before release, load the extension in Chrome and verify setup, browser restart, worker suspension, popup add, omnibox navigation (including background-tab disposition), import/export, lock propagation across tabs, quota failure, offline changes, and two-device delivery. This change is not an external security audit.

## References

- [Chrome storage API and quotas](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome extension security guidance](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)
- [Chrome extension CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [OWASP password derivation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Web Crypto AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
