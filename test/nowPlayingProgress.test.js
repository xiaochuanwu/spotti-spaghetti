import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateDisplayProgressMs } from '../src/services/nowPlayingProgress.js';

test('calculateDisplayProgressMs advances while playing', () => {
  const fetchedAt = '2026-05-24T10:00:00.000Z';
  const nowMs = Date.parse('2026-05-24T10:00:08.000Z');

  assert.equal(calculateDisplayProgressMs({
    progressMs: 20_000,
    durationMs: 180_000,
    isPlaying: true,
    fetchedAt,
  }, nowMs), 27_500);
});

test('calculateDisplayProgressMs allows overriding display latency', () => {
  const fetchedAt = '2026-05-24T10:00:00.000Z';
  const nowMs = Date.parse('2026-05-24T10:00:08.000Z');

  assert.equal(calculateDisplayProgressMs({
    progressMs: 20_000,
    durationMs: 180_000,
    isPlaying: true,
    fetchedAt,
    displayLatencyMs: 0,
  }, nowMs), 28_000);
});

test('calculateDisplayProgressMs does not advance while paused', () => {
  const fetchedAt = '2026-05-24T10:00:00.000Z';
  const nowMs = Date.parse('2026-05-24T10:00:08.000Z');

  assert.equal(calculateDisplayProgressMs({
    progressMs: 20_000,
    durationMs: 180_000,
    isPlaying: false,
    fetchedAt,
  }, nowMs), 20_000);
});

test('calculateDisplayProgressMs does not exceed duration', () => {
  const fetchedAt = '2026-05-24T10:00:00.000Z';
  const nowMs = Date.parse('2026-05-24T10:00:08.000Z');

  assert.equal(calculateDisplayProgressMs({
    progressMs: 178_000,
    durationMs: 180_000,
    isPlaying: true,
    fetchedAt,
  }, nowMs), 180_000);
});

test('calculateDisplayProgressMs falls back safely when fetchedAt is invalid', () => {
  assert.equal(calculateDisplayProgressMs({
    progressMs: 20_000,
    durationMs: 180_000,
    isPlaying: true,
    fetchedAt: 'not-a-date',
  }, Date.parse('2026-05-24T10:00:08.000Z')), 20_000);
});
