'use strict';

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

async function vaultRequest(action, payload = {}) {
  const response = await chrome.runtime.sendMessage({ scope: 'vault', action, payload });
  if (!response?.ok) throw new Error(response?.error || 'Could not reach the vault. Reload the extension and try again.');
  return response.value;
}

function readMappings() { return vaultRequest('list'); }

function showStatus(message, error = false) {
  const status = document.getElementById('statusMessage');
  status.textContent = message;
  status.classList.toggle('error', error);
}
