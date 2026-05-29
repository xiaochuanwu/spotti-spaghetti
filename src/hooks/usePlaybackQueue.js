import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import {
  createOptimisticRecentItem,
  getPlaybackItemTrackId,
  mergeRecentlyPlayedItems,
  RECENTLY_PLAYED_OPTIMISTIC_TTL_MS,
} from '../services/playbackQueue.js';

export const PLAYBACK_QUEUE_VIEWS = {
  now: 'now',
  queue: 'queue',
  recent: 'recent',
};

export const usePlaybackQueue = ({
  enabled = true,
  formatError,
  onAuthExpired,
  provider,
} = {}) => {
  const { t } = useI18n();
  const [view, setView] = useState(PLAYBACK_QUEUE_VIEWS.now);
  const [queue, setQueue] = useState(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState(null);
  const [optimisticRecentItems, setOptimisticRecentItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const isSupported = Boolean(
    enabled &&
    provider?.capabilities?.playbackQueue &&
    provider?.getPlaybackQueue &&
    provider?.getRecentlyPlayed
  );

  useEffect(() => {
    if (isSupported) return undefined;

    abortRef.current?.abort();
    abortRef.current = null;
    const resetId = window.setTimeout(() => {
      setView(PLAYBACK_QUEUE_VIEWS.now);
      setQueue(null);
      setRecentlyPlayed(null);
      setOptimisticRecentItems([]);
      setIsLoading(false);
      setError('');
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [isSupported]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const refresh = useCallback(async (targetView = view) => {
    if (!isSupported || targetView === PLAYBACK_QUEUE_VIEWS.now) return;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    setIsLoading(true);
    setError('');

    try {
      if (targetView === PLAYBACK_QUEUE_VIEWS.queue) {
        setQueue(await provider.getPlaybackQueue({ signal: abortController.signal }));
      } else {
        setRecentlyPlayed(await provider.getRecentlyPlayed({
          limit: 20,
          signal: abortController.signal,
        }));
      }
    } catch (err) {
      const errorInfo = provider.getErrorInfo?.(err);
      if (errorInfo?.isCancelled) return;
      if (errorInfo?.isAuthExpired) onAuthExpired?.(err);

      console.error('Failed to load playback queue view:', err);
      setError(formatError?.(err) || t('nowPlaying.queueLoadFailed'));
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [formatError, isSupported, onAuthExpired, provider, t, view]);

  const markRecentlyPlayed = useCallback((trackRef) => {
    const item = createOptimisticRecentItem(trackRef);
    if (!item) return;

    const trackId = getPlaybackItemTrackId(item);
    const nowMs = Date.now();
    setOptimisticRecentItems(current => [
      item,
      ...current.filter(existing => getPlaybackItemTrackId(existing) !== trackId),
    ]
      .filter(existing => {
        const playedAtMs = Date.parse(existing.playedAt || '');
        return !Number.isNaN(playedAtMs) &&
          nowMs - playedAtMs <= RECENTLY_PLAYED_OPTIMISTIC_TTL_MS;
      })
      .slice(0, 5)
    );
  }, []);

  const changeView = useCallback((nextView) => {
    setView(nextView);
    setError('');
    if (nextView === PLAYBACK_QUEUE_VIEWS.now) {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsLoading(false);
      return;
    }
    if (nextView !== PLAYBACK_QUEUE_VIEWS.now) {
      refresh(nextView);
    }
  }, [refresh]);

  const mergedRecentlyPlayedItems = useMemo(() => (
    mergeRecentlyPlayedItems(recentlyPlayed?.items || [], optimisticRecentItems)
  ), [optimisticRecentItems, recentlyPlayed?.items]);
  const mergedRecentlyPlayed = useMemo(() => (
    recentlyPlayed || mergedRecentlyPlayedItems.length > 0
      ? {
        cursors: recentlyPlayed?.cursors || null,
        items: mergedRecentlyPlayedItems,
        next: recentlyPlayed?.next || '',
      }
      : null
  ), [mergedRecentlyPlayedItems, recentlyPlayed]);
  const hasOptimisticRecentItems = mergedRecentlyPlayedItems.some(item => item.isOptimistic);

  return {
    error,
    hasOptimisticRecentItems,
    isLoading,
    isSupported,
    markRecentlyPlayed,
    queue,
    recentlyPlayed: mergedRecentlyPlayed,
    refresh,
    setView: changeView,
    view,
  };
};
