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

test('Spotify scopes include read-only playback state access', () => {
  assert.match(SPOTIFY_CONFIG.scopes, /user-read-currently-playing/);
  assert.match(SPOTIFY_CONFIG.scopes, /user-read-playback-state/);
  assert.doesNotMatch(SPOTIFY_CONFIG.scopes, /user-modify-playback-state/);
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

test('getNowPlaying returns normalized track data for current Spotify track', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.spotify.com/v1/me/player/currently-playing');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return jsonResponse({
      is_playing: true,
      progress_ms: 42_000,
      currently_playing_type: 'track',
      item: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Current Song',
        duration_ms: 180_000,
        popularity: 73,
        explicit: true,
        external_ids: { isrc: 'USRC17607839' },
        external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
        artists: [{ id: 'artist-1', name: 'Artist One' }],
        album: {
          id: 'album-1',
          name: 'Current Album',
          release_date: '2026-05-22',
          images: [{ url: 'https://example.test/cover-large.jpg' }],
        },
      },
    });
  };

  const nowPlaying = await spotify.getNowPlaying();

  assert.equal(nowPlaying.isAvailable, true);
  assert.equal(nowPlaying.isPlaying, true);
  assert.equal(nowPlaying.progressMs, 42_000);
  assert.equal(nowPlaying.durationMs, 180_000);
  assert.equal(nowPlaying.albumCover, 'https://example.test/cover-large.jpg');
  assert.equal(nowPlaying.externalUrl, 'https://open.spotify.com/track/track-1');
  assert.equal(nowPlaying.currentlyPlayingType, 'track');
  assert.equal(nowPlaying.track.provider, 'spotify');
  assert.equal(nowPlaying.track.providerTrackId, 'track-1');
  assert.equal(nowPlaying.track.uri, 'spotify:track:track-1');
  assert.equal(nowPlaying.track.name, 'Current Song');
  assert.equal(nowPlaying.track.artistNames, 'Artist One');
  assert.equal(nowPlaying.track.albumName, 'Current Album');
  assert.equal(nowPlaying.track.durationMs, 180_000);
  assert.equal(nowPlaying.track.explicit, true);
  assert.equal(nowPlaying.track.isrc, 'USRC17607839');
  assert.match(nowPlaying.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('getNowPlaying returns unavailable when Spotify responds 204', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => new Response(null, { status: 204 });

  const nowPlaying = await spotify.getNowPlaying();

  assert.equal(nowPlaying.isAvailable, false);
  assert.equal(nowPlaying.reason, 'no_active_playback');
  assert.match(nowPlaying.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('getNowPlaying returns unavailable for non-track playback types', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse({
    is_playing: false,
    progress_ms: 1_000,
    currently_playing_type: 'episode',
    item: { id: 'episode-1' },
  });

  const nowPlaying = await spotify.getNowPlaying();

  assert.equal(nowPlaying.isAvailable, false);
  assert.equal(nowPlaying.reason, 'unsupported_type');
  assert.equal(nowPlaying.currentlyPlayingType, 'episode');
  assert.equal(nowPlaying.isPlaying, false);
  assert.equal(nowPlaying.progressMs, 1_000);
});

test('getNowPlaying clears auth and throws SPOTIFY_AUTH_EXPIRED on 401', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse({ error: { status: 401 } }, { status: 401 });

  await assert.rejects(
    () => spotify.getNowPlaying(),
    error => error.code === 'SPOTIFY_AUTH_EXPIRED'
  );

  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenExpiresAt), null);
});

test('getPlaybackState returns active device, shuffle, and repeat state', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.spotify.com/v1/me/player');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return jsonResponse({
      device: {
        id: 'device-1',
        is_active: true,
        is_private_session: false,
        is_restricted: false,
        name: 'Desk Mac',
        supports_volume: true,
        type: 'Computer',
        volume_percent: 66,
      },
      shuffle_state: true,
      repeat_state: 'context',
      timestamp: now - 500,
      is_playing: true,
      progress_ms: 42_000,
      currently_playing_type: 'track',
      item: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Current Song',
        duration_ms: 180_000,
        popularity: 73,
        explicit: true,
        external_ids: { isrc: 'USRC17607839' },
        external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
        artists: [{ id: 'artist-1', name: 'Artist One' }],
        album: {
          id: 'album-1',
          name: 'Current Album',
          release_date: '2026-05-22',
          images: [{ url: 'https://example.test/cover-large.jpg' }],
        },
      },
      context: {
        type: 'playlist',
        uri: 'spotify:playlist:playlist-1',
        external_urls: { spotify: 'https://open.spotify.com/playlist/playlist-1' },
      },
    });
  };

  const playbackState = await spotify.getPlaybackState();

  assert.equal(playbackState.isAvailable, true);
  assert.equal(playbackState.isPlaying, true);
  assert.equal(playbackState.shuffleState, true);
  assert.equal(playbackState.repeatState, 'context');
  assert.equal(playbackState.timestamp, now - 500);
  assert.deepEqual(playbackState.device, {
    id: 'device-1',
    isActive: true,
    isPrivateSession: false,
    isRestricted: false,
    name: 'Desk Mac',
    supportsVolume: true,
    type: 'Computer',
    volumePercent: 66,
  });
  assert.deepEqual(playbackState.context, {
    externalUrl: 'https://open.spotify.com/playlist/playlist-1',
    type: 'playlist',
    uri: 'spotify:playlist:playlist-1',
  });
  assert.equal(playbackState.track.name, 'Current Song');
});

test('getPlaybackState returns no active device when Spotify responds 204', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => new Response(null, { status: 204 });

  const playbackState = await spotify.getPlaybackState();

  assert.equal(playbackState.isAvailable, false);
  assert.equal(playbackState.reason, 'no_active_device');
  assert.equal(playbackState.device, null);
  assert.match(playbackState.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('getPlaybackState returns unavailable for non-track playback types with device state', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse({
    device: {
      id: 'phone-1',
      is_active: true,
      name: 'Phone',
      type: 'Smartphone',
    },
    is_playing: false,
    progress_ms: 1_000,
    repeat_state: 'off',
    shuffle_state: false,
    currently_playing_type: 'episode',
    item: { id: 'episode-1', type: 'episode' },
  });

  const playbackState = await spotify.getPlaybackState();

  assert.equal(playbackState.isAvailable, false);
  assert.equal(playbackState.reason, 'unsupported_type');
  assert.equal(playbackState.currentlyPlayingType, 'episode');
  assert.equal(playbackState.isPlaying, false);
  assert.equal(playbackState.progressMs, 1_000);
  assert.equal(playbackState.device.name, 'Phone');
  assert.equal(playbackState.shuffleState, false);
  assert.equal(playbackState.repeatState, 'off');
});

test('getPlaybackState surfaces missing playback scope as permission denied', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse({ error: { status: 403 } }, { status: 403 });

  await assert.rejects(
    () => spotify.getPlaybackState(),
    error => error.code === 'SPOTIFY_PERMISSION_DENIED'
  );

  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), 'valid-token');
});
