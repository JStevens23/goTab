'use strict';
(async () => {
  const results = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  const request = (action, payload) => new Promise(resolve => workerTest.messages({scope:'vault', action, payload}, {id:chrome.runtime.id, url:chrome.runtime.getURL('sites.html')}, resolve));
  try {
    const message = { scope: 'vault', action: 'list' };
    const denied = () => { throw new Error('Untrusted response'); };
    assert(workerTest.messages(message,{id:chrome.runtime.id,url:'https://example.com'},denied) === false, 'Content-script sender rejected');
    assert(workerTest.messages(message,{id:'another-extension',url:chrome.runtime.getURL('sites.html')},denied) === false, 'Other extension rejected');
    assert(workerTest.messages(message,{id:chrome.runtime.id,url:chrome.runtime.getURL('tests/worker.html')},denied) === false, 'Unapproved extension page rejected');
    assert(!(await request('constructor')).ok, 'Inherited action names rejected');
    await workerTest.omnibox('private keyword','currentTab');
    assert(workerTest.navigations.at(-1).url === chrome.runtime.getURL('sites.html'), 'Locked omnibox opens library without leaking query');
    const passphrase='worker test random phrase 6235';
    assert((await request('setup',{passphrase,confirmation:passphrase})).ok, 'Trusted library setup accepted');
    assert((await request('add',{keyword:'site',url:'https://example.com/saved'})).ok, 'Trusted library addition accepted');
    await workerTest.omnibox('constructor','currentTab');
    assert(workerTest.navigations.at(-1).url === chrome.runtime.getURL('sites.html'), 'Unknown prototype-name keyword does not navigate');
    await workerTest.omnibox('SITE','currentTab');
    assert(workerTest.navigations.at(-1).type === 'update' && workerTest.navigations.at(-1).url === 'https://example.com/saved', 'Current-tab navigation validates and normalizes keyword');
    await workerTest.omnibox('site','newBackgroundTab');
    assert(workerTest.navigations.at(-1).active === false, 'Background-tab disposition preserved');
    await workerTest.omnibox('site','newForegroundTab');
    assert(workerTest.navigations.at(-1).active === true, 'Foreground-tab disposition preserved');
    await request('lock');
    assert(!(await request('export')).ok, 'Locked export rejected through message boundary');
    document.getElementById('results').textContent=`${results.length} checks passed\n\n${results.join('\n')}`;
    document.body.dataset.result='passed';
  } catch(error) {
    document.getElementById('results').textContent=`${results.length} passed before failure\n${error.stack}`;
    document.body.dataset.result='failed';
  }
})();
