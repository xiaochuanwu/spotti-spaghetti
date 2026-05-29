import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chunkArray,
  enrichTracksWithMetadata,
  getUniqueMetadataIds,
  mapAlbumLabels,
  mapArtistGenres,
  mapPlaylistTrackItem,
  mapPreviewTrackItem,
} from '../src/services/spotifyMapper.js';

const spotifyTrackItem = {
  added_at: '2026-05-20T10:00:00Z',
  added_by: { id: 'owner-1' },
  track: {
    id: 'track-1',
    uri: 'spotify:track:1',
    name: 'Test Track',
    artists: [
      { id: 'artist-1', name: 'Artist One' },
      { id: 'artist-2', name: 'Artist Two' },
    ],
    album: {
      id: 'album-1',
      name: 'Test Album',
      release_date: '2026-05-20',
      images: [
        { url: 'large.jpg' },
        { url: 'medium.jpg' },
        { url: 'small.jpg' },
      ],
    },
    duration_ms: 215000,
    popularity: 77,
    explicit: true,
    external_ids: { isrc: 'USRC17607839' },
    external_urls: { spotify: 'https://open.spotify.com/track/1' },
  },
};

test('mapPlaylistTrackItem normalizes Spotify playlist items for export', () => {
  assert.deepEqual(mapPlaylistTrackItem(spotifyTrackItem), {
    provider: 'spotify',
    providerTrackId: 'track-1',
    providerPlaylistId: '',
    artists: ['artist-1', 'artist-2'],
    artistNames: ['Artist One', 'Artist Two'],
    albumId: 'album-1',
    albumName: 'Test Album',
    uri: 'spotify:track:1',
    isrc: 'USRC17607839',
    name: 'Test Track',
    releaseDate: '2026-05-20',
    durationMs: 215000,
    popularity: 77,
    explicit: true,
    addedById: 'owner-1',
    addedAt: '2026-05-20T10:00:00Z',
  });

  assert.equal(mapPlaylistTrackItem({ track: null }), null);
});

test('metadata helpers dedupe artist and album ids', () => {
  const tracks = [
    mapPlaylistTrackItem(spotifyTrackItem),
    {
      ...mapPlaylistTrackItem(spotifyTrackItem),
      artists: ['artist-2', 'artist-3'],
      albumId: 'album-2',
    },
  ];

  assert.deepEqual(getUniqueMetadataIds(tracks), {
    artistIds: ['artist-1', 'artist-2', 'artist-3'],
    albumIds: ['album-1', 'album-2'],
  });

  assert.deepEqual(chunkArray(['a', 'b', 'c', 'd', 'e'], 2), [['a', 'b'], ['c', 'd'], ['e']]);
});

test('enrichTracksWithMetadata maps genres and record labels back to CSV fields', () => {
  const track = mapPlaylistTrackItem(spotifyTrackItem);
  const artistGenres = mapArtistGenres([
    { id: 'artist-1', genres: ['pop', 'dance'] },
    { id: 'artist-2', genres: ['dance', 'indie'] },
  ]);
  const albumLabels = mapAlbumLabels([
    { id: 'album-1', label: 'Test Label' },
  ]);

  assert.deepEqual(enrichTracksWithMetadata([track], artistGenres, albumLabels), [
    {
      modelVersion: 1,
      provider: 'spotify',
      providerTrackId: 'track-1',
      providerPlaylistId: '',
      uri: 'spotify:track:1',
      isrc: 'USRC17607839',
      name: 'Test Track',
      artists: ['Artist One', 'Artist Two'],
      albumName: 'Test Album',
      album: { providerAlbumId: 'album-1', name: 'Test Album' },
      artistNames: 'Artist One,Artist Two',
      releaseDate: '2026-05-20',
      durationMs: 215000,
      popularity: 77,
      explicit: 'Yes',
      explicitLabel: 'Yes',
      addedBy: 'owner-1',
      addedAt: '2026-05-20T10:00:00Z',
      genres: ['pop', 'dance', 'indie'],
      genreNames: 'pop,dance,indie',
      recordLabel: 'Test Label',
      rawSource: null,
    },
  ]);
});

test('mapPreviewTrackItem creates compact modal data', () => {
  assert.deepEqual(mapPreviewTrackItem(spotifyTrackItem), {
    id: 'track-1',
    uri: 'spotify:track:1',
    name: 'Test Track',
    artists: 'Artist One, Artist Two',
    albumName: 'Test Album',
    albumCover: 'small.jpg',
    durationMs: 215000,
    externalUrl: 'https://open.spotify.com/track/1',
  });

  assert.equal(mapPreviewTrackItem({ track: null }), null);
});

test('mapPreviewTrackItem accepts playlist item payloads that use item', () => {
  assert.deepEqual(mapPreviewTrackItem({
    item: spotifyTrackItem.track,
  }), {
    id: 'track-1',
    uri: 'spotify:track:1',
    name: 'Test Track',
    artists: 'Artist One, Artist Two',
    albumName: 'Test Album',
    albumCover: 'small.jpg',
    durationMs: 215000,
    externalUrl: 'https://open.spotify.com/track/1',
  });
});

test('mapPreviewTrackItem accepts direct Spotify track payloads from search-like responses', () => {
  assert.deepEqual(mapPreviewTrackItem(spotifyTrackItem.track), {
    id: 'track-1',
    uri: 'spotify:track:1',
    name: 'Test Track',
    artists: 'Artist One, Artist Two',
    albumName: 'Test Album',
    albumCover: 'small.jpg',
    durationMs: 215000,
    externalUrl: 'https://open.spotify.com/track/1',
  });
});

test('mapPreviewTrackItem leaves display fallbacks to the UI layer', () => {
  assert.deepEqual(mapPreviewTrackItem({
    track: {
      id: 'track-2',
      name: 'Sparse Track',
      artists: [],
      album: {},
      duration_ms: 90000,
      external_urls: {},
    },
  }), {
    id: 'track-2',
    uri: undefined,
    name: 'Sparse Track',
    artists: '',
    albumName: '',
    albumCover: '',
    durationMs: 90000,
    externalUrl: undefined,
  });
});
