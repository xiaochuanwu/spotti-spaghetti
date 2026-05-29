import { useState, useEffect, useRef } from 'react';
import { X, Music, Clock, ExternalLink, Loader2, Heart, Play } from 'lucide-react';
import { useI18n } from '../i18n';

const PREVIEW_PAGE_SIZE = 50;
const EMPTY_TRACK_IDS = new Set();

const getFocusableElements = (node) => (
  Array.from(node?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) || []).filter(element => !element.disabled && element.getAttribute('aria-hidden') !== 'true')
);

const formatDuration = (ms) => {
  if (!ms) return '0:00';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getTrackId = (track) => track?.id || track?.providerTrackId || '';

const PlaylistPreviewTrackExternalLink = ({ track, t }) => (
  track.externalUrl ? (
    <a
      href={track.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="p-1 rounded-md text-[#86868b] hover:text-[#0071e3] hover:bg-[#0071e3]/10 dark:hover:bg-[#0071e3]/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
      aria-label={t('preview.listenSpotify')}
      title={t('preview.listenSpotify')}
    >
      <ExternalLink size={12} />
    </a>
  ) : null
);

const PlaylistPreviewTrackDefaultActions = ({
  canSaveTracks,
  canPlayTracks,
  isSaved,
  isSaving,
  isPlayPending,
  onToggleSaved,
  onPlayTrack,
  t,
  track,
}) => (
  <div className="flex items-center justify-end gap-1">
    {canPlayTracks && (
      <button
        type="button"
        onClick={() => onPlayTrack(track)}
        disabled={isPlayPending}
        aria-label={t('preview.playTrack', track.name)}
        className="p-1 rounded-md text-[#0071e3] transition-all hover:bg-[#0071e3]/10 active:scale-90 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-[#0071e3]/20 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
        title={t('preview.playTrack', track.name)}
      >
        {isPlayPending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={13} className="translate-x-px" aria-hidden="true" />
        )}
      </button>
    )}
    {canSaveTracks && (
      <button
        type="button"
        onClick={() => onToggleSaved(track)}
        disabled={isSaving}
        aria-label={isSaved ? t('preview.removeSavedTrack', track.name) : t('preview.saveTrack', track.name)}
        aria-pressed={isSaved}
        className={`p-1 rounded-md transition-all active:scale-90 disabled:cursor-wait disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 ${
          isSaved
            ? 'text-[#ff3b30] hover:bg-[#ff3b30]/10 dark:hover:bg-[#ff3b30]/20'
            : 'text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 dark:hover:bg-[#ff3b30]/20'
        }`}
        title={isSaved ? t('preview.removeSavedTrack', track.name) : t('preview.saveTrack', track.name)}
      >
        <Heart size={13} fill={isSaved ? 'currentColor' : 'none'} />
      </button>
    )}
    <PlaylistPreviewTrackExternalLink track={track} t={t} />
  </div>
);

const PlaylistPreviewTrackRow = ({
  canSaveTracks,
  canPlayTracks,
  index,
  isSaved,
  isSaving,
  isPlayPending,
  onToggleSaved,
  onPlayTrack,
  renderActions,
  t,
  track,
}) => {
  const defaultActions = (
    <PlaylistPreviewTrackDefaultActions
      canSaveTracks={canSaveTracks}
      canPlayTracks={canPlayTracks}
      isSaved={isSaved}
      isSaving={isSaving}
      isPlayPending={isPlayPending}
      onToggleSaved={onToggleSaved}
      onPlayTrack={onPlayTrack}
      t={t}
      track={track}
    />
  );
  const renderedActions = renderActions ? renderActions({ defaultActions, index, track }) : null;
  const actions = renderActions
    ? renderedActions
    : defaultActions;

  return (
    <div
      className="flex items-center text-xs text-[#1d1d1f] dark:text-[#f5f5f7] px-2 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group"
    >
      <div className="w-8 shrink-0 flex items-center justify-center text-[11px] font-medium text-[#86868b]">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded bg-[#f0f0f2] dark:bg-[#161617] overflow-hidden flex items-center justify-center shrink-0">
          {track.albumCover ? (
            <img src={track.albumCover} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-3 text-[#86868b]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{track.name}</p>
          <p className="text-[10px] text-[#86868b] truncate mt-0.5">
            {track.artists || t('preview.unknownArtist')}
          </p>
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-4 text-[#6e6e73] dark:text-[#a1a1a6] truncate hidden sm:block">
        {track.albumName || t('preview.unknownAlbum')}
      </div>

      <div className="w-16 shrink-0 text-center text-[#86868b]">
        {formatDuration(track.durationMs)}
      </div>

      <div className="w-20 shrink-0 flex justify-end">
        {actions}
      </div>
    </div>
  );
};

export const PlaylistPreviewModal = ({
  formatError,
  isOpen,
  onAuthExpired,
  onClose,
  playlist,
  playbackActions,
  provider,
  renderTrackActions,
  trackLibrary,
}) => {
  const { t } = useI18n();
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [trackActionError, setTrackActionError] = useState('');
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const canSaveTracks = Boolean(trackLibrary?.canSaveTracks);
  const loadSavedTrackIds = trackLibrary?.loadSavedTrackIds;
  const savedTrackIds = trackLibrary?.savedTrackIds || EMPTY_TRACK_IDS;
  const savingTrackIds = trackLibrary?.savingTrackIds || EMPTY_TRACK_IDS;
  const toggleSavedTrack = trackLibrary?.toggleSavedTrack;
  const pendingContextUri = playbackActions?.pendingContextUri || '';
  const pendingTrackId = playbackActions?.pendingTrackId || '';
  const canPlayTracks = Boolean(playbackActions?.onPlayTrack);
  const canPlayPlaylist = Boolean(playlist?.uri && playbackActions?.onPlayContext);

  useEffect(() => {
    if (!isOpen || !playlist || !provider) return;

    let isCurrentRequest = true;
    const abortController = new AbortController();

    // Fetch preview tracks
    const fetchPreviewTracks = async () => {
      setIsLoading(true);
      setError(null);
      setTrackActionError('');
      setTracks([]);
      setNextOffset(0);
      setHasMore(false);
      try {
        const data = await provider.getPlaylistTracksPreview(playlist, 0, PREVIEW_PAGE_SIZE, {
          signal: abortController.signal,
        });
        if (isCurrentRequest) {
          setTracks(data.tracks);
          setNextOffset(data.nextOffset);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        console.error('Failed to load preview:', err);
        if (isCurrentRequest && err?.code !== 'SPOTIFY_REQUEST_CANCELLED') setError(t('preview.loadFailed'));
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    fetchPreviewTracks();

    // Prevent background scrolling
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      isCurrentRequest = false;
      abortController.abort();
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, playlist, provider, t]);

  useEffect(() => {
    if (!isOpen || !canSaveTracks || tracks.length === 0 || !loadSavedTrackIds) return undefined;

    let isCurrentRequest = true;
    const abortController = new AbortController();
    const trackIds = Array.from(new Set(tracks.map(getTrackId).filter(Boolean)));
    if (trackIds.length === 0) return undefined;

    loadSavedTrackIds(trackIds, { signal: abortController.signal })
      .catch(err => {
        if (!isCurrentRequest || err?.code === 'SPOTIFY_REQUEST_CANCELLED') return;
        console.error('Failed to load saved track state:', err);
        onAuthExpired?.(err);
        setTrackActionError(formatError?.(err) || t('preview.savedLoadFailed'));
      });

    return () => {
      isCurrentRequest = false;
      abortController.abort();
    };
  }, [canSaveTracks, formatError, isOpen, loadSavedTrackIds, onAuthExpired, tracks, t]);

  // Escape key event listener
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousActiveElement = document.activeElement;
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !playlist) return null;

  const playlistImg = playlist.images && playlist.images.length > 0 ? playlist.images[0].url : null;
  const isPlaylistPending = Boolean(playlist.uri && pendingContextUri === playlist.uri);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !provider) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const data = await provider.getPlaylistTracksPreview(playlist, nextOffset, PREVIEW_PAGE_SIZE);
      setTracks(current => [...current, ...data.tracks]);
      setNextOffset(data.nextOffset);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to load more preview tracks:', err);
      setError(t('preview.loadFailed'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleToggleSavedTrack = async (track) => {
    const trackId = getTrackId(track);
    if (!trackId || !canSaveTracks || !toggleSavedTrack || savingTrackIds.has(trackId)) return;

    setTrackActionError('');

    try {
      await toggleSavedTrack(track);
    } catch (err) {
      console.error('Failed to update saved track state:', err);
      onAuthExpired?.(err);
      setTrackActionError(formatError?.(err) || t('preview.savedActionFailed'));
    }
  };

  const handlePlayPreviewTrack = async (track) => {
    const trackId = getTrackId(track);
    if (!trackId || !canPlayTracks || pendingTrackId === trackId) return;

    setTrackActionError('');
    try {
      await playbackActions.onPlayTrack(track, playlist?.uri ? { contextUri: playlist.uri } : {});
    } catch (err) {
      console.error('Failed to play preview track:', err);
      onAuthExpired?.(err);
      setTrackActionError(formatError?.(err) || t('libraryBrowse.playFailed'));
    }
  };

  const handlePlayPreviewPlaylist = async () => {
    if (!canPlayPlaylist || isPlaylistPending) return;

    setTrackActionError('');
    try {
      await playbackActions.onPlayContext(playlist.uri);
    } catch (err) {
      console.error('Failed to play preview playlist:', err);
      onAuthExpired?.(err);
      setTrackActionError(formatError?.(err) || t('libraryBrowse.playFailed'));
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 select-none animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="playlist-preview-title"
    >
      <div
        ref={dialogRef}
        className="bg-white/95 dark:bg-[#1c1c1e]/95 border border-[#e5e5e7] dark:border-[#333336] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e5e5e7] dark:border-[#333336]/60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#f0f0f2] dark:bg-[#161617] overflow-hidden flex items-center justify-center border border-black/[0.06] dark:border-white/[0.06] shrink-0">
              {playlistImg ? (
                <img src={playlistImg} alt={playlist.name} className="w-full h-full object-cover" />
              ) : (
                <Music className="w-5 h-5 text-[#86868b]" />
              )}
            </div>
            <div>
              <h2 id="playlist-preview-title" className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-base md:text-lg leading-tight truncate max-w-[320px] md:max-w-[420px]">
                {playlist.name}
              </h2>
              <p className="text-[11px] font-semibold text-[#86868b] mt-0.5 uppercase tracking-wider">
                {t('preview.title')} · {playlist.tracks?.total} {t('playlists.tracks')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canPlayPlaylist && (
              <button
                type="button"
                onClick={handlePlayPreviewPlaylist}
                disabled={isPlaylistPending}
                aria-label={t('preview.playPlaylist', playlist.name)}
                title={t('preview.playPlaylist', playlist.name)}
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#0071e3] px-3 text-xs font-bold text-white transition-colors hover:bg-[#0077ed] disabled:cursor-wait disabled:bg-[#c7c7cc] dark:disabled:bg-[#545458] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
              >
                {isPlaylistPending ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Play size={13} className="translate-x-px" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{t('preview.playCurrentPlaylist')}</span>
              </button>
            )}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label={t('preview.close')}
              className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-[#2d2d30] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] flex items-center justify-center cursor-pointer transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-[#0071e3] animate-spin mb-4" />
              <p className="text-xs font-semibold text-[#86868b] animate-pulse">{t('preview.loading')}</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600 dark:text-red-400 font-medium text-sm">
              {error}
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-16 text-center text-[#86868b] font-medium text-sm">
              {t('preview.empty')}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Table Header */}
              <div className="flex items-center text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-2 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                <div className="w-8 text-center shrink-0">#</div>
                <div className="flex-1 min-w-0 pr-4">{t('preview.col.title')}</div>
                <div className="flex-1 min-w-0 pr-4 hidden sm:block">{t('preview.col.album')}</div>
                <div className="w-16 text-center shrink-0"><Clock size={12} className="inline-block" /></div>
                <div className="w-20 shrink-0"></div>
              </div>

              {trackActionError && (
                <div className="px-2 py-2 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  {trackActionError}
                </div>
              )}

              {/* Tracks List */}
              {tracks.map((track, index) => (
                <PlaylistPreviewTrackRow
                  key={`${track.id || track.externalUrl || track.name}-${index}`}
                  canSaveTracks={canSaveTracks}
                  canPlayTracks={canPlayTracks}
                  index={index}
                  isPlayPending={pendingTrackId === getTrackId(track)}
                  isSaved={savedTrackIds.has(getTrackId(track))}
                  isSaving={savingTrackIds.has(getTrackId(track))}
                  onPlayTrack={handlePlayPreviewTrack}
                  onToggleSaved={handleToggleSavedTrack}
                  renderActions={renderTrackActions}
                  t={t}
                  track={track}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 rounded-full bg-[#e8e8ed] px-4 py-2 text-xs font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white disabled:text-[#86868b] dark:bg-[#2d2d30] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
                  >
                    {isLoadingMore && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    <span>{t('preview.loadMore')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#fafafa] dark:bg-[#1c1c1e] p-4 flex flex-col sm:flex-row items-center justify-between border-t border-[#e5e5e7] dark:border-[#333336]/60 gap-4">
          <span className="text-[11px] font-medium text-[#86868b]">
            {t('preview.loaded', tracks.length, playlist.tracks?.total || tracks.length)}
          </span>
          <button 
            onClick={onClose}
            className="w-full sm:w-auto bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs px-5 py-2 rounded-full cursor-pointer transition-all duration-200 active:scale-95 text-center outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
          >
            {t('preview.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
