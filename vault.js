'use strict';

// Shared by the trusted service worker and the dependency-free browser tests.
const Vault = (() => {
  const META = 'vault.v1';
  const PREFIX = 'site.';
  const DEVICE_KEY = 'vaultKey';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const fail = (message) => { throw new Error(message); };
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  function unb64(value, max = 8192) {
    if (typeof value !== 'string' || value.length > max || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail('Invalid encrypted data.');
    try { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); } catch { fail('Invalid encrypted data.'); }
  }
  function keyword(value) {
    if (typeof value !== 'string') fail('Enter a keyword.');
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized.length > 100 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(normalized)) fail('Keywords must contain 1–100 characters without control characters.');
    return normalized;
  }
  function url(value) {
    if (typeof value !== 'string' || value.length > 2048 || !/^https?:\/\//i.test(value) || value.includes('\\') || /[\u0000-\u0020\u007f]/u.test(value)) fail('Use an http:// or https:// URL without spaces (up to 2,048 characters).');
    let parsed;
    try { parsed = new URL(value); } catch { fail('Enter a valid site URL.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) fail('Use http:// or https:// URLs without embedded usernames or passwords.');
    return value;
  }
  function mappings(value) {
    if (!object(value) || Object.keys(value).length > 500) fail('Use a JSON object with at most 500 sites.');
    const result = Object.create(null);
    for (const [name, address] of Object.entries(value)) {
      const normalized = keyword(name);
      if (Object.hasOwn(result, normalized)) fail('Duplicate keywords after normalization.');
      result[normalized] = url(address);
    }
    return result;
  }
  function envelope(value) {
    if (!object(value) || Object.keys(value).sort().join() !== 'data,iv' || unb64(value.iv).length !== 12 || unb64(value.data).length < 16) fail('Invalid encrypted record.');
    return value;
  }
  function metadata(value) {
    if (!object(value) || value.version !== 1 || value.iterations !== 600000 || unb64(value.salt).length !== 16) fail('Unsupported or invalid vault.');
    envelope(value.check);
    return value;
  }
  async function keys(raw) {
    return {
      aes: await crypto.subtle.importKey('raw', raw.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']),
      hmac: await crypto.subtle.importKey('raw', raw.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    };
  }
  async function derive(passphrase, meta) {
    if (typeof passphrase !== 'string' || passphrase.length < 16 || passphrase.length > 1024) fail('Use a passphrase of 16–1,024 characters.');
    const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(meta.salt), iterations: 600000 }, material, 512));
  }
  const aad = (meta, id) => encoder.encode(`goTab:v1:${meta.salt}:${id}`);
  async function seal(value, key, meta, id) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(meta, id), tagLength: 128 }, key.aes, encoder.encode(JSON.stringify(value)));
    return { iv: b64(iv), data: b64(data) };
  }
  async function open(value, key, meta, id) {
    envelope(value);
    try {
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(value.iv), additionalData: aad(meta, id), tagLength: 128 }, key.aes, unb64(value.data));
      return JSON.parse(decoder.decode(bytes));
    } catch { fail('Could not unlock or verify this vault. Check the passphrase; the data may be damaged.'); }
  }
  async function recordId(name, key) {
    return PREFIX + Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key.hmac, encoder.encode(name))), b => b.toString(16).padStart(2, '0')).join('');
  }
  function quota(data) {
    const entries = Object.entries(data);
    if (entries.length > 512) fail('Sync storage is full. Remove a site before adding more.');
    let total = 0;
    for (const [name, value] of entries) {
      const size = encoder.encode(name + JSON.stringify(value)).length;
      if (size > 8192) fail('A site is too large for sync storage.');
      total += size;
    }
    if (total > 102400) fail('Sync storage is full. Remove sites or shorten URLs before trying again.');
    return total;
  }
  function create(storage) {
    let queue = Promise.resolve();
    // Serialize all mutations across this browser's popup, tabs and worker.
    const serial = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
    const ready = Promise.all(['local', 'sync', 'session'].map(area => storage[area].setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })));
    async function context() {
      await ready;
      const data = await storage.sync.get(null);
      const meta = data[META] ? metadata(data[META]) : null;
      let saved = (await storage.local.get(DEVICE_KEY))[DEVICE_KEY];
      let migrateSession = false;
      // Preserve an existing unlock when upgrading from session-only storage.
      if (!saved && meta) {
        saved = (await storage.session.get(DEVICE_KEY))[DEVICE_KEY];
        migrateSession = !!saved;
      }
      if (!meta || !saved || saved.salt !== meta.salt) return { data, meta, key: null };
      let key;
      try {
        const raw = unb64(saved.raw);
        if (raw.length !== 64) return { data, meta, key: null };
        key = await keys(raw);
        if (await open(meta.check, key, meta, META) !== 'goTab vault v1') return { data, meta, key: null };
      } catch {
        // A damaged saved key must not prevent recovery with the passphrase.
        return { data, meta, key: null };
      }
      if (migrateSession) {
        await storage.local.set({ [DEVICE_KEY]: saved });
        await storage.session.remove(DEVICE_KEY);
      }
      return { data, meta, key };
    }
    function unlocked(ctx) { if (!ctx.key) fail('Open Saved sites to set up or unlock encrypted sync.'); }
    async function read(ctx) {
      unlocked(ctx);
      if (await open(ctx.meta.check, ctx.key, ctx.meta, META) !== 'goTab vault v1') fail('Invalid vault.');
      const result = Object.create(null);
      for (const [id, value] of Object.entries(ctx.data)) {
        if (!id.startsWith(PREFIX)) continue;
        if (!/^site\.[a-f0-9]{64}$/.test(id)) fail('Invalid site record.');
        const entry = await open(value, ctx.key, ctx.meta, id);
        if (!object(entry)) fail('Invalid site record.');
        const name = keyword(entry.keyword);
        if (await recordId(name, ctx.key) !== id) fail('Invalid site identity.');
        result[name] = url(entry.url);
      }
      return result;
    }
    async function write(ctx, incoming) {
      unlocked(ctx);
      const patch = {};
      for (const [name, address] of Object.entries(incoming)) {
        const id = await recordId(name, ctx.key);
        patch[id] = await seal({ keyword: name, url: address }, ctx.key, ctx.meta, id);
      }
      const next = { ...ctx.data, ...patch };
      if (Object.keys(next).filter(id => id.startsWith(PREFIX)).length > 500) fail('The library supports up to 500 sites, subject to available sync space.');
      quota(next);
      // Detect a different vault arriving while an operation was in flight.
      const latest = (await storage.sync.get(META))[META];
      if (!latest || latest.salt !== ctx.meta.salt) fail('The synced vault changed. Unlock it again before saving.');
      if (Object.keys(patch).length) await storage.sync.set(patch);
    }
    async function migrate(ctx) {
      const legacy = (await storage.local.get('urlMappings')).urlMappings;
      if (!legacy) return;
      const incoming = mappings(legacy);
      const current = await read(ctx);
      const patch = Object.create(null);
      for (const [name, address] of Object.entries(incoming)) {
        if (current[name] === address) continue;
        let target = name;
        let n = 1;
        while (Object.hasOwn(current, target) || Object.hasOwn(patch, target)) {
          // A prior migration may have saved this alias before local cleanup failed.
          if (current[target] === address || patch[target] === address) break;
          target = `${name.slice(0, 80)}-local-${n++}`;
        }
        if (current[target] !== address && patch[target] !== address) patch[target] = address;
      }
      await write(ctx, patch);
      // Delete plaintext only after the encrypted write succeeds.
      await storage.local.remove('urlMappings');
    }
    async function state() {
      const ctx = await context();
      return { configured: !!ctx.meta, unlocked: !!ctx.key, bytes: quota(ctx.data), count: Object.keys(ctx.data).filter(id => id.startsWith(PREFIX)).length, legacy: !!(await storage.local.get('urlMappings')).urlMappings };
    }
    const api = {
      state,
      async list() { return read(await context()); },
      async setup({ passphrase, confirmation }) {
        if (passphrase !== confirmation) fail('The passphrases do not match.');
        const ctx = await context();
        if (ctx.meta || Object.keys(ctx.data).length) fail('Sync data already exists. Wait for sync and unlock the existing vault.');
        const legacy = (await storage.local.get('urlMappings')).urlMappings;
        const incoming = mappings(legacy || {});
        const meta = { version: 1, iterations: 600000, salt: b64(crypto.getRandomValues(new Uint8Array(16))) };
        const raw = await derive(passphrase, meta);
        const key = await keys(raw);
        meta.check = await seal('goTab vault v1', key, meta, META);
        const data = { [META]: meta };
        for (const [name, address] of Object.entries(incoming)) {
          const id = await recordId(name, key);
          data[id] = await seal({ keyword: name, url: address }, key, meta, id);
        }
        quota(data);
        if (Object.keys(await storage.sync.get(null)).length) fail('A vault just arrived from sync. Unlock it instead.');
        await storage.sync.set(data);
        await storage.local.set({ [DEVICE_KEY]: { salt: meta.salt, raw: b64(raw) } });
        await storage.local.remove('urlMappings');
        return state();
      },
      async unlock({ passphrase }) {
        const ctx = await context();
        if (!ctx.meta) fail('Wait for Chrome Sync or set up a vault on this device.');
        const raw = await derive(passphrase, ctx.meta);
        ctx.key = await keys(raw);
        await read(ctx); // Authenticate every record before retaining the key.
        await storage.local.set({ [DEVICE_KEY]: { salt: ctx.meta.salt, raw: b64(raw) } });
        let warning = '';
        try { await migrate(ctx); } catch { warning = 'Unlocked, but local sites could not be migrated. They remain on this device. Check their URLs and available sync space.'; }
        return { ...await state(), warning };
      },
      async lock() {
        await ready;
        await storage.session.remove(DEVICE_KEY);
        await storage.local.remove(DEVICE_KEY);
      },
      async add({ keyword: name, url: address }) {
        name = keyword(name); address = url(address);
        const ctx = await context();
        const current = await read(ctx);
        if (Object.hasOwn(current, name)) fail('That keyword is already saved. Choose another keyword.');
        await write(ctx, { [name]: address });
      },
      async remove({ keyword: name }) {
        const ctx = await context();
        await read(ctx);
        await storage.sync.remove(await recordId(keyword(name), ctx.key));
      },
      async export() {
        const ctx = await context();
        await read(ctx);
        return { format: 'goTab-encrypted-v1', data: Object.fromEntries(Object.entries(ctx.data).filter(([id]) => id === META || id.startsWith(PREFIX))) };
      },
      async import({ text, passphrase }) {
        if (typeof text !== 'string' || encoder.encode(text).length > 1048576) fail('Choose a JSON file smaller than 1 MB.');
        let parsed;
        try { parsed = JSON.parse(text); } catch { fail('This file is not valid JSON.'); }
        const ctx = await context();
        await read(ctx);
        let incoming;
        if (parsed?.format === 'goTab-encrypted-v1') {
          const data = parsed.data;
          if (!object(data)) fail('Invalid encrypted backup.');
          quota(data);
          const meta = metadata(data[META]);
          const key = meta.salt === ctx.meta.salt ? ctx.key : await keys(await derive(passphrase, meta));
          incoming = await read({ data, meta, key });
        } else {
          incoming = mappings(parsed);
        }
        const current = await read(ctx);
        // Imports never silently overwrite existing destinations.
        const patch = Object.create(null);
        let skipped = 0;
        for (const [name, address] of Object.entries(incoming)) {
          if (Object.hasOwn(current, name)) { skipped++; continue; }
          patch[name] = address;
        }
        await write(ctx, patch);
        return { added: Object.keys(patch).length, skipped };
      }
    };
    return { run: (action, payload = {}) => serial(async () => {
      if (!Object.hasOwn(api, action)) fail('Unknown request.');
      return api[action](payload);
    }) };
  }
  return { create, keyword, url, mappings, quota };
})();
