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
const sessionStorage = new MemoryStorage();
const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

globalThis.localStorage = storage;
globalThis.sessionStorage = sessionStorage;
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
  storage.setItem(STORAGE_KEYS.accessTokenScopes, SPOTIFY_CONFIG.scopes);
};

test.beforeEach(() => {
  storage.clear();
  sessionStorage.clear();
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
    return jsonResponse({ access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 120 });
  };

  assert.equal(await spotify.handleCallback(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.body.get('code'), 'auth-code');
  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), 'access-token');
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), 'refresh-token');
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
  storage.setItem(STORAGE_KEYS.accessTokenScopes, SPOTIFY_CONFIG.scopes);

  assert.equal(spotify.isLoggedIn(), true);
  assert.equal(
    storage.getItem(STORAGE_KEYS.accessTokenExpiresAt),
    String(now - 10_000 + SPOTIFY_CONFIG.tokenExpiry)
  );
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenTimestamp), null);
});

test('isLoggedIn keeps the session when an expired access token has a refresh token', () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.accessToken, 'expired-token');
  storage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(now - 1));
  storage.setItem(STORAGE_KEYS.accessTokenScopes, SPOTIFY_CONFIG.scopes);
  storage.setItem(STORAGE_KEYS.refreshToken, 'refresh-token');

  assert.equal(spotify.isLoggedIn(), true);
  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), 'expired-token');
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), 'refresh-token');
});

test('isLoggedIn clears legacy sessions when required Spotify scopes changed', () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.accessToken, 'old-token');
  storage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(now + 60_000));
  storage.setItem(STORAGE_KEYS.accessTokenScopes, 'playlist-read-private');
  storage.setItem(STORAGE_KEYS.refreshToken, 'refresh-token');

  assert.equal(spotify.isLoggedIn(), false);
  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenScopes), null);
});

test('Spotify scopes include playback state and control access', () => {
  assert.match(SPOTIFY_CONFIG.scopes, /user-library-modify/);
  assert.match(SPOTIFY_CONFIG.scopes, /user-read-currently-playing/);
  assert.match(SPOTIFY_CONFIG.scopes, /user-read-playback-state/);
  assert.match(SPOTIFY_CONFIG.scopes, /user-read-recently-played/);
  assert.match(SPOTIFY_CONFIG.scopes, /user-top-read/);
  assert.match(SPOTIFY_CONFIG.scopes, /user-modify-playback-state/);
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

test('apiCall refreshes an expired access token before making an API request', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.accessToken, 'expired-token');
  storage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(now - 1));
  storage.setItem(STORAGE_KEYS.accessTokenScopes, SPOTIFY_CONFIG.scopes);
  storage.setItem(STORAGE_KEYS.refreshToken, 'refresh-token');
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://accounts.spotify.com/api/token') {
      return jsonResponse({
        access_token: 'refreshed-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      });
    }
    assert.equal(options.headers.Authorization, 'Bearer refreshed-token');
    return jsonResponse({ id: 'user-1' });
  };

  assert.deepEqual(await spotify.apiCall('https://api.spotify.com/v1/me'), { id: 'user-1' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://accounts.spotify.com/api/token');
  assert.equal(calls[0].options.body.get('grant_type'), 'refresh_token');
  assert.equal(calls[0].options.body.get('refresh_token'), 'refresh-token');
  assert.equal(calls[0].options.body.get('client_id'), 'test-client-id');
  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), 'refreshed-token');
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), 'new-refresh-token');
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenExpiresAt), String(now + 3_600_000));
});

test('apiCall refreshes and retries once when Spotify returns 401', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  storage.setItem(STORAGE_KEYS.refreshToken, 'refresh-token');
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://api.spotify.com/v1/me' && calls.length === 1) {
      return jsonResponse({ error: { status: 401 } }, { status: 401 });
    }
    if (url === 'https://accounts.spotify.com/api/token') {
      return jsonResponse({
        access_token: 'refreshed-token',
        expires_in: 3600,
      });
    }
    assert.equal(options.headers.Authorization, 'Bearer refreshed-token');
    return jsonResponse({ id: 'user-1' });
  };

  assert.deepEqual(await spotify.apiCall('https://api.spotify.com/v1/me'), { id: 'user-1' });
  assert.deepEqual(calls.map(call => call.url), [
    'https://api.spotify.com/v1/me',
    'https://accounts.spotify.com/api/token',
    'https://api.spotify.com/v1/me',
  ]);
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), 'refresh-token');
});

test('apiCall clears auth when refresh token renewal fails', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.accessToken, 'expired-token');
  storage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(now - 1));
  storage.setItem(STORAGE_KEYS.accessTokenScopes, SPOTIFY_CONFIG.scopes);
  storage.setItem(STORAGE_KEYS.refreshToken, 'refresh-token');

  globalThis.fetch = async () => jsonResponse(
    { error: 'invalid_grant' },
    { status: 400 }
  );

  await assert.rejects(
    () => spotify.apiCall('https://api.spotify.com/v1/me'),
    error => error.code === 'SPOTIFY_AUTH_REFRESH_FAILED'
  );

  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenExpiresAt), null);
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), null);
});

test('apiCall asks for re-login when stored scopes are missing a required scope', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  storage.setItem(STORAGE_KEYS.accessToken, 'old-token');
  storage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(now + 60_000));
  storage.setItem(STORAGE_KEYS.accessTokenScopes, 'playlist-read-private');
  storage.setItem(STORAGE_KEYS.refreshToken, 'refresh-token');
  globalThis.fetch = async () => {
    assert.fail('API request should not run with missing required scopes');
  };

  await assert.rejects(
    () => spotify.apiCall('https://api.spotify.com/v1/me'),
    error => error.code === 'SPOTIFY_AUTH_SCOPE_CHANGED'
  );

  assert.equal(storage.getItem(STORAGE_KEYS.accessToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.refreshToken), null);
  assert.equal(storage.getItem(STORAGE_KEYS.accessTokenScopes), null);
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

test('getNowPlaying anchors progress to the local request midpoint', async () => {
  const now = 1_700_000_000_000;
  const timestamps = [now, now + 800];
  Date.now = () => timestamps.shift() ?? now + 800;
  setValidToken(now);

  globalThis.fetch = async () => jsonResponse({
    is_playing: true,
    progress_ms: 42_000,
    timestamp: now - 10_000,
    currently_playing_type: 'track',
    item: {
      id: 'track-1',
      uri: 'spotify:track:track-1',
      name: 'Current Song',
      duration_ms: 180_000,
      artists: [{ id: 'artist-1', name: 'Artist One' }],
      album: { id: 'album-1', name: 'Current Album' },
    },
  });

  const nowPlaying = await spotify.getNowPlaying();

  assert.equal(nowPlaying.fetchedAt, new Date(now + 400).toISOString());
  assert.equal(nowPlaying.timestamp, now - 10_000);
});

test('getNowPlaying preserves Spotify timestamp without using it as the progress anchor', async () => {
  const now = 1_700_000_000_000;
  const timestamps = [now, now + 800];
  Date.now = () => timestamps.shift() ?? now + 800;
  setValidToken(now);

  const playbackTimestamp = 1699999985000;

  globalThis.fetch = async () => jsonResponse({
    is_playing: true,
    progress_ms: 42_000,
    timestamp: playbackTimestamp,
    currently_playing_type: 'track',
    item: {
      id: 'track-1',
      uri: 'spotify:track:track-1',
      name: 'Current Song',
      duration_ms: 180_000,
      artists: [{ id: 'artist-1', name: 'Artist One' }],
      album: { id: 'album-1', name: 'Current Album' },
    },
  });

  const nowPlaying = await spotify.getNowPlaying();

  assert.equal(nowPlaying.fetchedAt, new Date(now + 400).toISOString());
  assert.equal(nowPlaying.timestamp, playbackTimestamp);
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

test('playback commands surface premium requirement distinctly from missing scopes', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse({
    error: {
      status: 403,
      message: 'Player command failed: Premium required',
      reason: 'PREMIUM_REQUIRED',
    },
  }, { status: 403 });

  await assert.rejects(
    () => spotify.playTrack('track-1'),
    error => error.code === 'SPOTIFY_PREMIUM_REQUIRED'
  );
});

test('getPlaybackQueue normalizes current queue tracks', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.spotify.com/v1/me/player/queue');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return jsonResponse({
      currently_playing: {
        id: 'track-1',
        uri: 'spotify:track:track-1',
        name: 'Current Song',
        duration_ms: 180_000,
        artists: [{ name: 'Artist One' }],
        album: {
          id: 'album-1',
          name: 'Current Album',
          images: [{ url: 'https://example.test/current.jpg' }],
        },
        external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
      },
      queue: [
        {
          id: 'track-2',
          uri: 'spotify:track:track-2',
          name: 'Next Song',
          duration_ms: 200_000,
          artists: [{ name: 'Artist Two' }],
          album: {
            id: 'album-2',
            name: 'Next Album',
            images: [{ url: 'https://example.test/next.jpg' }],
          },
          external_urls: { spotify: 'https://open.spotify.com/track/track-2' },
        },
        { id: 'episode-1', type: 'episode' },
      ],
    });
  };

  const queue = await spotify.getPlaybackQueue();

  assert.equal(queue.currentlyPlaying.track.name, 'Current Song');
  assert.equal(queue.currentlyPlaying.albumCover, 'https://example.test/current.jpg');
  assert.equal(queue.queue.length, 1);
  assert.equal(queue.queue[0].track.providerTrackId, 'track-2');
  assert.equal(queue.queue[0].track.artistNames, 'Artist Two');
});

test('getRecentlyPlayed normalizes recently played tracks', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.spotify.com/v1/me/player/recently-played?limit=10');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return jsonResponse({
      cursors: { after: '1700000000000', before: '1699990000000' },
      items: [
        {
          played_at: '2026-05-29T06:30:00Z',
          context: { uri: 'spotify:playlist:playlist-1' },
          track: {
            id: 'track-1',
            uri: 'spotify:track:track-1',
            name: 'Recent Song',
            duration_ms: 181_000,
            artists: [{ name: 'Artist One' }],
            album: {
              id: 'album-1',
              name: 'Recent Album',
              images: [{ url: 'https://example.test/recent.jpg' }],
            },
            external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
          },
        },
      ],
      next: 'https://api.spotify.com/v1/me/player/recently-played?before=1699990000000',
    });
  };

  const recentlyPlayed = await spotify.getRecentlyPlayed({ limit: 10 });

  assert.equal(recentlyPlayed.items.length, 1);
  assert.equal(recentlyPlayed.items[0].playedAt, '2026-05-29T06:30:00Z');
  assert.equal(recentlyPlayed.items[0].context.uri, 'spotify:playlist:playlist-1');
  assert.equal(recentlyPlayed.items[0].track.name, 'Recent Song');
  assert.equal(recentlyPlayed.next, 'https://api.spotify.com/v1/me/player/recently-played?before=1699990000000');
});

test('getTopTracks loads personalized top tracks', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.spotify.com/v1/me/top/tracks?limit=12&offset=0&time_range=short_term');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return jsonResponse({
      total: 1,
      items: [
        {
          id: 'track-1',
          uri: 'spotify:track:track-1',
          name: 'Top Song',
          duration_ms: 201_000,
          artists: [{ name: 'Artist One' }],
          album: {
            id: 'album-1',
            name: 'Top Album',
            images: [{ url: 'https://example.test/top.jpg' }],
          },
          external_urls: { spotify: 'https://open.spotify.com/track/track-1' },
        },
      ],
    });
  };

  const topTracks = await spotify.getTopTracks({ limit: 12, timeRange: 'short_term' });

  assert.equal(topTracks.total, 1);
  assert.equal(topTracks.items.length, 1);
  assert.equal(topTracks.items[0].track.name, 'Top Song');
  assert.equal(topTracks.items[0].albumCover, 'https://example.test/top.jpg');
});

test('getPlaylistById returns a playlist shell for chart playback', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);

  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      'https://api.spotify.com/v1/playlists/playlist-1?fields=id%2Cname%2Curi%2Cexternal_urls%2Cimages%2Cowner%28id%2Cdisplay_name%29%2Ctracks%28total%2Chref%29&market=US'
    );
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    return jsonResponse({
      id: 'playlist-1',
      name: 'Top 50 - USA',
      uri: 'spotify:playlist:playlist-1',
      images: [{ url: 'https://example.test/playlist.jpg' }],
      tracks: {
        total: 50,
        href: 'https://api.spotify.com/v1/playlists/playlist-1/tracks',
      },
    });
  };

  const playlist = await spotify.getPlaylistById('playlist-1', { market: 'US' });

  assert.equal(playlist.id, 'playlist-1');
  assert.equal(playlist.name, 'Top 50 - USA');
  assert.equal(playlist.tracks.href, 'https://api.spotify.com/v1/playlists/playlist-1/tracks');
});

test('getSavedTrackIds returns saved IDs from Spotify library contains endpoint', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse([true, false, true]);
  };

  const savedIds = await spotify.getSavedTrackIds([
    'spotify:track:track-1',
    { providerTrackId: 'track-2' },
    { uri: 'spotify:track:track-1' },
    'https://open.spotify.com/track/track-3?si=test',
  ]);

  assert.deepEqual(savedIds, ['track-1', 'track-3']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.spotify.com/v1/me/tracks/contains?ids=track-1,track-2,track-3');
  assert.equal(calls[0].options.method, 'GET');
});

test('saveTracks and removeSavedTracks call Spotify library mutation endpoints', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: JSON.parse(options.body) });
    return new Response(null, { status: 204 });
  };

  await spotify.saveTracks(['track-1', 'spotify:track:track-2']);
  await spotify.removeSavedTracks([{ id: 'track-1' }, { uri: 'spotify:track:track-2' }]);

  assert.deepEqual(calls, [
    {
      url: 'https://api.spotify.com/v1/me/tracks',
      method: 'PUT',
      body: { ids: ['track-1', 'track-2'] },
    },
    {
      url: 'https://api.spotify.com/v1/me/tracks',
      method: 'DELETE',
      body: { ids: ['track-1', 'track-2'] },
    },
  ]);
});

test('controlPlayback sends play and pause commands to the active device', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    return new Response(null, { status: 204 });
  };

  await spotify.controlPlayback('play', { deviceId: 'device-1' });
  await spotify.controlPlayback('pause', { deviceId: 'device-1' });

  assert.deepEqual(calls, [
    {
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/play?device_id=device-1',
    },
    {
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/pause?device_id=device-1',
    },
  ]);
});

test('playTrack starts a target track on the requested device', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: JSON.parse(options.body) });
    return new Response(null, { status: 204 });
  };

  await spotify.playTrack({ id: 'track-1' }, { deviceId: 'device-1', positionMs: 1250 });

  assert.deepEqual(calls, [
    {
      url: 'https://api.spotify.com/v1/me/player/play?device_id=device-1',
      method: 'PUT',
      body: {
        uris: ['spotify:track:track-1'],
        position_ms: 1250,
      },
    },
  ]);
});

test('playContext starts a Spotify context with an optional track offset', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: JSON.parse(options.body) });
    return new Response(null, { status: 204 });
  };

  await spotify.playContext('spotify:playlist:playlist-1', { offsetUri: { id: 'track-2' } });

  assert.deepEqual(calls, [
    {
      url: 'https://api.spotify.com/v1/me/player/play',
      method: 'PUT',
      body: {
        context_uri: 'spotify:playlist:playlist-1',
        offset: { uri: 'spotify:track:track-2' },
      },
    },
  ]);
});

test('target playback surfaces missing active device with a clear error', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => jsonResponse(
    { error: { status: 404, reason: 'NO_ACTIVE_DEVICE' } },
    { status: 404 }
  );

  await assert.rejects(
    () => spotify.playTrack('track-1'),
    error => error.code === 'SPOTIFY_NO_ACTIVE_DEVICE'
  );
});

test('controlPlayback accepts empty successful responses beyond 204', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  globalThis.fetch = async () => new Response(null, { status: 202 });

  assert.equal(await spotify.controlPlayback('pause'), null);
});

test('controlPlayback sends next, previous, shuffle, repeat, and seek commands', async () => {
  const now = 1_700_000_000_000;
  Date.now = () => now;
  setValidToken(now);
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    return new Response(null, { status: 204 });
  };

  await spotify.controlPlayback('next');
  await spotify.controlPlayback('previous');
  await spotify.controlPlayback('shuffle', { state: true, deviceId: 'device-1' });
  await spotify.controlPlayback('repeat', { state: 'track', deviceId: 'device-1' });
  await spotify.controlPlayback('seek', { positionMs: 42_500, deviceId: 'device-1' });

  assert.deepEqual(calls, [
    {
      method: 'POST',
      url: 'https://api.spotify.com/v1/me/player/next',
    },
    {
      method: 'POST',
      url: 'https://api.spotify.com/v1/me/player/previous',
    },
    {
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=device-1',
    },
    {
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/repeat?state=track&device_id=device-1',
    },
    {
      method: 'PUT',
      url: 'https://api.spotify.com/v1/me/player/seek?position_ms=42500&device_id=device-1',
    },
  ]);
});
