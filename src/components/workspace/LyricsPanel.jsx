import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Music2, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useLyrics } from '../../hooks/useLyrics.js';

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

  const adjustedProgressMs = (Number.isFinite(progressMs) ? progressMs : 0) + LYRIC_SYNC_OFFSET_MS;
  let activeIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lineIsUnsynced(lines[index])) continue;
    if (lines[index].timeMs > adjustedProgressMs) break;
    activeIndex = index;
  }
  return activeIndex;
};

const lineIsUnsynced = (line) => line?.isSynced === false || !Number.isFinite(line?.timeMs);

const LyricsFrame = ({ children }) => (
  <section className="min-w-0">
    <div className="relative rounded-lg border border-[#e5e5e7] bg-white p-3 shadow-sm dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:shadow-none md:p-4">
      {children}
    </div>
  </section>
);

const EmptyLyricsState = ({ children, icon: Icon = Music2, iconClassName = '' }) => (
  <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg bg-[#fafafa] px-6 py-8 text-center text-sm font-semibold text-[#86868b] dark:bg-[#161617]">
    <Icon size={28} className={iconClassName} aria-hidden="true" />
    <p>{children}</p>
  </div>
);

export const LyricsPanel = ({ playback }) => {
  const { t } = useI18n();
  const activeLineRef = useRef(null);
  const lyricsScrollRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef(null);
  const userScrollIntentRef = useRef(false);
  const userScrollIntentTimeoutRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const [syncState, setSyncState] = useState({ isFollowing: true, sessionKey: '' });
  const {
    canControlPlayback,
    controlPlayback,
    displayProgressMs,
    error,
    isLoading,
    isSupported,
    nowPlaying,
  } = playback || {};
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
  const canSyncToActiveLine = activeIndex >= 0 && !lineIsUnsynced(lines[activeIndex]);
  const lastLine = lines[lines.length - 1];
  const lyricSessionKey = [
    track?.providerTrackId || track?.uri || track?.name || '',
    lines.length,
    lines[0]?.timeMs ?? lines[0]?.lineIndex ?? '',
    lastLine?.timeMs ?? lastLine?.lineIndex ?? '',
  ].join('|');
  const isFollowingActiveLine = syncState.sessionKey === lyricSessionKey
    ? syncState.isFollowing
    : true;
  const setFollowingActiveLine = useCallback((isFollowing) => {
    setSyncState((current) => (
      current.sessionKey === lyricSessionKey && current.isFollowing === isFollowing
        ? current
        : { isFollowing, sessionKey: lyricSessionKey }
    ));
  }, [lyricSessionKey]);

  const scrollActiveLineIntoView = useCallback((behavior = 'smooth') => {
    const activeLine = activeLineRef.current;
    const scrollContainer = lyricsScrollRef.current;
    if (!activeLine || !scrollContainer) return;

    programmaticScrollRef.current = true;
    window.clearTimeout(programmaticScrollTimeoutRef.current);

    const activeRect = activeLine.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const activeTop = activeRect.top - containerRect.top + scrollContainer.scrollTop;
    const targetTop = activeTop
      - (scrollContainer.clientHeight / 2)
      + (activeRect.height / 2);
    const minTop = activeTop - ACTIVE_LINE_SAFE_GAP_PX;
    lastScrollTopRef.current = scrollContainer.scrollTop;
    scrollContainer.scrollTo({
      top: Math.max(0, Math.min(targetTop, minTop)),
      behavior,
    });

    programmaticScrollTimeoutRef.current = window.setTimeout(() => {
      lastScrollTopRef.current = scrollContainer.scrollTop;
      programmaticScrollRef.current = false;
    }, behavior === 'smooth' ? 800 : 0);
  }, []);

  useEffect(() => {
    if (!isFollowingActiveLine) return;
    scrollActiveLineIntoView();
  }, [activeIndex, isFollowingActiveLine, lyricSessionKey, scrollActiveLineIntoView]);

  useEffect(() => () => {
    window.clearTimeout(programmaticScrollTimeoutRef.current);
    window.clearTimeout(userScrollIntentTimeoutRef.current);
  }, []);

  useLayoutEffect(() => {
    const scrollContainer = lyricsScrollRef.current;
    userScrollIntentRef.current = false;
    programmaticScrollRef.current = false;
    if (!scrollContainer) {
      lastScrollTopRef.current = 0;
      return;
    }

    scrollContainer.scrollTop = 0;
    lastScrollTopRef.current = 0;
  }, [lyricSessionKey]);

  const markLyricsScrollIntent = useCallback(() => {
    if (!canSyncToActiveLine) return;
    userScrollIntentRef.current = true;
    window.clearTimeout(userScrollIntentTimeoutRef.current);
    window.clearTimeout(programmaticScrollTimeoutRef.current);
    programmaticScrollRef.current = false;
    userScrollIntentTimeoutRef.current = window.setTimeout(() => {
      userScrollIntentRef.current = false;
    }, 450);
  }, [canSyncToActiveLine]);

  const handleLyricsPointerDown = useCallback(() => {
    markLyricsScrollIntent();
  }, [markLyricsScrollIntent]);

  const handleLyricsScroll = (event) => {
    const currentScrollTop = event.currentTarget.scrollTop;
    const didMove = Math.abs(currentScrollTop - lastScrollTopRef.current) > 2;
    lastScrollTopRef.current = currentScrollTop;

    if (programmaticScrollRef.current || !canSyncToActiveLine || !userScrollIntentRef.current || !didMove) return;
    userScrollIntentRef.current = false;
    setFollowingActiveLine(false);
  };

  const handleSyncToActiveLine = () => {
    setFollowingActiveLine(true);
    scrollActiveLineIntoView();
  };

  if (!isSupported) return null;

  const handleSeek = (positionMs) => {
    if (!canSeek) return;
    const payload = deviceId ? { deviceId, positionMs } : { positionMs };
    controlPlayback('seek', payload);
  };

  if (isLoading && !nowPlaying) {
    return (
      <LyricsFrame>
        <EmptyLyricsState icon={Loader2} iconClassName="animate-spin text-[#0071e3]">
          {t('lyrics.loadingPlayback')}
        </EmptyLyricsState>
      </LyricsFrame>
    );
  }

  if (error) {
    return (
      <LyricsFrame>
        <EmptyLyricsState>
          {error}
        </EmptyLyricsState>
      </LyricsFrame>
    );
  }

  if (!isTrackAvailable) {
    return (
      <LyricsFrame>
        <EmptyLyricsState>
          {t('lyrics.noActiveTrack')}
        </EmptyLyricsState>
      </LyricsFrame>
    );
  }

  return (
    <LyricsFrame>
      <div className="mb-3 flex flex-col gap-2 border-b border-[#e5e5e7] pb-3 dark:border-[#333336]/70 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
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
            <p className="mt-1 max-w-[260px] truncate text-[11px] font-semibold text-[#86868b] dark:text-[#a1a1a6]">
              {sourceTrack.name}
            </p>
          )}
        </div>
      </div>

      {isLoadingLyrics ? (
        <div className="flex min-h-[300px] items-center justify-center gap-2 text-sm font-semibold text-[#86868b]">
          <Loader2 size={18} className="animate-spin text-[#0071e3]" aria-hidden="true" />
          <span>{t('lyrics.loading')}</span>
        </div>
      ) : lyricsError ? (
        <EmptyLyricsState>
          {t(lyricsError)}
        </EmptyLyricsState>
      ) : lines.length ? (
        <>
          <div
            ref={lyricsScrollRef}
            onScroll={handleLyricsScroll}
            onPointerDown={handleLyricsPointerDown}
            onTouchMove={markLyricsScrollIntent}
            onWheel={markLyricsScrollIntent}
            className="h-[clamp(320px,52svh,560px)] scroll-py-8 overflow-y-auto overflow-x-hidden px-1 py-16 md:px-3 md:py-20"
          >
            <div className="mx-auto max-w-3xl space-y-2.5 overflow-x-hidden">
              {lines.map((line, index) => {
                const isActive = index === activeIndex;
                const canSeekLine = canSeek && !lineIsUnsynced(line);
                const lineClass = isActive
                  ? 'bg-[#0071e3]/10 text-[#1d1d1f] shadow-[inset_0_0_0_1px_rgba(0,113,227,0.18)] dark:bg-[#0a84ff]/20 dark:text-[#f5f5f7]'
                  : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/[0.06] dark:hover:text-[#f5f5f7]';

                return (
                  <button
                    key={`${line.timeMs}-${index}`}
                    ref={isActive ? activeLineRef : null}
                    type="button"
                    disabled={!canSeekLine}
                    onClick={() => handleSeek(line.timeMs)}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={canSeekLine ? t('lyrics.seekTo', formatDuration(line.timeMs)) : line.text}
                    className={`min-w-0 w-full overflow-hidden rounded-lg px-3.5 py-2.5 text-left transition-[background-color,box-shadow,color] disabled:cursor-default md:px-4 md:py-3 ${lineClass}`}
                  >
                    <span className="block whitespace-normal break-words text-lg font-bold leading-snug md:text-xl">
                      {line.text}
                    </span>
                    {line.translation && (
                      <span className="mt-1 block whitespace-normal break-words text-sm font-semibold leading-snug text-[#86868b] md:text-base">
                        {line.translation}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {!isFollowingActiveLine && canSyncToActiveLine && (
            <button
              type="button"
              onClick={handleSyncToActiveLine}
              className="absolute bottom-5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#0071e3]/20 bg-white/90 px-3.5 py-2 text-xs font-bold text-[#0071e3] shadow-lg shadow-black/10 backdrop-blur-xl transition hover:bg-[#f0f7ff] active:scale-95 dark:border-[#0a84ff]/30 dark:bg-[#1d1d1f]/90 dark:text-[#8ec8ff] dark:hover:bg-[#10243a]"
              aria-label={t('lyrics.syncToActive')}
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>{t('lyrics.sync')}</span>
            </button>
          )}
        </>
      ) : (
        <EmptyLyricsState>
          {t('lyrics.empty')}
        </EmptyLyricsState>
      )}
    </LyricsFrame>
  );
};
