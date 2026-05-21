import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeCSV, extractTrackUrisFromCSV, getSafeFileName, parseCSV, parseTracksFromCSV, toCSV } from '../src/services/csv.js';

test('escapeCSV quotes commas, quotes, and newlines', () => {
  assert.equal(escapeCSV('plain'), 'plain');
  assert.equal(escapeCSV('ACME, Inc.'), '"ACME, Inc."');
  assert.equal(escapeCSV('Live "Acoustic"'), '"Live ""Acoustic"""');
  assert.equal(escapeCSV('line 1\nline 2'), '"line 1\nline 2"');
  assert.equal(escapeCSV(null), '');
});

test('toCSV emits headers and escaped track fields', () => {
  const csv = toCSV([
    {
      uri: 'spotify:track:123',
      name: 'Song, "Live"',
      albumName: 'Album\nName',
      artistNames: 'Artist A,Artist B',
      releaseDate: '2026-05-20',
      durationMs: 180000,
      popularity: 88,
      explicit: 'No',
      addedBy: 'user-1',
      addedAt: '2026-05-20T10:00:00Z',
      genres: 'pop,dance',
      recordLabel: 'Label "One"',
      isrc: 'USRC17607839',
    }
  ]);

  assert.match(csv, /^Track URI,Track Name,Album Name,Artist Name\(s\),Release Date/);
  assert.match(csv, /Record Label,Provider,Provider Track ID,Provider Playlist ID,ISRC/);
  assert.match(csv, /spotify:track:123,"Song, ""Live""","Album\nName","Artist A,Artist B"/);
  assert.match(csv, /"pop,dance","Label ""One""",spotify,123,,USRC17607839/);
});

test('getSafeFileName keeps useful unicode and falls back when empty', () => {
  assert.equal(getSafeFileName('  Café / 热歌 Mix!  '), 'café_热歌_mix');
  assert.equal(getSafeFileName('日本語 Playlist 01'), '日本語_playlist_01');
  assert.equal(getSafeFileName('!!!'), 'playlist');
});

test('parseCSV and extractTrackUrisFromCSV handle quoted values and duplicate URIs', () => {
  const csv = [
    'Track URI,Track Name,Album Name',
    'spotify:track:1,"Song, One",Album A',
    'spotify:track:2,"Song ""Two""","Album',
    'B"',
    'spotify:track:1,Duplicate,Album C',
  ].join('\n');

  assert.deepEqual(parseCSV(csv), [
    ['Track URI', 'Track Name', 'Album Name'],
    ['spotify:track:1', 'Song, One', 'Album A'],
    ['spotify:track:2', 'Song "Two"', 'Album\nB'],
    ['spotify:track:1', 'Duplicate', 'Album C'],
  ]);
  assert.deepEqual(extractTrackUrisFromCSV(csv), ['spotify:track:1', 'spotify:track:2']);
  assert.deepEqual(extractTrackUrisFromCSV(csv, { dedupe: false }), [
    'spotify:track:1',
    'spotify:track:2',
    'spotify:track:1',
  ]);
});

test('parseTracksFromCSV accepts old and platform-neutral columns', () => {
  const csv = [
    'Track URI,Track Name,Album Name,Artist Name(s),Release Date,Duration (ms),Popularity,Explicit,Added By,Added At,Genres,Record Label,Provider,Provider Track ID,Provider Playlist ID,ISRC',
    'spotify:track:1,Song A,Album A,Artist A,2020,180000,55,Yes,user-1,2026-05-20T10:00:00Z,pop,Label A,spotify,1,playlist-1,USRC17607839',
    ',Song B,Album B,Artist B,2021,160000,40,No,,,,Label B,spotify,2,playlist-1,',
  ].join('\n');

  const tracks = parseTracksFromCSV(csv);

  assert.deepEqual(tracks.map(track => ({
    provider: track.provider,
    providerTrackId: track.providerTrackId,
    providerPlaylistId: track.providerPlaylistId,
    uri: track.uri,
    isrc: track.isrc,
    artists: track.artists,
    albumName: track.albumName,
    explicit: track.explicit,
  })), [
    {
      provider: 'spotify',
      providerTrackId: '1',
      providerPlaylistId: 'playlist-1',
      uri: 'spotify:track:1',
      isrc: 'USRC17607839',
      artists: ['Artist A'],
      albumName: 'Album A',
      explicit: true,
    },
    {
      provider: 'spotify',
      providerTrackId: '2',
      providerPlaylistId: 'playlist-1',
      uri: 'spotify:track:2',
      isrc: '',
      artists: ['Artist B'],
      albumName: 'Album B',
      explicit: false,
    },
  ]);
  assert.deepEqual(extractTrackUrisFromCSV(csv, { dedupe: false }), [
    'spotify:track:1',
    'spotify:track:2',
  ]);
});
