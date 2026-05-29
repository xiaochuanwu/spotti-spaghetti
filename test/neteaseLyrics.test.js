import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNeteaseLyricsClient,
  parseNeteaseLyricResponse,
  selectBestNeteaseMatch,
} from '../src/services/neteaseLyrics.js';

const getRequestPathname = (url) => new URL(url, 'http://localhost').pathname;

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

test('parseNeteaseLyricResponse downgrades word-synced lyrics to line-synced lyrics', () => {
  const lines = parseNeteaseLyricResponse({
    yrc: {
      lyric: [
        '[1000,1500](1000,500,0)Hello (1500,500,0)world',
        '[00:03.000]<3000,500,0>Again',
      ].join('\n'),
    },
  });

  assert.deepEqual(lines, [
    { timeMs: 1000, text: 'Hello world' },
    { timeMs: 3000, text: 'Again' },
  ]);
});

test('parseNeteaseLyricResponse falls back to word-synced lyrics when LRC only has info lines', () => {
  const lines = parseNeteaseLyricResponse({
    lrc: {
      lyric: '[00:00.000]作词: Example Writer',
    },
    yrc: {
      lyric: '[1200,900](1200,450,0)Real lyric',
    },
  });

  assert.deepEqual(lines, [
    { timeMs: 1200, text: 'Real lyric' },
  ]);
});

test('parseNeteaseLyricResponse falls back to plain unsynced lyrics', () => {
  const lines = parseNeteaseLyricResponse({
    lrc: {
      lyric: [
        '作词 : Example Writer',
        '第一句歌词',
        '第二句歌词',
      ].join('\n'),
    },
  });

  assert.deepEqual(lines, [
    { isSynced: false, lineIndex: 1, text: '第一句歌词', timeMs: null },
    { isSynced: false, lineIndex: 2, text: '第二句歌词', timeMs: null },
  ]);
});

test('parseNeteaseLyricResponse removes common credit and copyright lines', () => {
  const lines = parseNeteaseLyricResponse({
    lrc: {
      lyric: [
        '[00:00.000]作词: Example Writer',
        '[00:01.000]First lyric line',
        '[00:02.000]未经许可不得翻唱或使用',
        '[00:03.000]Second lyric line',
      ].join('\n'),
    },
  });

  assert.deepEqual(lines, [
    { timeMs: 1000, text: 'First lyric line' },
    { timeMs: 3000, text: 'Second lyric line' },
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
  assert.equal(match.matchScore > 0, true);
  assert.ok(match.matchReasons.some((reason) => reason.type === 'title' && reason.score > 0));
  assert.ok(match.matchReasons.some((reason) => reason.type === 'artist' && reason.score > 0));
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

test('selectBestNeteaseMatch normalizes Chinese script variants before scoring', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: '亲爱的梦',
      duration: 204000,
      artists: [{ name: '测试歌手' }],
      album: { name: '现场专辑' },
    },
  ], {
    albumName: '現場專輯',
    artistNames: '測試歌手',
    artists: ['測試歌手'],
    durationMs: 204100,
    name: '親愛的夢',
  });

  assert.equal(match.id, 1);
});

test('selectBestNeteaseMatch accepts CJK title and duration when artist names use different scripts', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: '晴天 (原唱 周杰伦)',
      duration: 270738,
      artists: [{ name: 'RyaVocal' }],
      album: { name: '晴天' },
    },
  ], {
    albumName: 'Ye Hui Mei',
    artistNames: 'Jay Chou',
    artists: ['Jay Chou'],
    durationMs: 269000,
    name: '晴天',
  });

  assert.equal(match.id, 1);
  assert.ok(match.matchReasons.some((reason) => (
    reason.type === 'artist' && reason.detail.includes('CJK title and duration')
  )));
});

test('selectBestNeteaseMatch scores candidate aliases and translated names', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Original Title',
      transNames: ['Translated Title'],
      duration: 204000,
      artists: [{ name: 'Primary Artist', alias: ['主唱'] }],
      album: { name: 'Original Album', transNames: ['Translated Album'] },
    },
  ], {
    albumName: 'Translated Album',
    artistNames: '主唱',
    artists: ['主唱'],
    durationMs: 204000,
    name: 'Translated Title',
  });

  assert.equal(match.id, 1);
});

test('selectBestNeteaseMatch splits composite artist names from provider metadata', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Duet Song',
      duration: 180000,
      artists: [{ name: 'Primary Artist' }, { name: 'Featured Artist' }],
    },
  ], {
    artistNames: 'Primary Artist & Featured Artist',
    durationMs: 180000,
    name: 'Duet Song',
  });

  assert.equal(match.id, 1);
});

test('selectBestNeteaseMatch accepts compilation artist labels for large ensembles', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Festival Song',
      duration: 240000,
      artists: [{ name: '群星' }],
    },
  ], {
    artists: [
      'Artist A',
      'Artist B',
      'Artist C',
      'Artist D',
      'Artist E',
      'Artist F',
    ],
    durationMs: 240000,
    name: 'Festival Song',
  });

  assert.equal(match.id, 1);
});

test('selectBestNeteaseMatch rejects large duration mismatches for synced lyrics', () => {
  const match = selectBestNeteaseMatch([
    {
      id: 1,
      name: 'Same Song',
      duration: 220000,
      artists: [{ name: 'Primary Artist' }],
    },
  ], {
    artistNames: 'Primary Artist',
    durationMs: 180000,
    name: 'Same Song',
  });

  assert.equal(match, null);
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

  const searchTerms = queries.map((url) => new URL(url, 'http://localhost').searchParams.get('s'));
  assert.equal(searchTerms[0], 'Song feat Artist B Extra Tag Artist A Artist B Album Title');
  assert.ok(searchTerms.includes('Song feat Artist B Extra Tag Artist A'));
  assert.ok(searchTerms.includes('Song Extra Tag Artist A'));
});

test('createNeteaseLyricsClient tries normalized Chinese query variants before original text', async () => {
  const requests = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (getRequestPathname(url) === '/netease-api/search/get') {
        const query = new URL(url, 'http://localhost').searchParams.get('s');
        return {
          ok: true,
          async json() {
            return {
              result: {
                songs: query.includes('亲爱的梦') ? [{
                  id: 2,
                  name: '亲爱的梦',
                  duration: 204000,
                  artists: [{ name: '测试歌手' }],
                  album: { name: '现场专辑' },
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
            lrc: { lyric: '[00:02.000]第一句歌词' },
          };
        },
      };
    },
  });

  const result = await client.getLyricsForTrack({
    albumName: '現場專輯',
    artistNames: '測試歌手',
    artists: ['測試歌手'],
    durationMs: 204000,
    name: '親愛的夢',
  });

  assert.equal(result.sourceTrack.id, 2);
  assert.equal(new URL(requests[0], 'http://localhost').searchParams.get('s'), '亲爱的梦 测试歌手 现场专辑');
});

test('createNeteaseLyricsClient ranks candidates across fallback searches', async () => {
  const searchQueries = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      if (getRequestPathname(url) === '/netease-api/search/get') {
        const query = new URL(url, 'http://localhost').searchParams.get('s');
        searchQueries.push(query);
        return {
          ok: true,
          async json() {
            return {
              result: {
                songs: query.includes('Target Album') ? [{
                  id: 1,
                  name: 'Shared Song',
                  duration: 210000,
                  artists: [{ name: 'Primary Artist' }],
                  album: { name: 'Compilation' },
                }] : [{
                  id: 2,
                  name: 'Shared Song',
                  duration: 180000,
                  artists: [{ name: 'Primary Artist' }],
                  album: { name: 'Target Album' },
                }],
              },
            };
          },
        };
      }

      return {
        ok: true,
        async json() {
          return { lrc: { lyric: '[00:01.000]Best match line' } };
        },
      };
    },
  });

  const result = await client.getLyricsForTrack({
    albumName: 'Target Album',
    artistNames: 'Primary Artist',
    durationMs: 180000,
    name: 'Shared Song',
  });

  assert.equal(result.sourceTrack.id, 2);
  assert.ok(searchQueries.length > 1);
});

test('createNeteaseLyricsClient tries ISRC search before text search', async () => {
  const requests = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (getRequestPathname(url) === '/netease-api/search/get') {
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
  assert.match(requests[0], /USGEN2600001/);
  assert.equal(getRequestPathname(requests[0]), '/netease-api/search/get');
  assert.equal(requests.length, 2);
});

test('createNeteaseLyricsClient searches and loads lyric lines', async () => {
  const requests = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (getRequestPathname(url) === '/netease-api/search/get') {
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
  assert.equal(result.sourceTrack.matchScore > 0, true);
  assert.ok(result.sourceTrack.matchReasons.some((reason) => reason.type === 'duration'));
  assert.deepEqual(result.lines, [{
    timeMs: 2000,
    text: 'Look at the stars',
    translation: '看看星星',
  }]);
  assert.equal(getRequestPathname(requests[0]), '/netease-api/search/get');
  assert.equal(requests.length, 2);
});

test('createNeteaseLyricsClient caches successful lyric lookups', async () => {
  const requests = [];
  const client = createNeteaseLyricsClient({
    fetchImpl: async (url) => {
      requests.push(url);
      if (getRequestPathname(url) === '/netease-api/search/get') {
        return {
          ok: true,
          async json() {
            return {
              result: {
                songs: [{
                  id: 9,
                  name: 'Cached Song',
                  duration: 180000,
                  artists: [{ name: 'Primary Artist' }],
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
            lrc: { lyric: '[00:02.000]Cached lyric line' },
          };
        },
      };
    },
  });

  const track = {
    artistNames: 'Primary Artist',
    durationMs: 180000,
    name: 'Cached Song',
  };

  const first = await client.getLyricsForTrack(track);
  const second = await client.getLyricsForTrack(track);

  assert.equal(first.sourceTrack.id, 9);
  assert.deepEqual(second.lines, first.lines);
  assert.equal(requests.length, 2);
});
