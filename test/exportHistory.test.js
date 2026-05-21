import test from 'node:test';
import assert from 'node:assert/strict';

import {
  exportHistory,
  getTrackUrisFromSnapshot,
  normalizeHistorySnapshot,
} from '../src/services/exportHistory.js';

const pickTrackSummary = (track) => ({
  provider: track.provider,
  providerTrackId: track.providerTrackId,
  uri: track.uri,
  name: track.name,
  artistNames: track.artistNames,
  albumName: track.albumName,
  explicit: track.explicit,
  genres: track.genres,
});

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

  const comparison = exportHistory.compare(current, previous);

  assert.deepEqual({
    added: comparison.added.map(pickTrackSummary),
    removed: comparison.removed.map(pickTrackSummary),
    unchanged: comparison.unchanged.map(pickTrackSummary),
    unchangedCount: comparison.unchangedCount,
  }, {
    added: [{
      provider: 'spotify',
      providerTrackId: '3',
      uri: 'spotify:track:3',
      name: 'New Song',
      artistNames: 'Artist C',
      albumName: '',
      explicit: null,
      genres: [],
    }],
    removed: [{
      provider: 'spotify',
      providerTrackId: '1',
      uri: 'spotify:track:1',
      name: 'Old Song',
      artistNames: 'Artist A',
      albumName: '',
      explicit: null,
      genres: [],
    }],
    unchanged: [{
      provider: 'spotify',
      providerTrackId: '2',
      uri: 'spotify:track:2',
      name: 'Shared Song',
      artistNames: 'Artist B',
      albumName: '',
      explicit: null,
      genres: [],
    }],
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
  assert.equal(snapshot.modelVersion, 1);
  assert.equal(snapshot.provider, 'spotify');
  assert.deepEqual(snapshot.tracks.map(pickTrackSummary), [
    {
      provider: 'spotify',
      providerTrackId: '1',
      uri: 'spotify:track:1',
      name: 'Song One',
      albumName: '',
      artistNames: 'Artist A',
      explicit: null,
      genres: [],
    },
    {
      provider: 'spotify',
      providerTrackId: '',
      uri: '',
      name: 'Metadata-only row',
      albumName: '',
      artistNames: '',
      explicit: null,
      genres: [],
    },
  ]);
  assert.deepEqual(getTrackUrisFromSnapshot(snapshot), ['spotify:track:1']);
});

test('compare can match non-Spotify tracks by ISRC before falling back to URI', () => {
  const previous = {
    provider: 'apple_music',
    tracks: [
      { provider: 'apple_music', providerTrackId: 'apple-1', isrc: 'USRC17607839', name: 'Shared Song' },
    ],
  };
  const current = {
    provider: 'spotify',
    tracks: [
      { provider: 'spotify', providerTrackId: 'spotify-1', isrc: 'USRC17607839', name: 'Shared Song' },
    ],
  };

  assert.equal(exportHistory.compare(current, previous).unchangedCount, 1);
});
