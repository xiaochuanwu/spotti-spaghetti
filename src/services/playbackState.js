import { calculateDisplayProgressMs } from './nowPlayingProgress.js';

const toDurationMs = (value) => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

export const getSnapshotDurationMs = (snapshot) => (
  toDurationMs(snapshot?.durationMs) || toDurationMs(snapshot?.track?.durationMs)
);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getCommandAnchorIso = (nowMs) => new Date(nowMs).toISOString();

export const createOptimisticPlaybackState = (snapshot, command, payload = {}, nowMs = Date.now()) => {
  if (!snapshot?.isAvailable) return null;

  const durationMs = getSnapshotDurationMs(snapshot);
  const progressMs = calculateDisplayProgressMs({
    progressMs: snapshot.progressMs || 0,
    durationMs,
    isPlaying: snapshot.isPlaying,
    fetchedAt: snapshot.fetchedAt,
  }, nowMs);
  const anchoredProgressMs = durationMs > 0
    ? clamp(progressMs, 0, durationMs)
    : Math.max(0, progressMs);
  const fetchedAt = getCommandAnchorIso(nowMs);

  if (command === 'play') {
    return {
      ...snapshot,
      fetchedAt,
      isPlaying: true,
      progressMs: anchoredProgressMs,
    };
  }

  if (command === 'pause') {
    return {
      ...snapshot,
      fetchedAt,
      isPlaying: false,
      progressMs: anchoredProgressMs,
    };
  }

  if (command === 'seek' && Number.isFinite(Number(payload.positionMs))) {
    const nextProgressMs = durationMs > 0
      ? clamp(Number(payload.positionMs), 0, durationMs)
      : Math.max(0, Number(payload.positionMs));
    return {
      ...snapshot,
      fetchedAt,
      progressMs: nextProgressMs,
    };
  }

  if (command === 'shuffle' && typeof payload.state === 'boolean') {
    return {
      ...snapshot,
      shuffleState: payload.state,
    };
  }

  if (command === 'repeat' && payload.state) {
    return {
      ...snapshot,
      repeatState: payload.state,
    };
  }

  return null;
};
