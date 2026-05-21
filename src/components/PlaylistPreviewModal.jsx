import { useState, useEffect, useRef } from 'react';
import { X, Music, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { spotify } from '../services/spotify';

const PREVIEW_PAGE_SIZE = 50;

const getFocusableElements = (node) => (
  Array.from(node?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) || []).filter(element => !element.disabled && element.getAttribute('aria-hidden') !== 'true')
);

export const PlaylistPreviewModal = ({ isOpen, onClose, playlist }) => {
  const { t } = useI18n();
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Helper to format ms to mm:ss
  const formatDuration = (ms) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isOpen || !playlist) return;

    let isCurrentRequest = true;
    const abortController = new AbortController();

    // Fetch preview tracks
    const fetchPreviewTracks = async () => {
      setIsLoading(true);
      setError(null);
      setTracks([]);
      setNextOffset(0);
      setHasMore(false);
      try {
        const data = await spotify.getPlaylistTracksPreview(playlist, 0, PREVIEW_PAGE_SIZE, {
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
  }, [isOpen, playlist, t]);

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

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const data = await spotify.getPlaylistTracksPreview(playlist, nextOffset, PREVIEW_PAGE_SIZE);
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
          <button 
            ref={closeButtonRef}
            onClick={onClose}
            aria-label={t('preview.close')}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] dark:bg-[#2d2d30] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] flex items-center justify-center cursor-pointer transition-all active:scale-90"
          >
            <X size={15} />
          </button>
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
                <div className="w-10 shrink-0"></div>
              </div>

              {/* Tracks List */}
              {tracks.map((track, index) => (
                <div 
                  key={`${track.id || track.externalUrl || track.name}-${index}`}
                  className="flex items-center text-xs text-[#1d1d1f] dark:text-[#f5f5f7] px-2 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Index/Art */}
                  <div className="w-8 shrink-0 flex items-center justify-center text-[11px] font-medium text-[#86868b]">
                    {index + 1}
                  </div>

                  {/* Title & Artist */}
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

                  {/* Album */}
                  <div className="flex-1 min-w-0 pr-4 text-[#6e6e73] dark:text-[#a1a1a6] truncate hidden sm:block">
                    {track.albumName || t('preview.unknownAlbum')}
                  </div>

                  {/* Duration */}
                  <div className="w-16 shrink-0 text-center text-[#86868b]">
                    {formatDuration(track.durationMs)}
                  </div>

                  {/* External Link */}
                  <div className="w-10 shrink-0 flex justify-end">
                    {track.externalUrl && (
                      <a 
                        href={track.externalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1 rounded-md text-[#86868b] hover:text-[#0071e3] hover:bg-[#0071e3]/10 dark:hover:bg-[#0071e3]/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={t('preview.listenSpotify')}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 rounded-full bg-[#e8e8ed] px-4 py-2 text-xs font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white disabled:text-[#86868b] dark:bg-[#2d2d30]"
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
            className="w-full sm:w-auto bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs px-5 py-2 rounded-full cursor-pointer transition-all duration-200 active:scale-95 text-center"
          >
            {t('preview.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
