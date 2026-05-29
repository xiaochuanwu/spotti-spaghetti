import {
  Clock3,
  ExternalLink,
  Heart,
  ListOrdered,
  Loader2,
  Music,
  Pause,
  PauseCircle,
  Play,
  PlayCircle,
  Repeat,
  Repeat1,
  Repeat2,
  RefreshCw,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useI18n } from '../i18n';

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const SPOTIFY_TRACK_URI_PREFIX = 'spotify:track:';

const getPlayableTrackId = (item = {}) => {
  const value = item.track?.providerTrackId || item.providerTrackId || item.id || item.uri || '';
  const text = String(value).trim();
  return text.startsWith(SPOTIFY_TRACK_URI_PREFIX)
    ? text.slice(SPOTIFY_TRACK_URI_PREFIX.length)
    : text;
};

const progressPercentFor = (progressMs, durationMs) => {
  if (durationMs <= 0) return 0;
  return Math.min(100, (progressMs / durationMs) * 100);
};

const formatDeviceLabel = (device, t) => {
  if (!device) return t('nowPlaying.noActiveDevice');
  const name = device.name || t('nowPlaying.unknownDevice');
  return device.type ? `${name} - ${device.type}` : name;
};

const formatRepeatState = (state, t) => {
  if (state === 'track') return t('nowPlaying.repeatTrack');
  if (state === 'context') return t('nowPlaying.repeatContext');
  return t('nowPlaying.repeatOff');
};

const getNextRepeatState = (state) => {
  if (state === 'off') return 'context';
  if (state === 'context') return 'track';
  return 'off';
};

const getRepeatLabel = (state, t) => {
  if (state === 'track') return t('nowPlaying.repeatOneMode');
  if (state === 'context') return t('nowPlaying.repeatPlaylistMode');
  return t('nowPlaying.repeatOffMode');
};

const RepeatModeIcon = ({ state, size = 15 }) => {
  if (state === 'track') return <Repeat1 size={size} aria-hidden="true" />;
  if (state === 'context') return <Repeat2 size={size} aria-hidden="true" />;
  return <Repeat size={size} aria-hidden="true" />;
};

const NowPlayingArtwork = ({ albumCover, condensed = false, trackName, t, variant }) => {
  const artworkClass = {
    player: `mx-auto flex aspect-square w-full ${condensed ? 'max-w-[132px]' : 'max-w-[224px]'} items-center justify-center overflow-hidden rounded-xl border border-black/[0.04] bg-[#f0f0f2] shadow-sm transition-[max-width,transform] duration-300 dark:border-white/[0.04] dark:bg-[#161617] dark:shadow-none`,
    compact: 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/[0.04] bg-[#f0f0f2] dark:border-white/[0.04] dark:bg-[#161617]',
    default: 'flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl border border-black/[0.04] bg-[#f0f0f2] dark:border-white/[0.04] dark:bg-[#161617]',
  }[variant];
  const iconClass = {
    player: 'h-12 w-12',
    compact: 'h-5 w-5',
    default: 'h-7 w-7',
  }[variant];

  return (
    <div className={artworkClass}>
      {albumCover ? (
        <img
          src={albumCover}
          alt={t('nowPlaying.coverAlt', trackName)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Music className={`${iconClass} text-[#86868b]`} aria-hidden="true" />
      )}
    </div>
  );
};

const PlaybackStatus = ({ isPlaying, isExplicit, t, variant }) => {
  const iconSize = variant === 'compact' ? 14 : 16;
  const explicitClass = variant === 'compact'
    ? 'rounded bg-[#3a3a3c] px-1 py-0.5 text-[9px] font-black text-white'
    : 'rounded bg-[#3a3a3c] px-1.5 py-0.5 text-[10px] font-black text-white';
  const textClass = variant === 'compact'
    ? 'truncate text-[11px] font-bold text-[#6e6e73] dark:text-[#a1a1a6]'
    : 'truncate text-xs font-bold text-[#6e6e73] dark:text-[#a1a1a6]';

  return (
    <div className={`flex items-center ${variant === 'compact' ? 'gap-1.5' : 'gap-2'} ${variant === 'player' ? 'justify-center' : ''}`}>
      {isPlaying ? (
        <PlayCircle size={iconSize} className="shrink-0 text-[#16a34a]" aria-hidden="true" />
      ) : (
        <PauseCircle size={iconSize} className="shrink-0 text-[#86868b]" aria-hidden="true" />
      )}
      <span className={textClass}>
        {isPlaying ? t('nowPlaying.playing') : t('nowPlaying.paused')}
      </span>
      {isExplicit && (
        <span
          className={explicitClass}
          aria-label={t('nowPlaying.explicit')}
          title={t('nowPlaying.explicit')}
        >
          E
        </span>
      )}
    </div>
  );
};

const TrackInfo = ({ nowPlaying, t, track, variant }) => {
  const showAlbum = variant !== 'compact';

  if (variant === 'player') {
    return (
      <div className="mt-4 min-w-0 text-center">
        <div className="mb-2">
          <PlaybackStatus
            isExplicit={track.explicit}
            isPlaying={nowPlaying.isPlaying}
            t={t}
            variant={variant}
          />
        </div>
        <p className="truncate text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          {track.name}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
          {track.artistNames || t('preview.unknownArtist')}
        </p>
        {showAlbum && (
          <p className="truncate text-xs text-[#86868b]">
            {track.albumName || t('preview.unknownAlbum')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <PlaybackStatus
        isExplicit={track.explicit}
        isPlaying={nowPlaying.isPlaying}
        t={t}
        variant={variant}
      />
      <p className={`${variant === 'compact' ? 'mt-0.5 text-sm' : 'mt-1 text-base'} truncate font-bold text-[#1d1d1f] dark:text-[#f5f5f7]`}>
        {track.name}
      </p>
      <p className={`${variant === 'compact' ? 'text-[11px]' : 'text-xs'} truncate font-semibold text-[#6e6e73] dark:text-[#a1a1a6]`}>
        {track.artistNames || t('preview.unknownArtist')}
      </p>
      {showAlbum && (
        <p className="truncate text-xs text-[#86868b]">
          {track.albumName || t('preview.unknownAlbum')}
        </p>
      )}
    </div>
  );
};

const ProgressMeter = ({ durationMs, progressMs, t, variant }) => {
  const progressPercent = progressPercentFor(progressMs, durationMs);
  const roundedProgressMs = Math.round(progressMs);
  const heightClass = variant === 'compact' ? 'h-1.5' : 'h-2';
  const timeClass = variant === 'compact'
    ? 'mt-1.5 flex items-center justify-between text-[10px] font-semibold text-[#86868b]'
    : 'mt-2 flex items-center justify-between text-[11px] font-semibold text-[#86868b]';

  return (
    <div className={variant === 'compact' ? 'mt-3' : variant === 'player' ? 'mt-5' : 'mt-4'}>
      <div
        role="progressbar"
        aria-label={t('nowPlaying.progress')}
        aria-valuemin={0}
        aria-valuenow={roundedProgressMs}
        aria-valuemax={durationMs}
        aria-valuetext={`${formatDuration(roundedProgressMs)} / ${formatDuration(durationMs)}`}
        className={`${heightClass} overflow-hidden rounded-full bg-[#e8e8ed] dark:bg-[#2d2d30]`}
      >
        <div
          className="h-full rounded-full bg-[#0071e3] transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className={timeClass}>
        <span>{formatDuration(roundedProgressMs)}</span>
        <span>{formatDuration(durationMs)}</span>
      </div>
    </div>
  );
};

const PlaybackStateBadges = ({ nowPlaying, t, variant }) => {
  const badgeClass = variant === 'compact'
    ? 'rounded-lg bg-[#f5f5f7] px-2 py-1 text-[10px] font-semibold text-[#86868b] dark:bg-[#2d2d30]'
    : 'rounded-lg bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#86868b] dark:bg-[#2d2d30]';
  const wrapperClass = variant === 'player'
    ? 'mt-4 flex flex-wrap justify-center gap-2'
    : 'mt-3 flex flex-wrap items-center gap-2';
  const device = nowPlaying?.device || null;
  const shuffleState = nowPlaying?.shuffleState;
  const repeatState = nowPlaying?.repeatState;

  return (
    <div className={wrapperClass}>
      <span className={badgeClass}>
        {t('nowPlaying.activeDevice')}: {formatDeviceLabel(device, t)}
      </span>
      {device?.isPrivateSession && (
        <span className={badgeClass}>{t('nowPlaying.privateSession')}</span>
      )}
      {device?.isRestricted && (
        <span className={badgeClass}>{t('nowPlaying.restrictedDevice')}</span>
      )}
      {variant !== 'player' && typeof shuffleState === 'boolean' && (
        <span className={badgeClass}>
          {shuffleState ? t('nowPlaying.shuffleOn') : t('nowPlaying.shuffleOff')}
        </span>
      )}
      {variant !== 'player' && repeatState && (
        <span className={badgeClass}>
          {t('nowPlaying.repeat')}: {formatRepeatState(repeatState, t)}
        </span>
      )}
    </div>
  );
};

const SpotifyLink = ({ href, t, trackName, variant }) => {
  if (!href) return null;

  const className = variant === 'default'
    ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8e8ed] text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40'
    : `${variant === 'compact' ? 'h-8 w-8' : 'h-9 w-9'} inline-flex shrink-0 items-center justify-center rounded-lg bg-[#e8e8ed] text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('nowPlaying.openSpotify', trackName)}
      title={t('nowPlaying.openSpotify', trackName)}
      className={className}
    >
      <ExternalLink size={variant === 'compact' ? 14 : 16} aria-hidden="true" />
    </a>
  );
};

const SavedTrackButton = ({ t, track, trackLibrary, variant }) => {
  if (!trackLibrary?.canSaveTracks) return null;

  const isSaved = Boolean(trackLibrary.isSaved);
  const isSaving = Boolean(trackLibrary.isSaving);
  const label = isSaved
    ? t('nowPlaying.removeSavedTrack', track.name)
    : t('nowPlaying.saveTrack', track.name);
  const sizeClass = variant === 'compact' ? 'h-8 w-8' : 'h-9 w-9';
  const shapeClass = variant === 'default' ? 'rounded-full' : 'rounded-lg';
  const toneClass = isSaved
    ? 'text-[#ff3b30] hover:bg-[#ff3b30]/10 dark:hover:bg-[#ff3b30]/20'
    : 'text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 dark:hover:bg-[#ff3b30]/20';

  return (
    <button
      type="button"
      onClick={() => trackLibrary.onToggleSaved?.(track)}
      disabled={isSaving}
      aria-label={label}
      aria-pressed={isSaved}
      title={label}
      className={`${sizeClass} ${shapeClass} inline-flex shrink-0 items-center justify-center bg-[#e8e8ed] ${toneClass} transition-colors active:scale-95 disabled:cursor-wait disabled:opacity-60 dark:bg-[#2d2d30] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40`}
    >
      {isSaving ? (
        <Loader2 size={variant === 'compact' ? 13 : 15} className="animate-spin" aria-hidden="true" />
      ) : (
        <Heart size={variant === 'compact' ? 14 : 16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
      )}
    </button>
  );
};

const TrackLibraryError = ({ error, variant }) => {
  if (!error) return null;

  const className = variant === 'player'
    ? 'mt-2 text-center text-[11px] font-semibold text-red-600 dark:text-red-300'
    : 'mt-2 text-[11px] font-semibold text-red-600 dark:text-red-300';

  return <p className={className}>{error}</p>;
};

const QueueViewToggle = ({ playbackQueue, t }) => {
  if (!playbackQueue?.isSupported) return null;

  const items = [
    { id: 'now', icon: Music, label: t('nowPlaying.viewNow') },
    { id: 'queue', icon: ListOrdered, label: t('nowPlaying.viewQueue') },
    { id: 'recent', icon: Clock3, label: t('nowPlaying.viewRecent') },
  ];

  return (
    <div className="mt-4 flex justify-center">
      <div className="inline-flex rounded-full border border-black/[0.05] bg-[#f5f5f7] p-1 dark:border-white/[0.06] dark:bg-[#2d2d30]">
        {items.map(({ id, icon: Icon, label }) => {
          const isActive = playbackQueue.view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => playbackQueue.setView(id)}
              aria-pressed={isActive}
              aria-label={label}
              title={label}
              className={`inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 ${
                isActive
                  ? 'bg-white text-[#0071e3] shadow-sm dark:bg-[#1d1d1f] dark:text-[#8ec8ff]'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Icon size={13} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PlaybackQueueRow = ({ item, meta, playbackActions, t }) => {
  const track = item.track;
  const trackId = getPlayableTrackId(item);
  const isPending = Boolean(trackId && playbackActions?.pendingTrackId === trackId);
  const canPlay = Boolean(trackId && playbackActions?.onPlayTrack);
  const playTrack = () => {
    if (!canPlay || isPending) return;
    playbackActions.onPlayTrack(track || item).catch(() => {});
  };

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f0f0f2] dark:bg-[#161617]">
        {item.albumCover ? (
          <img src={item.albumCover} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music size={15} className="text-[#86868b]" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          {track.name}
        </p>
        <p className="truncate text-[11px] font-semibold text-[#86868b]">
          {track.artistNames || t('preview.unknownArtist')}
        </p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold text-[#86868b]">
        {meta || formatDuration(item.durationMs)}
      </span>
      <button
        type="button"
        onClick={playTrack}
        disabled={!canPlay || isPending}
        aria-label={t('nowPlaying.playTrack', track.name)}
        title={t('nowPlaying.playTrack', track.name)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white transition-colors hover:bg-[#0077ed] disabled:cursor-wait disabled:bg-[#c7c7cc] dark:disabled:bg-[#545458] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={13} className="translate-x-px" aria-hidden="true" />
        )}
      </button>
    </li>
  );
};

const formatPlayedAt = (playedAt) => {
  if (!playedAt) return '';
  const date = new Date(playedAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const PlaybackQueueList = ({ playbackActions, playbackQueue, t }) => {
  if (!playbackQueue?.isSupported || playbackQueue.view === 'now') return null;

  const isQueue = playbackQueue.view === 'queue';
  const items = isQueue
    ? playbackQueue.queue?.queue || []
    : playbackQueue.recentlyPlayed?.items || [];
  const emptyText = isQueue ? t('nowPlaying.queueEmpty') : t('nowPlaying.recentEmpty');
  const title = isQueue ? t('nowPlaying.queue') : t('nowPlaying.recentlyPlayed');

  return (
    <div className="mt-4 animate-fade-in rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-2 dark:border-[#333336]/60 dark:bg-[#161617]">
      <div className="mb-1 flex items-center justify-between gap-2 px-2 py-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
          {title}
        </p>
        <button
          type="button"
          onClick={() => playbackQueue.refresh(playbackQueue.view)}
          disabled={playbackQueue.isLoading}
          aria-label={t('nowPlaying.refreshQueue')}
          title={t('nowPlaying.refreshQueue')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#86868b] transition-colors hover:bg-[#e8e8ed] hover:text-[#1d1d1f] disabled:cursor-wait disabled:opacity-60 dark:hover:bg-[#2d2d30] dark:hover:text-[#f5f5f7] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
        >
          {playbackQueue.isLoading ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={13} aria-hidden="true" />
          )}
        </button>
      </div>

      {playbackQueue.error && (
        <p className="px-2 py-2 text-[11px] font-semibold text-red-600 dark:text-red-300">
          {playbackQueue.error}
        </p>
      )}

      {playbackActions?.error && (
        <p className="px-2 py-2 text-[11px] font-semibold text-red-600 dark:text-red-300">
          {playbackActions.error}
        </p>
      )}

      {!isQueue && playbackQueue.hasOptimisticRecentItems && (
        <p className="px-2 py-2 text-[11px] font-semibold leading-relaxed text-[#6e6e73] dark:text-[#a1a1a6]">
          {t('nowPlaying.recentPendingNote')}
        </p>
      )}

      {playbackQueue.isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs font-semibold text-[#86868b]">
          <Loader2 size={15} className="animate-spin text-[#0071e3]" aria-hidden="true" />
          <span>{t('nowPlaying.loadingQueue')}</span>
        </div>
      ) : items.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs font-semibold text-[#86868b]">
          {emptyText}
        </p>
      ) : (
        <ul className="max-h-[260px] overflow-y-auto">
          {items.slice(0, 20).map((item, index) => (
            <PlaybackQueueRow
              key={`${item.uri || item.id}-${item.playedAt || index}`}
              item={item}
              meta={isQueue ? String(index + 1) : formatPlayedAt(item.playedAt)}
              playbackActions={playbackActions}
              t={t}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const StateBlock = ({ children, tone = 'neutral', variant }) => {
  const neutralClass = variant === 'default'
    ? 'bg-[#fafafa] text-[#86868b] dark:bg-[#1c1c1e]'
    : 'bg-[#fafafa] text-[#86868b] dark:bg-[#161617]';
  const toneClass = tone === 'error'
    ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
    : neutralClass;
  const className = {
    player: `flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg px-4 py-8 text-center text-sm font-semibold ${toneClass}`,
    compact: `flex min-h-12 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${toneClass}`,
    default: `flex items-center gap-3 rounded-xl px-4 py-5 text-sm font-semibold ${toneClass}`,
  }[variant];

  return <div className={className}>{children}</div>;
};

const LoadingState = ({ t, variant }) => (
  <StateBlock variant={variant}>
    <Loader2 size={variant === 'player' ? 22 : variant === 'compact' ? 15 : 18} className="animate-spin text-[#0071e3]" aria-hidden="true" />
    <span className={variant === 'compact' ? 'truncate' : ''}>{t('nowPlaying.loading')}</span>
  </StateBlock>
);

const EmptyState = ({ message, variant }) => (
  <StateBlock variant={variant}>
    <Music size={variant === 'player' ? 28 : variant === 'compact' ? 15 : 18} className={variant === 'compact' ? 'shrink-0' : ''} aria-hidden="true" />
    <span className={variant === 'compact' ? 'line-clamp-2' : ''}>{message}</span>
  </StateBlock>
);

const ErrorState = ({ error, variant }) => {
  if (variant === 'compact') {
    return (
      <div className="flex min-h-12 items-center rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
        <span className="line-clamp-2">{error}</span>
      </div>
    );
  }

  const className = variant === 'player'
    ? 'flex min-h-56 flex-col justify-center gap-3 rounded-lg bg-red-50 px-4 py-8 text-center text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200'
    : 'flex items-center rounded-xl bg-red-50 px-4 py-4 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200';

  return (
    <div className={className}>
      <span>{error}</span>
    </div>
  );
};

const PlaybackControlButton = ({
  active = false,
  children,
  disabled,
  label,
  onClick,
  pending,
  showPending = true,
  size = 'md',
}) => {
  const isLarge = size === 'lg';
  const isInteractionDisabled = Boolean(disabled || pending);
  const sizeClass = isLarge ? 'h-12 w-12 rounded-full' : 'h-10 w-10 rounded-full';
  const toneClass = isLarge
    ? 'bg-[#1d1d1f] text-white shadow-[0_4px_14px_rgba(0,0,0,0.16)] hover:bg-[#2c2c2e] active:scale-[0.96] dark:bg-[#f5f5f7] dark:text-[#1d1d1f] dark:shadow-[0_4px_16px_rgba(0,0,0,0.32)] dark:hover:bg-white'
    : active
      ? 'text-[#0071e3] hover:text-[#005bb5] dark:text-[#8fc7ff] dark:hover:text-[#b8dcff]'
      : 'text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-[#f5f5f7]';

  return (
    <span className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={(event) => {
          if (isInteractionDisabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        disabled={disabled}
        aria-disabled={isInteractionDisabled}
        aria-label={label}
        aria-pressed={!isLarge && active ? true : undefined}
        title={label}
        className={`inline-flex shrink-0 items-center justify-center ${sizeClass} ${toneClass} outline-none transition-[background-color,color,transform,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#c7c7cc] disabled:shadow-none disabled:hover:bg-transparent dark:disabled:text-[#545458]`}
      >
        {pending && showPending ? (
          <Loader2 size={size === 'lg' ? 18 : 15} className="animate-spin" aria-hidden="true" />
        ) : children}
      </button>
      {!isLarge && active && (
        <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#0071e3] dark:bg-[#8fc7ff]" aria-hidden="true" />
      )}
    </span>
  );
};

const PlaybackControls = ({
  canControlPlayback,
  controlError,
  controlPending,
  controlPlayback,
  nowPlaying,
  t,
}) => {
  if (!canControlPlayback) return null;

  const device = nowPlaying?.device || null;
  const deviceId = device?.id || '';
  const isDisabled = !device || device.isRestricted;
  const isPlaying = Boolean(nowPlaying?.isPlaying);
  const shuffleState = Boolean(nowPlaying?.shuffleState);
  const repeatState = nowPlaying?.repeatState || 'off';
  const basePayload = deviceId ? { deviceId } : {};
  const repeatLabel = getRepeatLabel(repeatState, t);
  const isPlayPausePending = controlPending === 'play' || controlPending === 'pause';

  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <div className="flex h-16 w-full max-w-[292px] items-center justify-between rounded-full border border-black/[0.04] bg-white/70 px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <PlaybackControlButton
          active={shuffleState}
          disabled={isDisabled}
          label={shuffleState ? t('nowPlaying.turnShuffleOff') : t('nowPlaying.turnShuffleOn')}
          onClick={() => controlPlayback('shuffle', { ...basePayload, state: !shuffleState })}
          pending={controlPending === 'shuffle'}
        >
          <Shuffle size={15} aria-hidden="true" />
        </PlaybackControlButton>
        <PlaybackControlButton
          disabled={isDisabled}
          label={t('nowPlaying.previous')}
          onClick={() => controlPlayback('previous', basePayload)}
          pending={controlPending === 'previous'}
        >
          <SkipBack size={16} aria-hidden="true" />
        </PlaybackControlButton>
        <PlaybackControlButton
          disabled={isDisabled}
          label={isPlaying ? t('nowPlaying.pause') : t('nowPlaying.play')}
          onClick={() => controlPlayback(isPlaying ? 'pause' : 'play', basePayload)}
          pending={isPlayPausePending}
          showPending={false}
          size="lg"
        >
          {isPlaying ? (
            <Pause size={22} aria-hidden="true" />
          ) : (
            <Play size={22} className="translate-x-px" aria-hidden="true" />
          )}
        </PlaybackControlButton>
        <PlaybackControlButton
          disabled={isDisabled}
          label={t('nowPlaying.next')}
          onClick={() => controlPlayback('next', basePayload)}
          pending={controlPending === 'next'}
        >
          <SkipForward size={16} aria-hidden="true" />
        </PlaybackControlButton>
        <PlaybackControlButton
          active={repeatState !== 'off'}
          disabled={isDisabled}
          label={repeatLabel}
          onClick={() => controlPlayback('repeat', { ...basePayload, state: getNextRepeatState(repeatState) })}
          pending={controlPending === 'repeat'}
        >
          <RepeatModeIcon state={repeatState} />
        </PlaybackControlButton>
      </div>
      {controlError && (
        <p className="max-w-full text-center text-[11px] font-semibold text-red-600 dark:text-red-300">
          {controlError}
        </p>
      )}
    </div>
  );
};

const DefaultContent = ({ durationMs, nowPlaying, progressMs, t, track, trackLibrary }) => (
  <div className="grid gap-4 md:grid-cols-[72px_1fr]">
    <NowPlayingArtwork
      albumCover={nowPlaying.albumCover}
      trackName={track.name}
      t={t}
      variant="default"
    />

    <div className="min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <TrackInfo nowPlaying={nowPlaying} t={t} track={track} variant="default" />
        <div className="flex shrink-0 items-center gap-2">
          <SavedTrackButton t={t} track={track} trackLibrary={trackLibrary} variant="default" />
          <SpotifyLink href={nowPlaying.externalUrl} t={t} trackName={track.name} variant="default" />
        </div>
      </div>

      <ProgressMeter durationMs={durationMs} progressMs={progressMs} t={t} variant="default" />
      <TrackLibraryError error={trackLibrary?.error} variant="default" />
      <PlaybackStateBadges nowPlaying={nowPlaying} t={t} variant="default" />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#86868b]">
        <span className="rounded-full bg-[#f5f5f7] px-2 py-1 dark:bg-[#2d2d30]">
          {t('nowPlaying.isrc')}: {track.isrc || t('nowPlaying.notAvailable')}
        </span>
      </div>
    </div>
  </div>
);

const CompactContent = ({ durationMs, nowPlaying, progressMs, t, track, trackLibrary }) => (
  <div className="min-w-0">
    <div className="flex items-center gap-3">
      <NowPlayingArtwork
        albumCover={nowPlaying.albumCover}
        trackName={track.name}
        t={t}
        variant="compact"
      />
      <TrackInfo nowPlaying={nowPlaying} t={t} track={track} variant="compact" />
      <div className="flex shrink-0 items-center gap-1">
        <SavedTrackButton t={t} track={track} trackLibrary={trackLibrary} variant="compact" />
        <SpotifyLink href={nowPlaying.externalUrl} t={t} trackName={track.name} variant="compact" />
      </div>
    </div>

    <ProgressMeter durationMs={durationMs} progressMs={progressMs} t={t} variant="compact" />
    <TrackLibraryError error={trackLibrary?.error} variant="compact" />
    <PlaybackStateBadges nowPlaying={nowPlaying} t={t} variant="compact" />
  </div>
);

const PlayerContent = ({
  canControlPlayback,
  controlError,
  controlPending,
  controlPlayback,
  durationMs,
  nowPlaying,
  playbackActions,
  playbackQueue,
  progressMs,
  t,
  track,
  trackLibrary,
}) => {
  const isQueueView = playbackQueue?.isSupported && playbackQueue.view !== 'now';

  return (
    <div className="min-w-0">
    <NowPlayingArtwork
      albumCover={nowPlaying.albumCover}
      condensed={isQueueView}
      trackName={track.name}
      t={t}
      variant="player"
    />
    <TrackInfo nowPlaying={nowPlaying} t={t} track={track} variant="player" />
    <QueueViewToggle playbackQueue={playbackQueue} t={t} />

    {isQueueView ? (
      <PlaybackQueueList playbackActions={playbackActions} playbackQueue={playbackQueue} t={t} />
    ) : (
      <>
        <ProgressMeter durationMs={durationMs} progressMs={progressMs} t={t} variant="player" />
        <PlaybackControls
          canControlPlayback={canControlPlayback}
          controlError={controlError}
          controlPending={controlPending}
          controlPlayback={controlPlayback}
          nowPlaying={nowPlaying}
          t={t}
        />
        <PlaybackStateBadges nowPlaying={nowPlaying} t={t} variant="player" />
      </>
    )}

    <div className="mt-4 flex items-center justify-between gap-2">
      <span className="min-w-0 truncate rounded-lg bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#86868b] dark:bg-[#2d2d30]">
        {t('nowPlaying.isrc')}: {track.isrc || t('nowPlaying.notAvailable')}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <SavedTrackButton t={t} track={track} trackLibrary={trackLibrary} variant="player" />
        <SpotifyLink href={nowPlaying.externalUrl} t={t} trackName={track.name} variant="player" />
      </div>
    </div>
    <TrackLibraryError error={trackLibrary?.error} variant="player" />
  </div>
  );
};

export const NowPlayingPanel = ({ playback, playbackActions = null, playbackQueue = null, trackLibrary = null, variant = 'default' }) => {
  const { t } = useI18n();
  const {
    canControlPlayback,
    controlError,
    controlPending,
    controlPlayback,
    displayProgressMs,
    durationMs,
    error,
    isLoading,
    isSupported,
    nowPlaying,
  } = playback || {};

  if (!isSupported) return null;

  const track = nowPlaying?.track;
  const isTrackAvailable = Boolean(nowPlaying?.isAvailable && track);
  const unavailableMessage = nowPlaying?.reason === 'unsupported_type'
    ? t('nowPlaying.unsupportedType', nowPlaying.currentlyPlayingType || t('nowPlaying.unknownType'))
    : nowPlaying?.reason === 'no_active_device'
      ? t('nowPlaying.noActiveDevice')
    : t('nowPlaying.noActivePlayback');
  const isPlayer = variant === 'player';
  const isCompact = variant === 'compact';
  const normalizedVariant = isPlayer ? 'player' : isCompact ? 'compact' : 'default';
  const content = isLoading && !nowPlaying ? (
    <LoadingState t={t} variant={normalizedVariant} />
  ) : error ? (
    <ErrorState error={error} variant={normalizedVariant} />
  ) : !isTrackAvailable ? (
    <EmptyState message={unavailableMessage} variant={normalizedVariant} />
  ) : normalizedVariant === 'player' ? (
    <PlayerContent
      durationMs={durationMs}
      canControlPlayback={canControlPlayback}
      controlError={controlError}
      controlPending={controlPending}
      controlPlayback={controlPlayback}
      nowPlaying={nowPlaying}
      playbackActions={playbackActions}
      playbackQueue={playbackQueue}
      progressMs={displayProgressMs}
      t={t}
      track={track}
      trackLibrary={trackLibrary}
    />
  ) : normalizedVariant === 'compact' ? (
    <CompactContent
      durationMs={durationMs}
      nowPlaying={nowPlaying}
      progressMs={displayProgressMs}
      t={t}
      track={track}
      trackLibrary={trackLibrary}
    />
  ) : (
    <DefaultContent
      durationMs={durationMs}
      nowPlaying={nowPlaying}
      progressMs={displayProgressMs}
      t={t}
      track={track}
      trackLibrary={trackLibrary}
    />
  );

  if (isPlayer) {
    return (
      <section className="w-full animate-fade-in-up">
        <div className="min-h-[560px] rounded-lg border border-[#e5e5e7] bg-white p-4 shadow-sm dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:shadow-none lg:min-h-[640px]">
          {content}
        </div>
      </section>
    );
  }

  if (isCompact) {
    return (
      <section className="w-full animate-fade-in-up">
        <div className="rounded-lg border border-[#e5e5e7] bg-white p-3 shadow-sm dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:shadow-none">
          <div className="mb-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
              {t('nowPlaying.title')}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {isTrackAvailable ? track.name : t('nowPlaying.emptyTitle')}
            </p>
          </div>

          {content}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 w-full animate-fade-in-up">
      <div className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-sm dark:border-[#333336]/40 dark:bg-[#1d1d1f] dark:shadow-none md:p-5">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
            {t('nowPlaying.title')}
          </p>
          <h2 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {isTrackAvailable ? track.name : t('nowPlaying.emptyTitle')}
          </h2>
        </div>

        {content}
      </div>
    </section>
  );
};
