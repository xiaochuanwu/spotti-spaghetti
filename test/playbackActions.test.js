import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYBACK_ACTION_FOLLOWUP_REFRESH_DELAY_MS,
  PLAYBACK_ACTION_PRIMARY_REFRESH_DELAY_MS,
  shouldFallbackToTrackPlayback,
} from '../src/services/playbackActions.js';

test('playback refresh delays leave time for Spotify clients to settle', () => {
  assert.equal(PLAYBACK_ACTION_PRIMARY_REFRESH_DELAY_MS, 700);
  assert.equal(PLAYBACK_ACTION_FOLLOWUP_REFRESH_DELAY_MS, 1800);
});

test('context playback falls back to single-track playback for generic Spotify failures', () => {
  assert.equal(shouldFallbackToTrackPlayback({ code: 'SPOTIFY_REQUEST_FAILED' }), true);
});

test('context playback does not mask actionable Spotify playback errors', () => {
  [
    'SPOTIFY_AUTH_EXPIRED',
    'SPOTIFY_AUTH_REFRESH_FAILED',
    'SPOTIFY_AUTH_SCOPE_CHANGED',
    'SPOTIFY_NO_ACTIVE_DEVICE',
    'SPOTIFY_PERMISSION_DENIED',
    'SPOTIFY_PLAYBACK_TARGET_REQUIRED',
    'SPOTIFY_PREMIUM_REQUIRED',
    'SPOTIFY_REQUEST_CANCELLED',
    'PROVIDER_REQUEST_CANCELLED',
  ].forEach(code => {
    assert.equal(shouldFallbackToTrackPlayback({ code }), false, code);
  });
});
