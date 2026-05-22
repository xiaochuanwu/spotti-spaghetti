import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Music, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';

const REFRESH_INTERVAL_MS = 15000;

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const NowPlayingPanel = ({ provider, formatError }) => {
  const { t } = useI18n();
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const abortRef = useRef(null);

  const isSupported = Boolean(provider?.capabilities?.nowPlaying && provider?.getNowPlaying);

  const fetchNowPlaying = useCallback(async ({ silent = false } = {}) => {
    if (!isSupported) return;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    if (!silent) setIsLoading(true);
    setError('');

    try {
      const result = await provider.getNowPlaying({ signal: abortController.signal });
      setNowPlaying(result);
    } catch (err) {
      const errorInfo = provider.getErrorInfo?.(err);
      if (errorInfo?.isCancelled) return;
      console.error('Failed to load now playing:', err);
      setError(formatError?.(err) || t('nowPlaying.error'));
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [formatError, isSupported, provider, t]);

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

  if (!isSupported) return null;

  const track = nowPlaying?.track;
  const durationMs = Number(nowPlaying?.durationMs || track?.durationMs || 0);
  const progressMs = Math.min(Number(nowPlaying?.progressMs || 0), durationMs || 0);
  const progressPercent = durationMs > 0 ? Math.min(100, Math.round((progressMs / durationMs) * 100)) : 0;
  const isTrackAvailable = Boolean(nowPlaying?.isAvailable && track);
  const unavailableMessage = nowPlaying?.reason === 'unsupported_type'
    ? t('nowPlaying.unsupportedType', nowPlaying.currentlyPlayingType || t('nowPlaying.unknownType'))
    : t('nowPlaying.noActivePlayback');

  return (
    <section className="w-full mb-6 animate-fade-in-up">
      <div className="bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl p-4 md:p-5 shadow-sm dark:shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
              {t('nowPlaying.title')}
            </p>
            <h2 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {isTrackAvailable ? track.name : t('nowPlaying.emptyTitle')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="sr-only"
                aria-label={t('nowPlaying.autoRefresh')}
              />
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoRefresh ? 'bg-[#0071e3]' : 'bg-[#d2d2d7] dark:bg-[#3a3a3c]'
              }`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  autoRefresh ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </span>
              <span>{t('nowPlaying.autoRefresh')}</span>
            </label>

            <button
              type="button"
              onClick={() => fetchNowPlaying()}
              disabled={isLoading}
              aria-label={t('nowPlaying.refresh')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#e8e8ed] text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white disabled:cursor-not-allowed disabled:text-[#86868b] dark:bg-[#2d2d30]"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {isLoading && !nowPlaying ? (
          <div className="flex items-center gap-3 rounded-xl bg-[#fafafa] dark:bg-[#1c1c1e] px-4 py-5 text-sm font-semibold text-[#86868b]">
            <Loader2 size={18} className="animate-spin text-[#0071e3]" aria-hidden="true" />
            <span>{t('nowPlaying.loading')}</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-4 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchNowPlaying()}
              className="shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-white dark:bg-red-900/40 dark:text-red-100"
            >
              {t('nowPlaying.refresh')}
            </button>
          </div>
        ) : !isTrackAvailable ? (
          <div className="flex items-center gap-3 rounded-xl bg-[#fafafa] dark:bg-[#1c1c1e] px-4 py-5 text-sm font-semibold text-[#86868b]">
            <Music size={18} aria-hidden="true" />
            <span>{unavailableMessage}</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[72px_1fr]">
            <div className="h-[72px] w-[72px] overflow-hidden rounded-xl bg-[#f0f0f2] dark:bg-[#161617] flex items-center justify-center border border-black/[0.04] dark:border-white/[0.04]">
              {nowPlaying.albumCover ? (
                <img
                  src={nowPlaying.albumCover}
                  alt={t('nowPlaying.coverAlt', track.name)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Music className="h-7 w-7 text-[#86868b]" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {nowPlaying.isPlaying ? (
                      <PlayCircle size={16} className="shrink-0 text-[#16a34a]" aria-hidden="true" />
                    ) : (
                      <PauseCircle size={16} className="shrink-0 text-[#86868b]" aria-hidden="true" />
                    )}
                    <span className="text-xs font-bold text-[#6e6e73] dark:text-[#a1a1a6]">
                      {nowPlaying.isPlaying ? t('nowPlaying.playing') : t('nowPlaying.paused')}
                    </span>
                    {track.explicit && (
                      <span
                        className="rounded bg-[#3a3a3c] px-1.5 py-0.5 text-[10px] font-black text-white"
                        aria-label={t('nowPlaying.explicit')}
                        title={t('nowPlaying.explicit')}
                      >
                        E
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {track.name}
                  </p>
                  <p className="truncate text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
                    {track.artistNames || t('preview.unknownArtist')}
                  </p>
                  <p className="truncate text-xs text-[#86868b]">
                    {track.albumName || t('preview.unknownAlbum')}
                  </p>
                </div>

                {nowPlaying.externalUrl && (
                  <a
                    href={nowPlaying.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('nowPlaying.openSpotify', track.name)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8e8ed] text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30]"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="mt-4">
                <div
                  role="progressbar"
                  aria-label={t('nowPlaying.progress')}
                  aria-valuemin={0}
                  aria-valuenow={progressMs}
                  aria-valuemax={durationMs}
                  aria-valuetext={`${formatDuration(progressMs)} / ${formatDuration(durationMs)}`}
                  className="h-2 overflow-hidden rounded-full bg-[#e8e8ed] dark:bg-[#2d2d30]"
                >
                  <div
                    className="h-full rounded-full bg-[#0071e3] transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[#86868b]">
                  <span>{formatDuration(progressMs)}</span>
                  <span>{formatDuration(durationMs)}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#86868b]">
                <span className="rounded-full bg-[#f5f5f7] px-2 py-1 dark:bg-[#2d2d30]">
                  {t('nowPlaying.isrc')}: {track.isrc || t('nowPlaying.notAvailable')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
