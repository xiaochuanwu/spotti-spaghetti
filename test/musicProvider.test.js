import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertMusicProvider,
  REQUIRED_PROVIDER_METHODS,
} from '../src/services/providers/musicProvider.js';

const createProvider = (overrides = {}) => ({
  id: 'test',
  ...Object.fromEntries(REQUIRED_PROVIDER_METHODS.map(method => [method, () => null])),
  ...overrides,
});

test('assertMusicProvider accepts a complete provider contract', () => {
  const provider = createProvider();
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider rejects missing provider methods', () => {
  const provider = createProvider({ searchTracks: undefined });

  assert.throws(
    () => assertMusicProvider(provider),
    /Invalid music provider: searchTracks/
  );
});

test('assertMusicProvider requires getNowPlaying when nowPlaying capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { nowPlaying: true } })),
    /Invalid music provider: getNowPlaying/
  );

  const provider = createProvider({
    capabilities: { nowPlaying: true },
    getNowPlaying: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires getPlaybackState when playbackState capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { playbackState: true } })),
    /Invalid music provider: getPlaybackState/
  );

  const provider = createProvider({
    capabilities: { playbackState: true },
    getPlaybackState: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires controlPlayback when playbackControl capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { playbackControl: true } })),
    /Invalid music provider: controlPlayback/
  );

  const provider = createProvider({
    capabilities: { playbackControl: true },
    controlPlayback: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires saved-track methods when trackLibrary capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { trackLibrary: true } })),
    /Invalid music provider: getSavedTrackIds, saveTracks, removeSavedTracks/
  );

  const provider = createProvider({
    capabilities: { trackLibrary: true },
    getSavedTrackIds: () => null,
    saveTracks: () => null,
    removeSavedTracks: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires target playback methods when contextualPlayback capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { contextualPlayback: true } })),
    /Invalid music provider: playTrack, playContext/
  );

  const provider = createProvider({
    capabilities: { contextualPlayback: true },
    playTrack: () => null,
    playContext: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires queue methods when playbackQueue capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { playbackQueue: true } })),
    /Invalid music provider: getPlaybackQueue, getRecentlyPlayed/
  );

  const provider = createProvider({
    capabilities: { playbackQueue: true },
    getPlaybackQueue: () => null,
    getRecentlyPlayed: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires personalization methods when personalization capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { personalization: true } })),
    /Invalid music provider: getTopTracks/
  );

  const provider = createProvider({
    capabilities: { personalization: true },
    getTopTracks: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('assertMusicProvider requires playlist lookup methods when catalogPlaylists capability is enabled', () => {
  assert.throws(
    () => assertMusicProvider(createProvider({ capabilities: { catalogPlaylists: true } })),
    /Invalid music provider: getPlaylistById/
  );

  const provider = createProvider({
    capabilities: { catalogPlaylists: true },
    getPlaylistById: () => null,
  });
  assert.equal(assertMusicProvider(provider), provider);
});

test('provider registry returns the registered Spotify provider', async () => {
  globalThis.sessionStorage = globalThis.sessionStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  globalThis.window = globalThis.window || {
    location: { origin: 'http://localhost:5173' },
  };

  const {
    DEFAULT_PROVIDER_ID,
    getMusicProvider,
    listMusicProviders,
  } = await import('../src/services/providers/providerRegistry.js');

  const providers = listMusicProviders();
  const provider = getMusicProvider();

  assert.equal(DEFAULT_PROVIDER_ID, 'spotify');
  assert.equal(providers.length, 1);
  assert.equal(provider.id, 'spotify');
  assert.equal(typeof provider.getErrorInfo, 'function');
  assert.equal(provider.capabilities.nowPlaying, true);
  assert.equal(provider.capabilities.playbackControl, true);
  assert.equal(provider.capabilities.playbackState, true);
  assert.equal(provider.capabilities.trackLibrary, true);
  assert.equal(provider.capabilities.contextualPlayback, true);
  assert.equal(provider.capabilities.playbackQueue, true);
  assert.equal(provider.capabilities.personalization, true);
  assert.equal(provider.capabilities.catalogPlaylists, true);
  assert.equal(typeof provider.controlPlayback, 'function');
  assert.equal(typeof provider.getNowPlaying, 'function');
  assert.equal(typeof provider.getPlaybackState, 'function');
  assert.equal(typeof provider.getSavedTrackIds, 'function');
  assert.equal(typeof provider.saveTracks, 'function');
  assert.equal(typeof provider.removeSavedTracks, 'function');
  assert.equal(typeof provider.playTrack, 'function');
  assert.equal(typeof provider.playContext, 'function');
  assert.equal(typeof provider.getPlaybackQueue, 'function');
  assert.equal(typeof provider.getRecentlyPlayed, 'function');
  assert.equal(typeof provider.getTopTracks, 'function');
  assert.equal(typeof provider.getPlaylistById, 'function');
  assert.equal(
    provider.getErrorInfo({ code: 'SPOTIFY_PLAYBACK_TARGET_REQUIRED' }).translationKey,
    'error.spotifyPlaybackTargetRequired'
  );
  assert.equal(provider, getMusicProvider('spotify'));
  assert.throws(() => getMusicProvider('apple_music'), /Unknown music provider: apple_music/);
});
