'use strict';

const form = document.getElementById('addForm');
const fieldset = document.getElementById('addFields');
let saving = false;
async function refreshState() {
  try {
    const state = await vaultRequest('state');
    fieldset.disabled = !state.unlocked || saving;
    document.getElementById('vaultHint').textContent = state.unlocked
      ? 'Encrypted sync · unlocked on this device'
      : state.configured ? 'Library locked. Open Saved sites to unlock.' : 'Open Saved sites to set up encrypted sync.';
  } catch (error) { fieldset.disabled = true; showStatus(error.message, true); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  const keywordInput = document.getElementById('keyword');
  const urlInput = document.getElementById('url');
  saving = true;
  fieldset.disabled = true;
  try {
    await vaultRequest('add', { keyword: keywordInput.value, url: urlInput.value.trim() });
    form.reset();
    showStatus('Site saved to your encrypted library.');
  } catch (error) { showStatus(error.message, true); }
  finally { saving = false; await refreshState(); keywordInput.focus(); }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' || area === 'local') {
    if (area === 'local' && changes.vaultKey && !changes.vaultKey.newValue) { form.reset(); showStatus(''); }
    refreshState();
  }
});
refreshState();
