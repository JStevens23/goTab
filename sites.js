'use strict';

let mappings = {};
let state = null;
let revision = 0;
let busy = false;
const list = document.getElementById('mappingList');
const search = document.getElementById('search');
const vaultForm = document.getElementById('vaultForm');
const importDialog = document.getElementById('importDialog');

function renderMappings() {
  const query = search.value.trim().toLowerCase();
  const entries = Object.entries(mappings).sort(([a], [b]) => a.localeCompare(b));
  const filtered = entries.filter(([keyword, url]) => `${keyword} ${url}`.toLowerCase().includes(query));
  document.getElementById('siteCount').textContent = query ? `${filtered.length} of ${entries.length} sites` : `${entries.length} saved ${entries.length === 1 ? 'site' : 'sites'}`;
  list.replaceChildren();
  for (const [keyword, url] of filtered) {
    const item = document.createElement('li');
    item.className = 'site-item';
    const info = document.createElement('div');
    info.className = 'site-info';
    const title = document.createElement('p');
    title.className = 'keyword';
    title.textContent = keyword;
    const link = document.createElement('a');
    link.className = 'site-url';
    link.textContent = url;
    if (isValidUrl(url)) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${keyword}`);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await vaultRequest('remove', { keyword });
        await refresh();
        search.focus();
        showStatus('Site removed.');
      } catch (error) { remove.disabled = false; showStatus(error.message, true); }
    });
    info.append(title, link);
    item.append(info, remove);
    list.append(item);
  }
  document.getElementById('emptyState').hidden = filtered.length > 0;
  document.getElementById('emptyTitle').textContent = entries.length ? 'No matching sites' : 'Your shortcuts start here';
  document.getElementById('emptyText').textContent = entries.length ? 'Try another keyword or part of a URL.' : 'Open the goTab extension popup to add your first site, or import a backup.';
}

function clearLibrary() {
  mappings = {};
  list.replaceChildren();
  search.value = '';
  document.getElementById('libraryPanel').hidden = true;
  document.getElementById('siteCount').textContent = 'Locked';
  if (importDialog.open) importDialog.close();
}

async function refresh() {
  const request = ++revision;
  try {
    const next = await vaultRequest('state');
    if (request !== revision) return;
    state = next;
    document.getElementById('vaultTitle').textContent = state.unlocked ? 'Encrypted sync · unlocked' : state.configured ? 'Your library is locked' : 'Protect your shortcuts';
    document.getElementById('vaultDescription').textContent = state.unlocked
      ? 'Keywords and URLs are encrypted before storage. This device stays unlocked across browser restarts. Forget this device to remove its saved unlock key.'
      : state.configured ? 'Enter your vault passphrase to use your sites on this machine.' : 'Set up a passphrase to encrypt your library before it is stored in Chrome Sync. Your passphrase is never saved or synced.';
    vaultForm.hidden = state.unlocked;
    document.getElementById('lockBtn').hidden = !state.unlocked;
    document.getElementById('confirmGroup').hidden = state.configured;
    document.getElementById('confirmation').required = !state.configured;
    document.getElementById('passphrase').autocomplete = state.configured ? 'current-password' : 'new-password';
    document.getElementById('setupNotice').hidden = state.configured;
    document.getElementById('unlockBtn').textContent = state.configured ? 'Unlock library' : 'Enable encrypted sync';
    document.getElementById('storageUsage').hidden = !state.configured;
    document.getElementById('usageMeter').value = state.bytes;
    document.getElementById('usageText').textContent = `${(state.bytes / 1024).toFixed(1)} of 100 KB used · up to 500 sites, depending on URL length.`;
    if (!state.unlocked) { clearLibrary(); return; }
    const saved = await readMappings();
    if (request !== revision) return;
    mappings = saved;
    document.getElementById('libraryPanel').hidden = false;
    renderMappings();
    if (state.legacy) showStatus('Some local sites have not been migrated. They remain on this device; lock and unlock to retry migration.', true);
  } catch (error) {
    if (request !== revision) return;
    clearLibrary();
    showStatus(error.message, true);
  }
}

vaultForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !state) return;
  busy = true;
  const button = document.getElementById('unlockBtn');
  button.disabled = true;
  const payload = { passphrase: document.getElementById('passphrase').value, confirmation: document.getElementById('confirmation').value };
  vaultForm.reset();
  showStatus('Unlocking and verifying your library…');
  try {
    const result = await vaultRequest(state.configured ? 'unlock' : 'setup', payload);
    showStatus(result.warning || 'Library unlocked on this device.', !!result.warning);
    await refresh();
    search.focus();
  } catch (error) { showStatus(error.message, true); document.getElementById('passphrase').focus(); }
  finally { payload.passphrase = ''; payload.confirmation = ''; busy = false; button.disabled = false; }
});

document.getElementById('lockBtn').addEventListener('click', async () => {
  ++revision;
  clearLibrary();
  showStatus('');
  try { await vaultRequest('lock'); await refresh(); document.getElementById('passphrase').focus(); }
  catch (error) { showStatus(error.message, true); }
});
search.addEventListener('input', renderMappings);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' || (area === 'local' && changes.vaultKey)) {
    // Clear decrypted content when another tab forgets this device.
    if (area === 'local' && !changes.vaultKey.newValue) { ++revision; clearLibrary(); showStatus(''); }
    refresh();
  }
});
// A tab restored from the back-forward cache must recheck the lock state.
window.addEventListener('pageshow', refresh);
window.addEventListener('pagehide', () => { ++revision; clearLibrary(); vaultForm.reset(); });

document.getElementById('importBtn').addEventListener('click', () => importDialog.showModal());
document.getElementById('cancelImport').addEventListener('click', () => importDialog.close());
importDialog.addEventListener('close', () => { document.getElementById('importForm').reset(); document.getElementById('importStatus').textContent = ''; });
document.getElementById('importForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const file = document.getElementById('fileInput').files[0];
  if (!file) return;
  const status = document.getElementById('importStatus');
  if (file.size > 1048576) { status.textContent = 'Choose a file smaller than 1 MB.'; return; }
  busy = true;
  const button = document.getElementById('confirmImport');
  button.disabled = true;
  const passphrase = document.getElementById('backupPassphrase').value;
  document.getElementById('backupPassphrase').value = '';
  try {
    status.textContent = 'Verifying and importing…';
    const result = await vaultRequest('import', { text: await file.text(), passphrase });
    importDialog.close();
    showStatus(`Imported ${result.added} site(s). Kept ${result.skipped} existing keyword(s).`);
    await refresh();
  } catch (error) { status.textContent = error.message; }
  finally { busy = false; button.disabled = false; }
});

document.getElementById('exportBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const backup = await vaultRequest('export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `goTab-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus('Encrypted backup created. Keep your vault passphrase to restore it.');
  } catch (error) { showStatus(error.message, true); }
  finally { button.disabled = false; }
});
refresh();
