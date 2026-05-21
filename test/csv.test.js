import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeCSV, extractTrackUrisFromCSV, getSafeFileName, parseCSV, toCSV } from '../src/services/csv.js';

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
      recordLabel: 'Label "One"'
    }
  ]);

  assert.match(csv, /^Track URI,Track Name,Album Name,Artist Name\(s\),Release Date/);
  assert.match(csv, /spotify:track:123,"Song, ""Live""","Album\nName","Artist A,Artist B"/);
  assert.match(csv, /"pop,dance","Label ""One"""$/);
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
});
