import test from 'node:test';
import assert from 'node:assert/strict';

import { exportHistory } from '../src/services/exportHistory.js';

test('compare returns added, removed, and unchanged tracks', () => {
  const previous = {
    tracks: [
      { uri: 'spotify:track:1', name: 'Old Song', artistNames: 'Artist A' },
      { uri: 'spotify:track:2', name: 'Shared Song', artistNames: 'Artist B' },
    ],
  };
  const current = {
    tracks: [
      { uri: 'spotify:track:2', name: 'Shared Song', artistNames: 'Artist B' },
      { uri: 'spotify:track:3', name: 'New Song', artistNames: 'Artist C' },
    ],
  };

  assert.deepEqual(exportHistory.compare(current, previous), {
    added: [{ uri: 'spotify:track:3', name: 'New Song', artistNames: 'Artist C' }],
    removed: [{ uri: 'spotify:track:1', name: 'Old Song', artistNames: 'Artist A' }],
    unchanged: [{ uri: 'spotify:track:2', name: 'Shared Song', artistNames: 'Artist B' }],
    unchangedCount: 1,
  });
});
