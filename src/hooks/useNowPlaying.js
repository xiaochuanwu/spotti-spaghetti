import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { calculateDisplayProgressMs } from '../services/nowPlayingProgress.js';
import {
  createOptimisticPlaybackState,
  getSnapshotDurationMs,
} from '../services/playbackState.js';

const REFRESH_INTERVAL_MS = 8000;
const PROGRESS_TICK_MS = 250;
const PLAYBACK_STATE_RECONCILE_DELAY_MS = 800;
const TRACK_END_REFRESH_WINDOW_MS = 5000;
const TRACK_END_REFRESH_THROTTLE_MS = 10000;

export const useNowPlaying = ({
  enabled = true,
  provider,
  formatError,
  onAuthExpired,
} = {}) => {
  const { t } = useI18n();
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [controlPending, setControlPending] = useState('');
  const [controlError, setControlError] = useState('');
  const [error, setError] = useState('');
  const [displayNowMs, setDisplayNowMs] = useState(() => Date.now());
  const abortRef = useRef(null);
  const lastNowPlayingRef = useRef(null);
  const nearEndRefreshRef = useRef({ key: '', triggeredAt: 0 });
  const reconcileTimeoutRef = useRef(null);

  const readPlaybackState = provider?.capabilities?.playbackState && provider?.getPlaybackState
    ? provider.getPlaybackState
    : provider?.getNowPlaying;
  const canControlPlayback = Boolean(enabled && provider?.capabilities?.playbackControl && provider?.controlPlayback);
  const isSupported = Boolean(enabled && readPlaybackState);

  const fetchNowPlaying = useCallback(async ({ silent = false } = {}) => {
    if (!isSupported) return;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    if (!silent) {
      setIsLoading(true);
      setError('');
    }

    try {
      const result = await readPlaybackState({ signal: abortController.signal });
      lastNowPlayingRef.current = result;
      setNowPlaying(result);
      setDisplayNowMs(Date.now());
      setControlError('');
      setError('');
    } catch (err) {
      const errorInfo = provider.getErrorInfo?.(err);
      if (errorInfo?.isCancelled) return;

      if (errorInfo?.isAuthExpired) {
        onAuthExpired?.(err);
      }

      console.error('Failed to load now playing:', err);
      if (!silent || !lastNowPlayingRef.current) {
        setError(formatError?.(err) || t('nowPlaying.error'));
      }
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [formatError, isSupported, onAuthExpired, provider, readPlaybackState, t]);

  useEffect(() => {
    if (enabled) return undefined;

    abortRef.current?.abort();
    window.clearTimeout(reconcileTimeoutRef.current);
    lastNowPlayingRef.current = null;
    nearEndRefreshRef.current = { key: '', triggeredAt: 0 };

    const resetId = window.setTimeout(() => {
      setNowPlaying(null);
      setIsLoading(false);
      setControlPending('');
      setControlError('');
      setError('');
    }, 0);

    return () => {
      window.clearTimeout(resetId);
    };
  }, [enabled]);

  const controlPlayback = useCallback(async (command, payload = {}) => {
    if (!canControlPlayback) return;

    const commandStartedAt = Date.now();
    const previousNowPlaying = lastNowPlayingRef.current;
    const optimisticNowPlaying = createOptimisticPlaybackState(
      previousNowPlaying,
      command,
      payload,
      commandStartedAt
    );

    setControlPending(command);
    setControlError('');
    setError('');
    if (optimisticNowPlaying) {
      lastNowPlayingRef.current = optimisticNowPlaying;
      setNowPlaying(optimisticNowPlaying);
      setDisplayNowMs(commandStartedAt);
    }

    try {
      await provider.controlPlayback(command, payload);
      if (optimisticNowPlaying) {
        window.clearTimeout(reconcileTimeoutRef.current);
        reconcileTimeoutRef.current = window.setTimeout(() => {
          fetchNowPlaying({ silent: true });
        }, PLAYBACK_STATE_RECONCILE_DELAY_MS);
      } else {
        await fetchNowPlaying({ silent: true });
      }
    } catch (err) {
      if (optimisticNowPlaying) {
        lastNowPlayingRef.current = previousNowPlaying;
        setNowPlaying(previousNowPlaying);
        setDisplayNowMs(Date.now());
      }

      const errorInfo = provider.getErrorInfo?.(err);
      if (errorInfo?.isCancelled) return;

      if (errorInfo?.isAuthExpired) {
        onAuthExpired?.(err);
      }

      console.error('Failed to control playback:', err);
      const errorMessage = errorInfo?.translationKey && errorInfo.translationKey !== 'error.genericDetail'
        ? formatError?.(err)
        : t('nowPlaying.controlError');
      setControlError(errorMessage || t('nowPlaying.controlError'));
    } finally {
      setControlPending('');
    }
  }, [canControlPlayback, fetchNowPlaying, formatError, onAuthExpired, provider, t]);

  useEffect(() => {
    if (!isSupported) return undefined;

    const initialRefreshId = window.setTimeout(() => {
      fetchNowPlaying();
    }, 0);

    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearTimeout(reconcileTimeoutRef.current);
      abortRef.current?.abort();
    };
  }, [fetchNowPlaying, isSupported]);

  useEffect(() => {
    if (!isSupported) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchNowPlaying({ silent: true });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNowPlaying({ silent: true });
      }
    };

    const intervalId = window.setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNowPlaying, isSupported]);

  useEffect(() => {
    if (!nowPlaying?.isAvailable || !nowPlaying?.isPlaying) return undefined;

    const tickId = window.setInterval(() => {
      setDisplayNowMs(Date.now());
    }, PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(tickId);
    };
  }, [
    nowPlaying?.fetchedAt,
    nowPlaying?.isAvailable,
    nowPlaying?.isPlaying,
    nowPlaying?.progressMs,
  ]);

  const durationMs = getSnapshotDurationMs(nowPlaying);
  const displayProgressMs = useMemo(() => (
    calculateDisplayProgressMs({
      progressMs: nowPlaying?.progressMs || 0,
      durationMs,
      isPlaying: nowPlaying?.isPlaying,
      fetchedAt: nowPlaying?.fetchedAt,
    }, displayNowMs)
  ), [
    displayNowMs,
    durationMs,
    nowPlaying?.fetchedAt,
    nowPlaying?.isPlaying,
    nowPlaying?.progressMs,
  ]);

  useEffect(() => {
    if (
      !isSupported ||
      !nowPlaying?.isAvailable ||
      !nowPlaying?.isPlaying ||
      durationMs <= 0
    ) {
      return;
    }

    const remainingMs = durationMs - displayProgressMs;
    if (remainingMs > TRACK_END_REFRESH_WINDOW_MS) return;

    const refreshKey = [
      nowPlaying?.track?.uri || nowPlaying?.track?.providerTrackId || 'unknown',
      nowPlaying?.fetchedAt || '',
      nowPlaying?.progressMs || 0,
    ].join(':');
    const nowMs = Date.now();
    const lastRefresh = nearEndRefreshRef.current;
    if (
      lastRefresh.key === refreshKey &&
      nowMs - lastRefresh.triggeredAt < TRACK_END_REFRESH_THROTTLE_MS
    ) {
      return;
    }

    nearEndRefreshRef.current = { key: refreshKey, triggeredAt: nowMs };
    fetchNowPlaying({ silent: true });
  }, [
    displayProgressMs,
    durationMs,
    fetchNowPlaying,
    isSupported,
    nowPlaying?.fetchedAt,
    nowPlaying?.isAvailable,
    nowPlaying?.isPlaying,
    nowPlaying?.progressMs,
    nowPlaying?.track?.providerTrackId,
    nowPlaying?.track?.uri,
  ]);

  return {
    canControlPlayback,
    controlError,
    controlPending,
    controlPlayback,
    displayProgressMs,
    durationMs,
    error,
    fetchNowPlaying,
    isLoading,
    isSupported,
    nowPlaying,
  };
};

export const getNowPlayingRefreshIntervalMs = () => REFRESH_INTERVAL_MS;
