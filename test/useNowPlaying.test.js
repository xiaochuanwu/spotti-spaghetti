import assert from 'node:assert/strict';
import test from 'node:test';

import { createOptimisticPlaybackState } from '../src/services/playbackState.js';

const baseSnapshot = {
  durationMs: 180_000,
  fetchedAt: '2026-05-26T10:00:00.000Z',
  isAvailable: true,
  isPlaying: true,
  progressMs: 42_000,
  track: { durationMs: 180_000 },
};

test('createOptimisticPlaybackState pauses immediately at the display progress', () => {
  const nowMs = Date.parse('2026-05-26T10:00:02.000Z');
  const snapshot = createOptimisticPlaybackState(baseSnapshot, 'pause', {}, nowMs);

  assert.equal(snapshot.isPlaying, false);
  assert.equal(snapshot.progressMs, 44_000);
  assert.equal(snapshot.fetchedAt, '2026-05-26T10:00:02.000Z');
});

test('createOptimisticPlaybackState resumes from the current progress anchor', () => {
  const nowMs = Date.parse('2026-05-26T10:00:02.000Z');
  const snapshot = createOptimisticPlaybackState({
    ...baseSnapshot,
    isPlaying: false,
  }, 'play', {}, nowMs);

  assert.equal(snapshot.isPlaying, true);
  assert.equal(snapshot.progressMs, 42_000);
  assert.equal(snapshot.fetchedAt, '2026-05-26T10:00:02.000Z');
});

test('createOptimisticPlaybackState updates playback toggles without changing the track', () => {
  const snapshot = createOptimisticPlaybackState(baseSnapshot, 'shuffle', { state: true });

  assert.equal(snapshot.shuffleState, true);
  assert.equal(snapshot.track, baseSnapshot.track);
});
