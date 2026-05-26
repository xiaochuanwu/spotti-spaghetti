import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNeteaseLyricsClient,
  parseNeteaseLyricResponse,
  selectBestNeteaseMatch,
} from '../src/services/neteaseLyrics.js';

test('parseNeteaseLyricResponse parses synced lyrics and translations', () => {
  const lines = parseNeteaseLyricResponse({
    lrc: {
      lyric: '[00:01.000]Hello\n[00:03.250]World',
    },
    tlyric: {
      lyric: '[00:01.000]你好\n[00:03.260]世界',
    },
  });

  assert.deepEqual(lines, [
    { timeMs: 1000, text: 'Hello', translation: '你好' },
    { timeMs: 3250, text: 'World', translation: '世界' },
  ]);
});

test('selectBestNeteaseMatch prefers title, artist, and duration matches', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Yellow Submarine',
      duration: 158000,
      artists: [{ name: 'The Beatles' }],
    },
    {
      id: 2,
      name: 'Yellow',
      duration: 266773,
      artists: [{ name: 'Coldplay' }],
    },
  ], {
    artistNames: 'Coldplay',
    durationMs: 266000,
    name: 'Yellow',
  });

  assert.equal(match.id, 2);
});

test('selectBestNeteaseMatch rejects exact-title results from unrelated artists', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Shared Title (feat. Guest Vocal)',
      duration: 180000,
      artists: [{ name: 'Unrelated Singer' }, { name: 'Another Guest' }],
      album: { name: 'Cover Collection' },
    },
    {
      id: 2,
      name: 'Shared Title',
      duration: 180386,
      artists: [{ name: 'Primary Artist' }, { name: 'Featured Artist' }],
      album: { name: 'Target Album' },
    },
  ], {
    albumName: 'Target Album',
    artistNames: 'Primary Artist,Featured Artist',
    artists: ['Primary Artist', 'Featured Artist'],
    durationMs: 180386,
    name: 'Shared Title (feat. Featured Artist)',
  });

  assert.equal(match.id, 2);
});

test('selectBestNeteaseMatch returns null when title matches but artists do not', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Shared Title',
      duration: 180386,
      artists: [{ name: 'Unrelated Singer' }, { name: 'Another Guest' }],
    },
  ], {
    artistNames: 'Primary Artist,Featured Artist',
    artists: ['Primary Artist', 'Featured Artist'],
    durationMs: 180386,
    name: 'Shared Title',
  });

  assert.equal(match, null);
});

test('selectBestNeteaseMatch rejects mismatching versions (Acoustic vs Original, Part 1 vs Part 2)', () => {
  // Acoustic vs Original
  const acousticMatch = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Song Name (Acoustic)',
      duration: 180000,
      artists: [{ name: 'Primary Artist' }],
    },
  ], {
    artistNames: 'Primary Artist',
    durationMs: 180000,
    name: 'Song Name',
  });
  assert.equal(acousticMatch, null);

  // Part 1 vs Part 2
  const partMatch = selectBestNeteaseMatch([
    {
      id: 2,
      name: 'Song Name, Pt. 2',
      duration: 180000,
      artists: [{ name: 'Primary Artist' }],
    },
  ], {
    artistNames: 'Primary Artist',
    durationMs: 180000,
    name: 'Song Name, Pt. 1',
  });
  assert.equal(partMatch, null);
});

test('createNeteaseLyricsClient cleans search queries', async () => {
  const queries = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      queries.push(url);
      return {
        ok: true,
        async json() {
          return { result: { songs: [] } };
        },
      };
    },
  });

  await client.getLyricsForTrack({
    name: 'Song (feat. Artist B) / Extra Tag',
    artistNames: 'Artist A, Artist B',
    albumName: 'Album / Title',
    durationMs: 180000,
  });

  assert.match(queries[0], /s=Song\+feat\+Artist\+B\+Extra\+Tag\+Artist\+A\+Artist\+B\+Album\+Title/);
  assert.match(queries[1], /s=Song\+feat\+Artist\+B\+Extra\+Tag\+Artist\+A/);
  assert.match(queries[2], /s=Song\+Extra\+Tag\+Artist\+A/);
});

test('createNeteaseLyricsClient tries ISRC search before text search', async () => {
  const requests = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.includes('/search/get')) {
        return {
          ok: true,
          async json() {
            return {
              result: {
                songs: url.includes('USGEN2600001') ? [{
                  id: 2,
                  name: 'Indexed Song',
                  duration: 180386,
                  artists: [{ name: 'Primary Artist' }, { name: 'Featured Artist' }],
                  album: { name: 'Indexed Album' },
                }] : [],
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            lrc: { lyric: '[00:02.000]Okay, okay, okay, okay' },
          };
        },
      };
    },
  });

  const result = await client.getLyricsForTrack({
    albumName: 'Indexed Album',
    artistNames: 'Primary Artist,Featured Artist',
    artists: ['Primary Artist', 'Featured Artist'],
    durationMs: 180386,
    isrc: 'USGEN2600001',
    name: 'Indexed Song',
  });

  assert.equal(result.sourceTrack.id, 2);
  assert.equal(requests.length, 2);
  assert.match(requests[0], /USGEN2600001/);
});

test('createNeteaseLyricsClient searches and loads lyric lines', async () => {
  const requests = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.includes('/search/get')) {
        return {
          ok: true,
          async json() {
            return {
              result: {
                songs: [{
                  id: 2,
                  name: 'Yellow',
                  duration: 266773,
                  artists: [{ name: 'Coldplay' }],
                }],
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return {
            lrc: { lyric: '[00:02.000]Look at the stars' },
            tlyric: { lyric: '[00:02.000]看看星星' },
          };
        },
      };
    },
  });

  const result = await client.getLyricsForTrack({
    artistNames: 'Coldplay',
    durationMs: 266000,
    name: 'Yellow',
  });

  assert.equal(result.sourceTrack.id, 2);
  assert.deepEqual(result.lines, [{
    timeMs: 2000,
    text: 'Look at the stars',
    translation: '看看星星',
  }]);
  assert.equal(requests.length, 2);
});
