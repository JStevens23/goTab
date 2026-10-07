'use strict';

let mappings = {};
let state = null;
let revision = 0;
let busy = false;
const list = document.getElementById('mappingList');
const search = document.getElementById('search');
const vaultForm = document.getElementById('vaultForm');
const importDialog = document.getElementById('importDialog');
const passphraseDialog = document.getElementById('passphraseDialog');
const drafts = new Map();
let changingPassphrase = false;

function renderMappings() {
  const focused = document.activeElement;
  const focusedKeyword = focused?.dataset.editKeyword;
  const selection = focusedKeyword ? [focused.selectionStart, focused.selectionEnd] : null;
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
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit URL for ${keyword}`);
    edit.addEventListener('click', () => {
      drafts.set(keyword, { value: url, expectedUrl: url, error: '', saving: false });
      renderMappings();
      list.querySelectorAll('input').forEach(input => {
        if (input.dataset.editKeyword === keyword) { input.focus(); input.select(); }
      });
    });
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
    if (drafts.has(keyword)) {
      link.hidden = true;
      const draft = drafts.get(keyword);
      const form = document.createElement('form');
      form.className = 'inline-editor';
      const input = document.createElement('input');
      input.type = 'url';
      input.required = true;
      input.maxLength = 2048;
      input.autocomplete = 'off';
      input.value = draft.value;
      input.dataset.editKeyword = keyword;
      input.setAttribute('aria-label', `URL for ${keyword}`);
      input.disabled = draft.saving;
      input.addEventListener('input', () => { draft.value = input.value; });
      const actions = document.createElement('div');
      actions.className = 'actions';
      const save = document.createElement('button');
      save.type = 'submit'; save.className = 'primary'; save.textContent = 'Save'; save.disabled = draft.saving;
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.disabled = draft.saving;
      const cancelEdit = () => {
        if (draft.saving) return;
        drafts.delete(keyword); renderMappings();
        list.querySelectorAll('button').forEach(button => {
          if (button.getAttribute('aria-label') === `Edit URL for ${keyword}`) button.focus();
        });
      };
      cancel.addEventListener('click', cancelEdit);
      input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); cancelEdit(); } });
      const error = document.createElement('p');
      error.className = 'status error'; error.setAttribute('role', 'alert'); error.textContent = draft.error;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (draft.saving) return;
        draft.saving = true; draft.error = ''; renderMappings();
        try {
          await vaultRequest('update', { keyword, url: draft.value.trim(), expectedUrl: draft.expectedUrl });
          drafts.delete(keyword);
          await refresh();
          showStatus('URL updated.');
        } catch (failure) { draft.error = failure.message; }
        finally {
          draft.saving = false; renderMappings();
          // Restore keyboard focus after replacing the row on save or failure.
          list.querySelectorAll('input, button').forEach(control => {
            if (drafts.has(keyword) ? control.dataset.editKeyword === keyword
              : control.getAttribute('aria-label') === `Edit URL for ${keyword}`) control.focus();
          });
        }
      });
      actions.append(save, cancel); form.append(input, actions, error); info.append(form);
      item.append(info);
    } else {
      const actions = document.createElement('div'); actions.className = 'actions'; actions.append(edit, remove);
      item.append(info, actions);
    }
    list.append(item);
  }
  if (focusedKeyword) list.querySelectorAll('input').forEach(input => {
    if (input.dataset.editKeyword === focusedKeyword && !input.disabled) {
      input.focus();
      if (selection && selection[0] !== null) input.setSelectionRange(...selection);
    }
  });
  document.getElementById('emptyState').hidden = filtered.length > 0;
  document.getElementById('emptyTitle').textContent = entries.length ? 'No matching sites' : 'Your shortcuts start here';
  document.getElementById('emptyText').textContent = entries.length ? 'Try another keyword or part of a URL.' : 'Open the goTab extension popup to add your first site, or import a backup.';
}

function clearLibrary() {
  mappings = {};
  drafts.clear();
  list.replaceChildren();
  search.value = '';
  document.getElementById('libraryPanel').hidden = true;
  document.getElementById('siteCount').textContent = 'Locked';
  if (importDialog.open) importDialog.close();
  if (passphraseDialog.open && !changingPassphrase) passphraseDialog.close();
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
    document.getElementById('changePassphraseBtn').hidden = !state.unlocked;
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
    if (!changingPassphrase) refresh();
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
document.getElementById('changePassphraseBtn').addEventListener('click', () => passphraseDialog.showModal());
document.getElementById('cancelPassphrase').addEventListener('click', () => passphraseDialog.close());
passphraseDialog.addEventListener('cancel', event => { if (changingPassphrase) event.preventDefault(); });
passphraseDialog.addEventListener('close', () => {
  document.getElementById('changePassphraseForm').reset();
  document.getElementById('changePassphraseStatus').textContent = '';
});
document.getElementById('changePassphraseForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true; changingPassphrase = true;
  const status = document.getElementById('changePassphraseStatus');
  const payload = {
    currentPassphrase: document.getElementById('currentPassphrase').value,
    passphrase: document.getElementById('newPassphrase').value,
    confirmation: document.getElementById('confirmNewPassphrase').value
  };
  event.target.reset();
  document.getElementById('savePassphrase').disabled = true;
  document.getElementById('cancelPassphrase').disabled = true;
  status.textContent = 'Updating your passphrase…';
  try {
    const result = await vaultRequest('changePassphrase', payload);
    passphraseDialog.close();
    showStatus(result.warning || 'Passphrase changed. Use the new passphrase on your other devices.', !!result.warning);
  } catch (error) { status.textContent = error.message; }
  finally {
    payload.currentPassphrase = ''; payload.passphrase = ''; payload.confirmation = '';
    busy = false; changingPassphrase = false;
    document.getElementById('savePassphrase').disabled = false;
    document.getElementById('cancelPassphrase').disabled = false;
    await refresh();
  }
});
refresh();
