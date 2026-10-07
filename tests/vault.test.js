'use strict';
(async () => {
  const results = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  async function rejects(fn, label) {
    let rejected = false;
    try { await fn(); } catch { rejected = true; }
    assert(rejected, label);
  }
  function mockStorage(initial = {}) {
    const data = { local: structuredClone(initial), sync: {}, session: {} };
    const access = {};
    let failWrites = false;
    let failCleanup = false;
    const storage = Object.fromEntries(Object.keys(data).map(area => [area, {
      async setAccessLevel(value) { access[area] = value.accessLevel; },
      async get(key) { return structuredClone(key === null ? data[area] : Object.hasOwn(data[area], key) ? { [key]: data[area][key] } : {}); },
      async set(patch) { if (area === 'sync' && failWrites) throw new Error('quota'); Object.assign(data[area], structuredClone(patch)); },
      async remove(key) { if (area === 'local' && failCleanup) throw new Error('cleanup failed'); delete data[area][key]; }
    }]));
    return { storage, data, access, fail: value => { failWrites = value; }, failCleanup: value => { failCleanup = value; } };
  }
  const passphrase = 'test only four random words 9842';
  try {
    const mock = mockStorage({ urlMappings: { GitHub: 'https://github.com', '__proto__': 'https://example.com' } });
    const vault = Vault.create(mock.storage);
    await rejects(() => vault.run('add', { keyword: 'test', url: 'https://example.com' }), 'Locked writes rejected');
    await vault.run('setup', { passphrase, confirmation: passphrase });
    assert(Object.values(mock.access).every(value => value === 'TRUSTED_CONTEXTS'), 'All storage restricted to trusted contexts');
    assert(!mock.data.local.urlMappings, 'Successful migration removes legacy plaintext');
    assert((await vault.run('list')).github === 'https://github.com', 'Legacy keyword normalized and migrated');
    assert(!JSON.stringify(mock.data.sync).includes('github') && !JSON.stringify(mock.data.sync).includes(passphrase), 'Persistent sync contains neither keyword, URL nor passphrase');
    await rejects(() => vault.run('add', { keyword: 'github', url: 'https://other.example' }), 'Duplicate add preserves destination');
    await rejects(() => vault.run('add', { keyword: 'bad', url: 'javascript:alert(1)' }), 'Script URLs rejected');
    await rejects(() => vault.run('add', { keyword: 'bad', url: 'https://name:password@example.com' }), 'Credential-bearing URLs rejected');
    await rejects(() => vault.run('add', { keyword: 'bad\u202etest', url: 'https://example.com' }), 'Bidi control characters rejected');
    for (const address of ['http://intranet', 'http://192.168.1.10', 'http://localhost:8080']) {
      await vault.run('add', { keyword: 'internal', url: address });
      assert((await vault.run('list')).internal === address, `Internal HTTP supported: ${address}`);
      await vault.run('remove', { keyword: 'internal' });
    }
    await rejects(() => vault.run('add', { keyword: 'bad', url: 'https:example.com' }), 'Ambiguous URL shorthand rejected');
    await rejects(() => vault.run('add', { keyword: 'bad', url: 'https://example.com\\path' }), 'Backslash URL ambiguity rejected');
    await vault.run('add', { keyword: '__proto__', url: 'https://example.com/prototype' });
    assert(Object.hasOwn(await vault.run('list'), '__proto__'), 'Prototype-like keywords stored safely');
    await Promise.all(['first', 'second'].map(keyword => vault.run('add', { keyword, url: 'https://example.com' })));
    assert(Object.keys(await vault.run('list')).length === 4, 'Concurrent adds serialized without lost entries');
    const before = JSON.stringify(mock.data.sync);
    await rejects(() => vault.run('import', { text: '{"okay":"https://example.com","bad":"data:text/html,no"}' }), 'Invalid import rejected as a whole');
    assert(JSON.stringify(mock.data.sync) === before, 'Invalid import leaves vault unchanged');
    const imported = await vault.run('import', { text: '{"github":"https://other.example","new":"https://new.example"}' });
    assert(imported.added === 1 && imported.skipped === 1 && (await vault.run('list')).github === 'https://github.com', 'Import preserves existing destinations');
    await rejects(() => vault.run('import', { text: 'null' }), 'Null import rejected');
    await rejects(() => vault.run('import', { text: 'x'.repeat(1048577) }), 'Oversized import rejected');
    const backup = await vault.run('export');
    assert(!JSON.stringify(backup).includes('https://'), 'Backups contain only encrypted destinations');
    const records = Object.keys(mock.data.sync).filter(key => key.startsWith('site.'));
    const record = structuredClone(mock.data.sync[records[0]]);
    mock.data.sync[records[0]].data = (record.data[0] === 'A' ? 'B' : 'A') + record.data.slice(1);
    await rejects(() => vault.run('list'), 'Ciphertext tampering fails authentication');
    mock.data.sync[records[0]] = record;
    mock.data.sync[records[1]] = record;
    await rejects(() => vault.run('list'), 'Moving ciphertext between record IDs fails authentication');
    mock.data.sync = structuredClone(backup.data);
    await vault.run('lock');
    assert(!mock.data.session.vaultKey, 'Lock removes session key');
    await rejects(() => vault.run('list'), 'Locked vault cannot be read');
    await rejects(() => vault.run('unlock', { passphrase: 'incorrect passphrase 1234' }), 'Wrong passphrase rejected');
    assert(!mock.data.session.vaultKey, 'Wrong passphrase never retained');
    await vault.run('unlock', { passphrase });
    assert(Object.keys(await vault.run('list')).length === 5, 'Correct passphrase restores library');
    const device2 = mockStorage();
    device2.data.sync = structuredClone(mock.data.sync);
    const second = Vault.create(device2.storage);
    assert(!(await second.run('state')).unlocked, 'Synced device starts locked');
    await second.run('unlock', { passphrase });
    assert((await second.run('list')).github === 'https://github.com', 'Second device decrypts synced sites with same passphrase');
    await second.run('remove', { keyword: 'github' });
    assert(!Object.hasOwn(await second.run('list'), 'github'), 'Removal deletes only selected encrypted record');
    const fresh = mockStorage();
    const restored = Vault.create(fresh.storage);
    const newPassphrase = 'another test passphrase for new vault';
    await restored.run('setup', { passphrase: newPassphrase, confirmation: newPassphrase });
    await restored.run('import', { text: JSON.stringify(backup), passphrase });
    assert((await restored.run('list')).github === 'https://github.com', 'Backup restored into a different vault and re-encrypted');
    const failure = mockStorage({ urlMappings: { original: 'https://original.example' } });
    failure.fail(true);
    await rejects(() => Vault.create(failure.storage).run('setup', { passphrase, confirmation: passphrase }), 'Failed sync write reported');
    assert(failure.data.local.urlMappings.original === 'https://original.example', 'Failed migration preserves original plaintext');
    await rejects(() => Promise.resolve(Vault.quota({ long: 'x'.repeat(8192) })), 'Per-item quota enforced');
    await rejects(() => Promise.resolve(Vault.quota(Object.fromEntries(Array.from({length:513}, (_,i) => [String(i), 'x'])))), 'Item-count quota enforced');
    await rejects(() => Promise.resolve(Vault.quota(Object.fromEntries(Array.from({length:100}, (_,i) => [String(i), 'x'.repeat(1100)])))), 'Total quota enforced');
    const migration = mockStorage({urlMappings:{github:'https://different.example'}});
    migration.data.sync = structuredClone(backup.data);
    const migrating = Vault.create(migration.storage);
    migration.failCleanup(true);
    const migrationResult = await migrating.run('unlock',{passphrase});
    assert(!!migrationResult.warning && !!migration.data.local.urlMappings, 'Cleanup failure retains local data and shows warning');
    const migrated = await migrating.run('list');
    assert(migrated.github === 'https://github.com' && migrated['github-local-1'] === 'https://different.example', 'Cross-device legacy conflicts preserved with renamed local keyword');
    const migrationCount = Object.keys(migrated).length;
    migration.failCleanup(false);
    await migrating.run('lock');
    await migrating.run('unlock', {passphrase});
    assert(Object.keys(await migrating.run('list')).length === migrationCount, 'Migration retry does not duplicate renamed conflicts');
    assert(!migration.data.local.urlMappings, 'Migration retry finishes local cleanup');
    mock.data.session = {};
    assert(!(await Vault.create(mock.storage).run('state')).unlocked, 'Browser restart requires unlock');
    document.getElementById('results').textContent = `${results.length} checks passed\n\n${results.join('\n')}`;
    document.body.dataset.result = 'passed';
  } catch (error) {
    document.getElementById('results').textContent = `${results.length} checks passed before failure\n${error.stack}`;
    document.body.dataset.result = 'failed';
  }
})();
