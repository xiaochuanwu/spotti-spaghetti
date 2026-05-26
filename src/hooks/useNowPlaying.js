import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { calculateDisplayProgressMs } from '../services/nowPlayingProgress.js';

const REFRESH_INTERVAL_MS = 15000;
const PROGRESS_TICK_MS = 500;
const TRACK_END_REFRESH_WINDOW_MS = 5000;
const TRACK_END_REFRESH_THROTTLE_MS = 10000;

const toDurationMs = (value) => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const getSnapshotDurationMs = (snapshot) => (
  toDurationMs(snapshot?.durationMs) || toDurationMs(snapshot?.track?.durationMs)
);

export const useNowPlaying = ({ provider, formatError, onAuthExpired } = {}) => {
  const { t } = useI18n();
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [displayNowMs, setDisplayNowMs] = useState(() => Date.now());
  const abortRef = useRef(null);
  const lastNowPlayingRef = useRef(null);
  const nearEndRefreshRef = useRef({ key: '', triggeredAt: 0 });

  const readPlaybackState = provider?.capabilities?.playbackState && provider?.getPlaybackState
    ? provider.getPlaybackState
    : provider?.getNowPlaying;
  const isSupported = Boolean(readPlaybackState);

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
    if (!isSupported) return undefined;

    const initialRefreshId = window.setTimeout(() => {
      fetchNowPlaying();
    }, 0);

    return () => {
      window.clearTimeout(initialRefreshId);
      abortRef.current?.abort();
    };
  }, [fetchNowPlaying, isSupported]);

  useEffect(() => {
    if (!isSupported || !autoRefresh) return undefined;

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
  }, [autoRefresh, fetchNowPlaying, isSupported]);

  useEffect(() => {
    if (!nowPlaying?.isAvailable || !nowPlaying?.isPlaying) return undefined;

    const tickId = window.setInterval(() => {
      setDisplayNowMs(Date.now());
    }, PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(tickId);
    };
  }, [nowPlaying?.fetchedAt, nowPlaying?.isAvailable, nowPlaying?.isPlaying, nowPlaying?.progressMs]);

  const durationMs = getSnapshotDurationMs(nowPlaying);
  const displayProgressMs = useMemo(() => (
    calculateDisplayProgressMs({
      progressMs: nowPlaying?.progressMs || 0,
      durationMs,
      isPlaying: nowPlaying?.isPlaying,
      fetchedAt: nowPlaying?.fetchedAt,
    }, displayNowMs)
  ), [displayNowMs, durationMs, nowPlaying?.fetchedAt, nowPlaying?.isPlaying, nowPlaying?.progressMs]);

  useEffect(() => {
    if (
      !isSupported ||
      !autoRefresh ||
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
    autoRefresh,
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
    autoRefresh,
    displayProgressMs,
    durationMs,
    error,
    fetchNowPlaying,
    isLoading,
    isSupported,
    nowPlaying,
    setAutoRefresh,
  };
};
