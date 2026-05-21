import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInsights } from '../src/services/insights.js';

const pickTrackSummary = (track) => ({
  provider: track.provider,
  providerTrackId: track.providerTrackId,
  uri: track.uri,
  artistNames: track.artistNames,
  durationMs: track.durationMs,
  genres: track.genres,
  recordLabel: track.recordLabel,
  releaseDate: track.releaseDate,
  popularity: track.popularity,
  explicit: track.explicit,
});

test('buildInsights aggregates unique tracks across export snapshots', () => {
  const insights = buildInsights([
    {
      tracks: [
        { uri: 'spotify:track:1', genres: 'pop,dance', recordLabel: 'Label A', releaseDate: '2020-01-01', popularity: 80, explicit: 'No' },
        { uri: 'spotify:track:2', artistNames: 'Artist B', durationMs: 180000, genres: 'pop', recordLabel: 'Label B', releaseDate: '2021-02-01', popularity: 60, explicit: 'Yes' },
      ],
    },
    {
      tracks: [
        { uri: 'spotify:track:1', artistNames: 'Artist A,Artist B', durationMs: 240000, genres: 'pop,dance', recordLabel: 'Label A', releaseDate: '2020-01-01', popularity: 80, explicit: 'No' },
        { uri: 'spotify:track:3', artistNames: 'Artist C', durationMs: 120000, genres: 'rock', recordLabel: 'Label A', releaseDate: '1999-03-01', popularity: 40, explicit: 'No' },
      ],
    },
  ]);

  assert.equal(insights.trackCount, 3);
  assert.equal(insights.snapshotCount, 2);
  assert.equal(insights.artistCount, 3);
  assert.equal(insights.albumCount, 0);
  assert.equal(insights.genreCount, 3);
  assert.equal(insights.labelCount, 2);
  assert.equal(insights.averagePopularity, 60);
  assert.equal(insights.totalDurationHours, 0.2);
  assert.equal(insights.averageDurationMinutes, 3);
  assert.equal(insights.explicitRatio, 33);
  assert.equal(insights.highPopularityRatio, 33);
  assert.equal(insights.discoveryRatio, 33);
  assert.equal(insights.oldestYear, 1999);
  assert.equal(insights.newestYear, 2021);
  assert.equal(insights.averageReleaseYear, 2013);
  assert.deepEqual(pickTrackSummary(insights.longestTrack), {
    provider: 'spotify',
    providerTrackId: '1',
    uri: 'spotify:track:1',
    artistNames: 'Artist A,Artist B',
    durationMs: 240000,
    genres: ['pop', 'dance'],
    recordLabel: 'Label A',
    releaseDate: '2020-01-01',
    popularity: 80,
    explicit: false,
  });
  assert.deepEqual(pickTrackSummary(insights.shortestTrack), {
    provider: 'spotify',
    providerTrackId: '3',
    uri: 'spotify:track:3',
    artistNames: 'Artist C',
    durationMs: 120000,
    genres: ['rock'],
    recordLabel: 'Label A',
    releaseDate: '1999-03-01',
    popularity: 40,
    explicit: false,
  });
  assert.deepEqual(insights.mostCommonReleaseYear, { label: '1999', count: 1 });
  assert.deepEqual(insights.popularityBuckets, [
    { label: '0-20', count: 0 },
    { label: '21-40', count: 1 },
    { label: '41-60', count: 1 },
    { label: '61-80', count: 1 },
    { label: '81-100', count: 0 },
  ]);
  assert.deepEqual(insights.topArtists.slice(0, 3), [
    { label: 'Artist B', count: 2 },
    { label: 'Artist A', count: 1 },
    { label: 'Artist C', count: 1 },
  ]);
  assert.deepEqual(insights.topAlbums, []);
  assert.deepEqual(insights.topGenres.slice(0, 3), [
    { label: 'pop', count: 2 },
    { label: 'dance', count: 1 },
    { label: 'rock', count: 1 },
  ]);
  assert.deepEqual(insights.topDecades[0], { label: '2020s', count: 2 });
  assert.ok(insights.topYears.some(item => item.label === '2020' && item.count === 1));
  assert.deepEqual(insights.topLabels[0], { label: 'Label A', count: 2 });
});
