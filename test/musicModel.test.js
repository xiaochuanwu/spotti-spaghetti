import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPlaylistIdentity,
  getTrackIdentity,
  normalizePlaylist,
  normalizeTrack,
} from '../src/services/musicModel.js';

test('normalizeTrack creates a platform-neutral track with legacy display aliases', () => {
  const track = normalizeTrack({
    uri: 'spotify:track:abc123',
    name: 'Song',
    artistNames: 'Artist A,Artist B',
    albumName: 'Album',
    genres: 'pop,dance',
    explicit: 'Yes',
  }, {
    providerPlaylistId: 'playlist-1',
  });

  assert.deepEqual({
    provider: track.provider,
    providerTrackId: track.providerTrackId,
    providerPlaylistId: track.providerPlaylistId,
    uri: track.uri,
    artists: track.artists,
    artistNames: track.artistNames,
    albumName: track.albumName,
    genres: track.genres,
    genreNames: track.genreNames,
    explicit: track.explicit,
    explicitLabel: track.explicitLabel,
  }, {
    provider: 'spotify',
    providerTrackId: 'abc123',
    providerPlaylistId: 'playlist-1',
    uri: 'spotify:track:abc123',
    artists: ['Artist A', 'Artist B'],
    artistNames: 'Artist A,Artist B',
    albumName: 'Album',
    genres: ['pop', 'dance'],
    genreNames: 'pop,dance',
    explicit: true,
    explicitLabel: 'Yes',
  });
});

test('track identity prefers ISRC for cross-provider matching', () => {
  assert.equal(
    getTrackIdentity({ provider: 'spotify', providerTrackId: '1', isrc: 'usrc17607839' }),
    'isrc:USRC17607839'
  );
  assert.equal(
    getTrackIdentity({ provider: 'apple_music', providerTrackId: 'am-1', name: 'Song' }),
    'apple_music:track:am-1'
  );
});

test('normalizePlaylist creates stable provider playlist identity', () => {
  const playlist = normalizePlaylist({
    provider: 'spotify',
    id: 'playlist-1',
    name: 'Playlist',
    tracks: { total: 12 },
  });

  assert.equal(playlist.providerPlaylistId, 'playlist-1');
  assert.equal(playlist.trackCount, 12);
  assert.equal(getPlaylistIdentity(playlist), 'spotify:playlist:playlist-1');
});
