'use strict';
importScripts('vault.js');
const vault = Vault.create(chrome.storage);
const allowedPages = ['popup.html', 'sites.html'].map(path => chrome.runtime.getURL(path));

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Never accept vault commands from web pages or content scripts.
  if (sender.id !== chrome.runtime.id || !allowedPages.includes(sender.url) || !message || message.scope !== 'vault') return false;
  vault.run(message.action, message.payload).then(
    value => respond({ ok: true, value }),
    error => respond({ ok: false, error: error.message || 'The operation failed. Please try again.' })
  );
  return true;
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  try {
    const mappings = await vault.run('list');
    const name = Vault.keyword(text);
    if (!Object.hasOwn(mappings, name)) throw new Error('No saved site matches that keyword.');
    const url = Vault.url(mappings[name]);
    if (disposition === 'currentTab') await chrome.tabs.update({ url });
    else await chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' });
  } catch {
    // Do not disclose unknown keywords or a locked vault's contents to a search engine.
    await chrome.tabs.create({ url: chrome.runtime.getURL('sites.html') });
  }
});
