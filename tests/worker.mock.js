'use strict';
const workerTest = { messages: null, omnibox: null, navigations: [] };
globalThis.importScripts = () => {}; // vault.js is already loaded by the test page.
const areas = { local: {}, sync: {}, session: {} };
globalThis.chrome = {
  runtime: {
    id: 'test-extension',
    getURL: path => `chrome-extension://test-extension/${path}`,
    onMessage: { addListener: listener => { workerTest.messages = listener; } }
  },
  storage: Object.fromEntries(Object.keys(areas).map(area => [area, {
    setAccessLevel: async () => {},
    get: async key => structuredClone(key === null ? areas[area] : Object.hasOwn(areas[area], key) ? { [key]: areas[area][key] } : {}),
    set: async patch => { Object.assign(areas[area], structuredClone(patch)); },
    remove: async key => { delete areas[area][key]; }
  }])),
  omnibox: { onInputEntered: { addListener: listener => { workerTest.omnibox = listener; } } },
  tabs: {
    update: async options => workerTest.navigations.push({ type: 'update', ...options }),
    create: async options => workerTest.navigations.push({ type: 'create', ...options })
  }
};
