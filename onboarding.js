'use strict';

// Shared onboarding for the popup and the full library page.
function createOnboarding({ refresh, onReady }) {
  const form = document.getElementById('vaultForm');
  const fields = document.getElementById('authFields');
  let state = null;
  let mode = '';
  let busy = false;
  const render = next => {
    state = next;
    const nextMode = next.unlocked ? 'ready' : next.configured ? 'unlock'
      : next.onboardingChoice === 'new' ? 'create'
      : next.onboardingChoice === 'existing' ? 'wait' : 'choose';
    if (mode !== nextMode) form.reset();
    mode = nextMode;
    document.getElementById('onboardingChoices').hidden = mode !== 'choose';
    document.getElementById('syncWaiting').hidden = mode !== 'wait';
    document.getElementById('onboardingBack').hidden = next.configured || mode === 'choose';
    form.hidden = !['create', 'unlock'].includes(mode);
    fields.disabled = busy;
    document.getElementById('confirmGroup').hidden = mode !== 'create';
    document.getElementById('confirmation').required = mode === 'create';
    document.getElementById('passphrase').autocomplete = mode === 'create' ? 'new-password' : 'current-password';
    document.getElementById('passphraseHint').textContent = mode === 'create'
      ? 'At least 8 characters. Keep this passphrase to unlock on other devices.'
      : 'Use the passphrase you created on your first device.';
    document.getElementById('unlockBtn').textContent = mode === 'create' ? 'Create library' : 'Unlock library';
    document.getElementById('vaultTitle').textContent = {
      ready: 'Encrypted sync · unlocked', choose: 'Welcome to goTab', create: 'Create your library',
      wait: 'Connect your library', unlock: 'Unlock your library'
    }[mode];
    document.getElementById('vaultDescription').textContent = {
      ready: 'This device stays unlocked across browser restarts.',
      choose: 'New to goTab, or connecting another device?',
      create: 'Create a passphrase to protect your saved sites. Then add your first shortcut.',
      wait: 'Your existing library has not reached this browser yet. You do not need a new passphrase.',
      unlock: 'Your library is here. Enter your existing passphrase to use it on this device.'
    }[mode];
  };
  const choose = async choice => {
    if (busy) return;
    try {
      await vaultRequest('chooseOnboarding', { choice });
      showStatus('');
      await refresh();
      if (mode === 'create' || mode === 'unlock') document.getElementById('passphrase').focus();
    } catch (error) { showStatus(error.message, true); }
  };
  document.getElementById('newLibraryBtn').addEventListener('click', () => choose('new'));
  document.getElementById('existingLibraryBtn').addEventListener('click', () => choose('existing'));
  document.getElementById('onboardingBack').addEventListener('click', () => choose(null));
  document.getElementById('checkSyncBtn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await refresh();
      if (mode === 'wait') showStatus('Still waiting for your library. Check Chrome Sync on both devices, then try again.');
    } finally { button.disabled = false; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !state || !['create', 'unlock'].includes(mode)) return;
    const action = mode === 'create' ? 'setup' : 'unlock';
    const payload = { passphrase: document.getElementById('passphrase').value, confirmation: document.getElementById('confirmation').value };
    form.reset(); busy = true; fields.disabled = true;
    showStatus(action === 'setup' ? 'Creating your encrypted library…' : 'Unlocking your library…');
    try {
      const result = await vaultRequest(action, payload);
      showStatus(result.warning || 'Library ready. This device will stay unlocked.', !!result.warning);
      await refresh();
      onReady();
    } catch (error) {
      // A synced vault may have arrived during setup. Re-read state rather than
      // retrying creation or retaining a passphrase intended for a different mode.
      await refresh();
      showStatus(error.message, true);
    } finally {
      payload.passphrase = ''; payload.confirmation = '';
      busy = false; fields.disabled = false;
      if (mode === 'create' || mode === 'unlock') document.getElementById('passphrase').focus();
    }
  });
  return { render };
}
