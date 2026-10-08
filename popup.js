'use strict';

const form = document.getElementById('addForm');
const fieldset = document.getElementById('addFields');
let saving = false;
let refreshRevision = 0;
const onboarding = createOnboarding({ refresh: refreshState, onReady: () => document.getElementById('keyword').focus() });
async function refreshState() {
  const revision = ++refreshRevision;
  try {
    const state = await vaultRequest('state');
    if (revision !== refreshRevision) return;
    onboarding.render(state);
    document.getElementById('onboardingPanel').hidden = state.unlocked;
    document.getElementById('addHeading').hidden = !state.unlocked;
    form.hidden = !state.unlocked;
    fieldset.disabled = !state.unlocked || saving;
    document.getElementById('vaultHint').textContent = state.unlocked ? 'Encrypted sync · unlocked on this device' : '';
  } catch (error) { if (revision !== refreshRevision) return; fieldset.disabled = true; showStatus(error.message, true); }
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
