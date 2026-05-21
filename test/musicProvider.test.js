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
