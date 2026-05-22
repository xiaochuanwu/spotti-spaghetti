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
  assert.equal(typeof provider.getNowPlaying, 'function');
  assert.equal(provider, getMusicProvider('spotify'));
  assert.throws(() => getMusicProvider('apple_music'), /Unknown music provider: apple_music/);
});
