import test from 'node:test';
import assert from 'node:assert/strict';

import {
  exportHistory,
  getTrackUrisFromSnapshot,
  normalizeHistorySnapshot,
} from '../src/services/exportHistory.js';

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

test('normalizeHistorySnapshot keeps imported records compatible', () => {
  const snapshot = normalizeHistorySnapshot({
    playlistName: 'Imported',
    createdAt: '2026-05-20T10:00:00Z',
    tracks: [
      { uri: 'spotify:track:1', name: 'Song One', artistNames: 'Artist A', extra: 'ignored' },
      { uri: '', name: 'Metadata-only row' },
      null,
    ],
  });

  assert.equal(snapshot.playlistId, 'Imported');
  assert.equal(snapshot.trackCount, 2);
  assert.deepEqual(snapshot.tracks, [
    {
      uri: 'spotify:track:1',
      name: 'Song One',
      albumName: undefined,
      artistNames: 'Artist A',
      releaseDate: undefined,
      durationMs: undefined,
      popularity: undefined,
      explicit: undefined,
      genres: undefined,
      recordLabel: undefined,
    },
    {
      uri: '',
      name: 'Metadata-only row',
      albumName: undefined,
      artistNames: undefined,
      releaseDate: undefined,
      durationMs: undefined,
      popularity: undefined,
      explicit: undefined,
      genres: undefined,
      recordLabel: undefined,
    },
  ]);
  assert.deepEqual(getTrackUrisFromSnapshot(snapshot), ['spotify:track:1']);
});
