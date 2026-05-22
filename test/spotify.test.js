import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const storage = new MemoryStorage();
const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

globalThis.sessionStorage = storage;
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
globalThis.window = {
  location: {
    origin: 'http://localhost:5173',
    pathname: '/',
    search: '',
    href: 'http://localhost:5173/',
  },
  history: {
    replaceState: (_state, _title, pathname) => {
      globalThis.window.location.pathname = pathname || '/';
      globalThis.window.location.search = '';
      globalThis.window.location.href = `${globalThis.window.location.origin}${globalThis.window.location.pathname}`;
    },
  },
};

const { STORAGE_KEYS } = await import('../src/config/storage.js');
const { SPOTIFY_CONFIG } = await import('../src/config/spotify.js');
const { spotify } = await import('../src/services/spotify.js');

SPOTIFY_CONFIG.clientId = 'test-client-id';

const setSearch = (search) => {
  globalThis.window.location.search = search;
  globalThis.window.location.href = `${globalThis.window.location.origin}/${search}`;
};

const jsonResponse = (body, init = {}) => new Response(JSON.stringify(body), {
  status: init.status || 200,
  headers: {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
});

const setValidToken = (now = 1_700_000_000_000) => {
  storage.setItem(STORAGE_KEYS.accessToken, 'valid-token');
  storage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(now + 60_000));
};

test.beforeEach(() => {
  storage.clear();
  setSearch('');
  Date.now = originalDateNow;
  globalThis.fetch = originalFetch;
  console.error = () => {};
  console.warn = () => {};
});

test.after(() => {
  Date.now = originalDateNow;
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

test('handleCallback rejects OAuth state mismatch with a clear error', async () => {
  storage.setItem(STORAGE_KEYS.oauthState, 'expected-state');
  storage.setItem(STORAGE_KEYS.codeVerifier, 'verifier');
  setSearch('?code=auth-code&state=wrong-state');
  globalThis.fetch = async () => {
    assert.fail('token exchange should not run when OAuth state mismatches');
  };

  await assert.rejects(
    () => spotify.handleCallback(),
    error => error.code === 'SPOTIFY_AUTH_STATE_MISMATCH'
  );

  assert.equal(storage.getItem(STORAGE_KEYS.oauthState), null);
  assert.equal(storage.getItem(STORAGE_KEYS.codeVerifier), null);
  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), null);
});

test('handleCallback stores access token expiresAt from expires_in', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.oauthState, 'expected-state');
  storage.setItem(STORAGE_KEYS.codeVerifier, 'verifier');
  setSearch('?code=auth-code&state=expected-state');

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ access_token: 'access-token', expires_in: 120 });
  };

  assert.equal(await spotify.handleCallback(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.body.get('code'), 'auth-code');
  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), 'access-token');
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenExpiresAt), String(now + 120_000));
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenTimestamp), null);
  assert.equal(storage.getItem(STORAGE_KEYS.oauthState), null);
  assert.equal(storage.getItem(STORAGE_KEYS.codeVerifier), null);
});

test('isLoggedIn migrates legacy access token timestamp to expiresAt', () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.accessToken, 'legacy-token');
  storage.setItem(STORAGE_KEYS.accessTokenTimestamp, String(now - 10_000));

  assert.equal(spotify.isLoggedIn(), true);
  assert.equal(
    storage.getItem(STORAGE_KEYS.accessTokenExpiresAt),
    String(now - 10_000 + SPOTIFY_CONFIG.tokenExpiry)
  );
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenTimestamp), null);
});

test('apiCall clears auth and throws SPOTIFY_AUTH_EXPIRED on 401', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse({ error: { status: 401 } }, { status: 401 });

  await assert.rejects(
    () => spotify.apiCall('https://api.spotify.com/v1/me'),
    error => error.code === 'SPOTIFY_AUTH_EXPIRED'
  );

  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenExpiresAt), null);
});

test('apiCall retries 429 by Retry-After and then throws SPOTIFY_RATE_LIMIT_EXCEEDED', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  let fetchCount = 0;
  const retrySeconds = [];
  globalThis.fetch = async () => {
    fetchCount++;
    return jsonResponse({ error: { status: 429 } }, {
      status: 429,
      headers: { 'Retry-After': '0' },
    });
  };

  await assert.rejects(
    () => spotify.apiCall(
      'https://api.spotify.com/v1/me',
      0,
      seconds => retrySeconds.push(seconds)
    ),
    error => error.code === 'SPOTIFY_RATE_LIMIT_EXCEEDED'
  );

  assert.equal(fetchCount, 5);
  assert.deepEqual(retrySeconds, [0, 0, 0, 0]);
});
