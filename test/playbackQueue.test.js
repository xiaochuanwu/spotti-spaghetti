import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createOptimisticRecentItem,
  getPlaybackItemTrackId,
  mergeRecentlyPlayedItems,
  RECENTLY_PLAYED_OPTIMISTIC_TTL_MS,
} from '../src/services/playbackQueue.js';

const playedAt = '2026-05-29T10:00:00.000Z';

test('createOptimisticRecentItem normalizes app-started track references', () => {
  const item = createOptimisticRecentItem({
    id: 'track-1',
    uri: 'spotify:track:track-1',
    name: 'Started Here',
    artists: 'Artist One',
    albumName: 'Album One',
    albumCover: 'https://example.test/cover.jpg',
    durationMs: 180000,
    externalUrl: 'https://open.spotify.com/track/track-1',
  }, playedAt);

  assert.equal(item.id, 'track-1');
  assert.equal(item.isOptimistic, true);
  assert.equal(item.playedAt, playedAt);
  assert.equal(item.albumCover, 'https://example.test/cover.jpg');
  assert.equal(item.track.providerTrackId, 'track-1');
  assert.equal(item.track.artistNames, 'Artist One');
});

test('getPlaybackItemTrackId accepts nested queue and Spotify URL shapes', () => {
  assert.equal(getPlaybackItemTrackId({
    track: { uri: 'spotify:track:nested-track' },
  }), 'nested-track');
  assert.equal(
    getPlaybackItemTrackId('https://open.spotify.com/track/url-track?si=abc'),
    'url-track'
  );
});

test('mergeRecentlyPlayedItems keeps fresh optimistic tracks before stale Spotify history', () => {
  const optimisticItem = createOptimisticRecentItem({
    id: 'track-new',
    name: 'New Track',
  }, playedAt);
  const apiItem = createOptimisticRecentItem({
    id: 'track-old',
    name: 'Old Track',
  }, '2026-05-29T09:50:00.000Z');

  const merged = mergeRecentlyPlayedItems(
    [apiItem],
    [optimisticItem],
    Date.parse('2026-05-29T10:01:00.000Z')
  );

  assert.equal(merged[0].track.name, 'New Track');
  assert.equal(merged[1].track.name, 'Old Track');
});

test('mergeRecentlyPlayedItems drops optimistic entry once Spotify history catches up', () => {
  const optimisticItem = createOptimisticRecentItem({
    id: 'track-1',
    name: 'Started Here',
  }, playedAt);
  const apiItem = {
    ...optimisticItem,
    isOptimistic: false,
    playedAt: '2026-05-29T10:00:12.000Z',
  };

  const merged = mergeRecentlyPlayedItems(
    [apiItem],
    [optimisticItem],
    Date.parse('2026-05-29T10:01:00.000Z')
  );

  assert.deepEqual(merged, [apiItem]);
});

test('mergeRecentlyPlayedItems expires old optimistic entries', () => {
  const optimisticItem = createOptimisticRecentItem({
    id: 'track-1',
    name: 'Expired Track',
  }, playedAt);
  const nowMs = Date.parse(playedAt) + RECENTLY_PLAYED_OPTIMISTIC_TTL_MS + 1;

  assert.deepEqual(mergeRecentlyPlayedItems([], [optimisticItem], nowMs), []);
});
