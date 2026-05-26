import { useEffect, useMemo, useRef } from 'react';
import { Loader2, Music2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useLyrics } from '../../hooks/useLyrics.js';
import { useNowPlaying } from '../../hooks/useNowPlaying.js';

const LYRIC_SYNC_OFFSET_MS = 0;
const ACTIVE_LINE_SAFE_GAP_PX = 28;

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getActiveLyricIndex = (lines, progressMs) => {
  if (!lines.length) return -1;

  const adjustedProgressMs = progressMs + LYRIC_SYNC_OFFSET_MS;
  let activeIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].timeMs > adjustedProgressMs) break;
    activeIndex = index;
  }
  return activeIndex;
};

const EmptyLyricsState = ({ children, icon: Icon = Music2 }) => (
  <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg bg-[#fafafa] px-6 py-8 text-center text-sm font-semibold text-[#86868b] dark:bg-[#161617]">
    <Icon size={28} aria-hidden="true" />
    <p>{children}</p>
  </div>
);

export const LyricsPanel = ({ formatError, onAuthExpired, provider }) => {
  const { t } = useI18n();
  const activeLineRef = useRef(null);
  const lyricsScrollRef = useRef(null);
  const {
    canControlPlayback,
    controlPlayback,
    displayProgressMs,
    error,
    isLoading,
    isSupported,
    nowPlaying,
  } = useNowPlaying({ provider, formatError, onAuthExpired });
  const track = nowPlaying?.track;
  const isTrackAvailable = Boolean(nowPlaying?.isAvailable && track);
  const { error: lyricsError, isLoading: isLoadingLyrics, lines, sourceTrack } = useLyrics({
    isAvailable: isTrackAvailable,
    track,
  });
  const activeIndex = useMemo(
    () => getActiveLyricIndex(lines, displayProgressMs),
    [displayProgressMs, lines]
  );
  const deviceId = nowPlaying?.device?.id || '';
  const canSeek = Boolean(canControlPlayback && nowPlaying?.device && !nowPlaying.device.isRestricted);

  useEffect(() => {
    const activeLine = activeLineRef.current;
    const scrollContainer = lyricsScrollRef.current;
    if (!activeLine || !scrollContainer) return;

    const activeRect = activeLine.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const activeTop = activeRect.top - containerRect.top + scrollContainer.scrollTop;
    const targetTop = activeTop
      - (scrollContainer.clientHeight / 2)
      + (activeRect.height / 2);
    const minTop = activeTop - ACTIVE_LINE_SAFE_GAP_PX;
    scrollContainer.scrollTo({
      top: Math.max(0, Math.min(targetTop, minTop)),
      behavior: 'smooth',
    });
  }, [activeIndex]);

  if (!isSupported) return null;

  const handleSeek = (positionMs) => {
    if (!canSeek) return;
    const payload = deviceId ? { deviceId, positionMs } : { positionMs };
    controlPlayback('seek', payload);
  };

  if (isLoading && !nowPlaying) {
    return (
      <EmptyLyricsState icon={Loader2}>
        {t('lyrics.loadingPlayback')}
      </EmptyLyricsState>
    );
  }

  if (error) {
    return (
      <EmptyLyricsState>
        {error}
      </EmptyLyricsState>
    );
  }

  if (!isTrackAvailable) {
    return (
      <EmptyLyricsState>
        {t('lyrics.noActiveTrack')}
      </EmptyLyricsState>
    );
  }

  return (
    <section className="min-w-0">
      <div className="mb-3 rounded-lg border border-[#e5e5e7] bg-white p-3 shadow-sm dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:shadow-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {track.name}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
              {track.artistNames || t('preview.unknownArtist')}
            </p>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <p className="text-xs font-bold text-[#0071e3]">
              {t('lyrics.providerSource', t('lyrics.sourceNetease'))}
            </p>
            {sourceTrack && (
              <p className="mt-1 max-w-[260px] truncate text-[11px] font-semibold text-[#86868b]">
                {sourceTrack.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#e5e5e7] bg-white p-3 shadow-sm dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:shadow-none md:p-4">
        {isLoadingLyrics ? (
          <div className="flex min-h-[340px] items-center justify-center gap-2 text-sm font-semibold text-[#86868b]">
            <Loader2 size={18} className="animate-spin text-[#0071e3]" aria-hidden="true" />
            <span>{t('lyrics.loading')}</span>
          </div>
        ) : lyricsError ? (
          <EmptyLyricsState>
            {t(lyricsError)}
          </EmptyLyricsState>
        ) : lines.length ? (
          <div ref={lyricsScrollRef} className="max-h-[58vh] scroll-py-10 overflow-y-auto px-1 py-[16vh] md:px-4">
            <div className="mx-auto max-w-3xl space-y-2.5">
              {lines.map((line, index) => {
                const isActive = index === activeIndex;
                const lineClass = isActive
                  ? 'bg-[#0071e3]/10 text-[#1d1d1f] shadow-[inset_0_0_0_1px_rgba(0,113,227,0.18)] dark:bg-[#0a84ff]/20 dark:text-[#f5f5f7]'
                  : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/[0.06] dark:hover:text-[#f5f5f7]';

                return (
                  <button
                    key={`${line.timeMs}-${index}`}
                    ref={isActive ? activeLineRef : null}
                    type="button"
                    disabled={!canSeek}
                    onClick={() => handleSeek(line.timeMs)}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={t('lyrics.seekTo', formatDuration(line.timeMs))}
                    className={`w-full rounded-xl px-4 py-3 text-left transition-[background-color,box-shadow,color] disabled:cursor-default ${lineClass}`}
                  >
                    <span className="block text-xl font-bold leading-snug md:text-2xl">
                      {line.text}
                    </span>
                    {line.translation && (
                      <span className="mt-1 block text-sm font-semibold leading-snug text-[#86868b] md:text-base">
                        {line.translation}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyLyricsState>
            {t('lyrics.empty')}
          </EmptyLyricsState>
        )}
      </div>
    </section>
  );
};
