import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, ExternalLink, LibraryBig, ListMusic, Loader2, Music, Play, RefreshCw, Search } from 'lucide-react';
import { useI18n } from '../../i18n';

const PLAYLIST_PAGE_SIZE = 50;
const SPOTIFY_TRACK_URI_PREFIX = 'spotify:track:';

const tabs = [
  { id: 'home', icon: Compass, labelKey: 'libraryBrowse.home' },
  { id: 'playlists', icon: LibraryBig, labelKey: 'libraryBrowse.playlists' },
  { id: 'search', icon: Search, labelKey: 'libraryBrowse.search' },
];

const chartPlaylists = [
  { id: 'global', labelKey: 'libraryBrowse.chartGlobal', market: '', playlistId: '37i9dQZEVXbMDoHDwVN2tF' },
  { id: 'us', labelKey: 'libraryBrowse.chartUS', market: 'US', playlistId: '37i9dQZEVXbLRQDuF5jeBp' },
  { id: 'gb', labelKey: 'libraryBrowse.chartGB', market: 'GB', playlistId: '37i9dQZEVXbLnolsZ8PSNw' },
  { id: 'jp', labelKey: 'libraryBrowse.chartJP', market: 'JP', playlistId: '37i9dQZEVXbKXQ4mDTEBXq' },
  { id: 'tw', labelKey: 'libraryBrowse.chartTW', market: 'TW', playlistId: '37i9dQZEVXbMnZEatlMSiu' },
  { id: 'hk', labelKey: 'libraryBrowse.chartHK', market: 'HK', playlistId: '37i9dQZEVXbLwpL8TjsxOG' },
];

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getTrackId = (track = {}) => {
  const value = track.providerTrackId || track.id || track.uri || '';
  const text = String(value).trim();
  return text.startsWith(SPOTIFY_TRACK_URI_PREFIX)
    ? text.slice(SPOTIFY_TRACK_URI_PREFIX.length)
    : text;
};

const getPlaylistCover = (playlist = {}) => playlist.images?.[0]?.url || '';

const getChartPlaylistUri = chart => `spotify:playlist:${chart.playlistId}`;

const getChartExternalUrl = chart => `https://open.spotify.com/playlist/${chart.playlistId}`;

const normalizeSearchTrack = (track = {}) => ({
  id: track.id || '',
  uri: track.uri || '',
  name: track.name || '',
  artists: track.artists?.map(artist => artist?.name).filter(Boolean).join(', ') || '',
  albumName: track.album?.name || '',
  albumCover: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || '',
  durationMs: track.duration_ms || 0,
  externalUrl: track.external_urls?.spotify || '',
});

const normalizePlayerItem = (item = {}) => {
  const track = item.track || item;
  return {
    id: track.providerTrackId || item.id || track.id || '',
    uri: track.uri || item.uri || '',
    name: track.name || '',
    artists: track.artistNames || track.artists || '',
    albumName: track.albumName || item.albumName || '',
    albumCover: item.albumCover || track.albumCover || '',
    durationMs: item.durationMs || track.durationMs || 0,
    contextUri: item.context?.uri || '',
    playedAt: item.playedAt || '',
  };
};

const BrowseTabs = ({ activeTab, onChange, t }) => (
  <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
    {tabs.map(({ id, icon: Icon, labelKey }) => {
      const isActive = activeTab === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={isActive}
          title={t(labelKey)}
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${
            isActive
              ? 'border-[#0071e3] bg-[#0071e3] text-white'
              : 'border-[#e5e5e7] bg-white text-[#6e6e73] hover:border-[#0071e3]/30 hover:bg-[#eef5ff] hover:text-[#005bb5] dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:border-[#0a84ff]/35 dark:hover:bg-[#10243a] dark:hover:text-[#8ec8ff]'
          } outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40`}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </button>
      );
    })}
  </div>
);

const TrackRow = ({
  contextUri,
  index,
  onPlayTrack,
  pendingTrackId,
  t,
  track,
}) => {
  const trackId = getTrackId(track);
  const rowContextUri = contextUri || track.contextUri || '';
  const isPending = Boolean(trackId && pendingTrackId === trackId);
  const canPlay = Boolean(trackId && onPlayTrack);

  const playTrack = () => {
    if (!canPlay || isPending) return;
    onPlayTrack(track, rowContextUri ? { contextUri: rowContextUri } : {}).catch(() => {});
  };

  return (
    <li className="group flex min-w-0 items-center gap-3 overflow-hidden rounded-lg px-2 py-2.5 text-xs transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <div className="flex w-6 shrink-0 justify-center text-[11px] font-semibold text-[#86868b]">
        {index + 1}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f0f0f2] dark:bg-[#161617]">
        {track.albumCover ? (
          <img src={track.albumCover} alt="" className="h-full w-full object-cover" />
        ) : (
          <Music size={15} className="text-[#86868b]" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          {track.name || t('nowPlaying.emptyTitle')}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-[#86868b]">
          {track.artists || t('preview.unknownArtist')}
        </p>
      </div>
      <div className="hidden min-w-0 flex-1 truncate text-[11px] font-semibold text-[#6e6e73] dark:text-[#a1a1a6] md:block">
        {track.albumName || t('preview.unknownAlbum')}
      </div>
      <span className="w-12 shrink-0 text-right text-[10px] font-semibold text-[#86868b]">
        {formatDuration(track.durationMs)}
      </span>
      <button
        type="button"
        onClick={playTrack}
        disabled={!canPlay || isPending}
        aria-label={t('libraryBrowse.playTrack', track.name || t('nowPlaying.emptyTitle'))}
        title={t('libraryBrowse.playTrack', track.name || t('nowPlaying.emptyTitle'))}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white transition-colors hover:bg-[#0077ed] disabled:cursor-wait disabled:bg-[#c7c7cc] dark:disabled:bg-[#545458] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={14} className="translate-x-px" aria-hidden="true" />
        )}
      </button>
    </li>
  );
};

const TrackList = ({
  contextUri = '',
  emptyText,
  error,
  isLoading,
  loadingText,
  onPlayTrack,
  pendingTrackId,
  t,
  tracks,
}) => {
  if (isLoading && tracks.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-2 rounded-lg bg-[#fafafa] px-4 py-8 text-sm font-semibold text-[#86868b] dark:bg-[#161617]">
        <Loader2 size={17} className="animate-spin text-[#0071e3]" aria-hidden="true" />
        <span>{loadingText}</span>
      </div>
    );
  }

  if (error && tracks.length === 0) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-5 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg bg-[#fafafa] px-4 py-8 text-center text-sm font-semibold text-[#86868b] dark:bg-[#161617]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e5e7] bg-white p-2 dark:border-[#333336]/60 dark:bg-[#1d1d1f]">
      {error && (
        <p className="px-2 py-2 text-[11px] font-semibold text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      <ul className="max-h-[520px] overflow-y-auto">
        {tracks.map((track, index) => (
          <TrackRow
            key={`${track.id || track.uri || track.name}-${index}`}
            contextUri={contextUri}
            index={index}
            onPlayTrack={onPlayTrack}
            pendingTrackId={pendingTrackId}
            t={t}
            track={track}
          />
        ))}
      </ul>
    </div>
  );
};

export const PlaybackBrowserPanel = ({
  formatError,
  onAuthExpired,
  playbackActions,
  playlists = [],
  provider,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('home');
  const [homeTracks, setHomeTracks] = useState([]);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [homeError, setHomeError] = useState('');
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [playlistError, setPlaylistError] = useState('');
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [playlistNextOffset, setPlaylistNextOffset] = useState(0);
  const [playlistHasMore, setPlaylistHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [trackActionError, setTrackActionError] = useState('');
  const searchRequestIdRef = useRef(0);

  const selectedPlaylist = useMemo(() => (
    playlists.find(playlist => playlist.id === selectedPlaylistId) || null
  ), [playlists, selectedPlaylistId]);

  const pendingContextUri = playbackActions?.pendingContextUri || '';
  const pendingTrackId = playbackActions?.pendingTrackId || '';
  const canSearch = Boolean(provider?.searchTracks);
  const canLoadHome = Boolean(provider?.getTopTracks);
  const canPlayCharts = Boolean(playbackActions?.onPlayContext);

  const handleProviderError = useCallback((err, fallbackKey) => {
    onAuthExpired?.(err);
    return formatError?.(err) || t(fallbackKey);
  }, [formatError, onAuthExpired, t]);

  const isCancelledProviderError = useCallback((err) => (
    provider?.getErrorInfo?.(err)?.isCancelled
  ), [provider]);

  const playTrack = useCallback(async (track, options = {}) => {
    setTrackActionError('');
    try {
      await playbackActions?.onPlayTrack?.(track, options);
    } catch (err) {
      console.error('Failed to play selected track:', err);
      setTrackActionError(handleProviderError(err, 'libraryBrowse.playFailed'));
    }
  }, [handleProviderError, playbackActions]);

  const playChart = useCallback(async (chart) => {
    const contextUri = getChartPlaylistUri(chart);
    if (!playbackActions?.onPlayContext || pendingContextUri === contextUri) return;

    setTrackActionError('');
    try {
      await playbackActions.onPlayContext(contextUri);
    } catch (err) {
      console.error('Failed to play chart playlist:', err);
      const errorInfo = provider?.getErrorInfo?.(err);
      const message = handleProviderError(err, 'libraryBrowse.playFailed');
      setTrackActionError(errorInfo?.code === 'SPOTIFY_REQUEST_FAILED'
        ? t('libraryBrowse.playChartFailed')
        : message
      );
    }
  }, [handleProviderError, pendingContextUri, playbackActions, provider, t]);

  const playPlaylist = useCallback(async (playlist) => {
    if (!playlist?.uri || !playbackActions?.onPlayContext || pendingContextUri === playlist.uri) return;

    setTrackActionError('');
    try {
      await playbackActions.onPlayContext(playlist.uri);
    } catch (err) {
      console.error('Failed to play selected playlist:', err);
      setTrackActionError(handleProviderError(err, 'libraryBrowse.playFailed'));
    }
  }, [handleProviderError, pendingContextUri, playbackActions]);

  const loadHomeTracks = useCallback(async () => {
    if (!canLoadHome || isLoadingHome) return;

    setIsLoadingHome(true);
    setHomeError('');
    try {
      const response = await provider.getTopTracks({ limit: 12, timeRange: 'short_term' });
      setHomeTracks((response?.items || []).map(normalizePlayerItem));
      setHomeLoaded(true);
    } catch (err) {
      if (isCancelledProviderError(err)) return;
      console.error('Failed to load today tracks:', err);
      setHomeError(handleProviderError(err, 'libraryBrowse.loadFailed'));
    } finally {
      setIsLoadingHome(false);
    }
  }, [canLoadHome, handleProviderError, isCancelledProviderError, isLoadingHome, provider]);

  useEffect(() => {
    if (activeTab !== 'home' || homeLoaded || isLoadingHome) return undefined;
    const timeoutId = window.setTimeout(() => {
      loadHomeTracks();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, homeLoaded, isLoadingHome, loadHomeTracks]);

  const loadPlaylistTracks = useCallback(async (playlist, offset = 0, append = false) => {
    if (!playlist || !provider?.getPlaylistTracksPreview) return;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingPlaylist(true);
      setPlaylistTracks([]);
      setPlaylistNextOffset(0);
      setPlaylistHasMore(false);
    }
    setPlaylistError('');

    try {
      const response = await provider.getPlaylistTracksPreview(playlist, offset, PLAYLIST_PAGE_SIZE);
      setPlaylistTracks(current => append
        ? [...current, ...(response.tracks || [])]
        : response.tracks || []
      );
      setPlaylistNextOffset(response.nextOffset || offset);
      setPlaylistHasMore(Boolean(response.hasMore));
    } catch (err) {
      console.error('Failed to load playlist tracks:', err);
      setPlaylistError(handleProviderError(err, 'libraryBrowse.loadFailed'));
    } finally {
      setIsLoadingPlaylist(false);
      setIsLoadingMore(false);
    }
  }, [handleProviderError, provider]);

  const selectPlaylist = useCallback((playlist) => {
    setActiveTab('playlists');
    setSelectedPlaylistId(playlist.id);
    loadPlaylistTracks(playlist);
  }, [loadPlaylistTracks]);

  const loadMorePlaylistTracks = useCallback(() => {
    if (!selectedPlaylist || !playlistHasMore || isLoadingMore) return;
    loadPlaylistTracks(selectedPlaylist, playlistNextOffset, true);
  }, [isLoadingMore, loadPlaylistTracks, playlistHasMore, playlistNextOffset, selectedPlaylist]);

  const searchForTracks = useCallback(async (query, options = {}) => {
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (!canSearch || !query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const results = await provider.searchTracks(query, {
        limit: 25,
        signal: options.signal,
      });
      if (options.signal?.aborted || requestId !== searchRequestIdRef.current) return;
      setSearchResults(results.map(normalizeSearchTrack).filter(track => track.id));
    } catch (err) {
      if (isCancelledProviderError(err)) return;
      if (requestId !== searchRequestIdRef.current) return;
      console.error('Failed to search Spotify tracks:', err);
      setSearchError(handleProviderError(err, 'libraryBrowse.loadFailed'));
    } finally {
      if (!options.signal?.aborted && requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [canSearch, handleProviderError, isCancelledProviderError, provider]);

  useEffect(() => {
    if (activeTab !== 'search') return undefined;

    const query = searchQuery.trim();
    if (!query) return undefined;

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      searchForTracks(query, { signal: abortController.signal });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [activeTab, searchForTracks, searchQuery]);

  const runSearch = useCallback((event) => {
    event?.preventDefault();
    searchForTracks(searchQuery.trim());
  }, [searchForTracks, searchQuery]);

  const handleSearchQueryChange = useCallback((event) => {
    const nextQuery = event.target.value;
    const hasQuery = Boolean(nextQuery.trim());

    setSearchQuery(nextQuery);
    searchRequestIdRef.current += 1;
    setSearchResults([]);
    setSearchError('');
    setIsSearching(hasQuery && canSearch);
  }, [canSearch]);

  useEffect(() => {
    if (activeTab === 'search') return;
    searchRequestIdRef.current += 1;
    const resetId = window.setTimeout(() => {
      setIsSearching(false);
      setSearchError('');
    }, 0);
    return () => window.clearTimeout(resetId);
  }, [activeTab]);

  const renderHome = () => (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {t('libraryBrowse.todayTitle')}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[#86868b]">
            {t('libraryBrowse.todaySubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={loadHomeTracks}
          disabled={isLoadingHome}
          aria-label={t('libraryBrowse.refresh')}
          title={t('libraryBrowse.refresh')}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#e5e5e7] bg-white px-3 text-xs font-bold text-[#6e6e73] transition-colors hover:border-[#0071e3]/30 hover:bg-[#eef5ff] hover:text-[#005bb5] disabled:cursor-wait disabled:opacity-60 dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:border-[#0a84ff]/35 dark:hover:bg-[#10243a] dark:hover:text-[#8ec8ff] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
        >
          {isLoadingHome ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={13} aria-hidden="true" />
          )}
          <span>{t('libraryBrowse.refresh')}</span>
        </button>
      </div>

      <TrackList
        emptyText={t('libraryBrowse.todayEmpty')}
        error={homeError}
        isLoading={isLoadingHome}
        loadingText={t('libraryBrowse.loading')}
        onPlayTrack={playTrack}
        pendingTrackId={pendingTrackId}
        t={t}
        tracks={homeTracks}
      />

      <div className="grid gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {t('libraryBrowse.chartTitle')}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[#86868b]">
            {t('libraryBrowse.chartSubtitle')}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {chartPlaylists.map(chart => {
            const contextUri = getChartPlaylistUri(chart);
            const isPending = pendingContextUri === contextUri;
            const label = t(chart.labelKey);

            return (
              <div
                key={chart.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e5e5e7] bg-white px-3 py-2.5 dark:border-[#333336]/60 dark:bg-[#1d1d1f]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#86868b]">
                    {t('libraryBrowse.chartPlaylistLabel')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => playChart(chart)}
                    disabled={!canPlayCharts || isPending}
                    aria-label={t('libraryBrowse.playChart', label)}
                    title={t('libraryBrowse.playChart', label)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3] text-white transition-colors hover:bg-[#0077ed] disabled:cursor-wait disabled:bg-[#c7c7cc] dark:disabled:bg-[#545458] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
                  >
                    {isPending ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Play size={14} className="translate-x-px" aria-hidden="true" />
                    )}
                  </button>
                  <a
                    href={getChartExternalUrl(chart)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('libraryBrowse.openChart', label)}
                    title={t('libraryBrowse.openChart', label)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e5e7] text-[#6e6e73] transition-colors hover:border-[#0071e3]/30 hover:bg-[#eef5ff] hover:text-[#005bb5] dark:border-[#333336]/60 dark:text-[#a1a1a6] dark:hover:border-[#0a84ff]/35 dark:hover:bg-[#10243a] dark:hover:text-[#8ec8ff] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderPlaylists = () => (
    <div className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(196px,248px)_minmax(0,1fr)]">
      <div className="rounded-lg border border-[#e5e5e7] bg-white p-2 dark:border-[#333336]/60 dark:bg-[#1d1d1f]">
        <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
          {t('libraryBrowse.playlistsTitle')}
        </p>
        {playlists.length === 0 ? (
          <p className="px-2 py-6 text-sm font-semibold text-[#86868b]">
            {t('libraryBrowse.noPlaylists')}
          </p>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            {playlists.map(playlist => {
              const isActive = selectedPlaylistId === playlist.id;
              return (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => selectPlaylist(playlist)}
                  aria-pressed={isActive}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                    isActive
                      ? 'bg-[#0071e3] text-white'
                      : 'text-[#1d1d1f] hover:bg-black/[0.03] dark:text-[#f5f5f7] dark:hover:bg-white/[0.04]'
                  } outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ${
                    isActive ? 'bg-white/15' : 'bg-[#f0f0f2] dark:bg-[#161617]'
                  }`}>
                    {getPlaylistCover(playlist) ? (
                      <img src={getPlaylistCover(playlist)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ListMusic size={15} className={isActive ? 'text-white' : 'text-[#86868b]'} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{playlist.name}</p>
                    <p className={`mt-0.5 text-[11px] font-semibold ${isActive ? 'text-white/75' : 'text-[#86868b]'}`}>
                      {playlist.tracks?.total || 0} {t('playlists.tracks')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {selectedPlaylist?.name || t('libraryBrowse.selectPlaylist')}
            </h3>
            {selectedPlaylist && (
              <p className="mt-0.5 text-xs font-semibold text-[#86868b]">
                {selectedPlaylist.tracks?.total || 0} {t('playlists.tracks')}
              </p>
            )}
          </div>
          {selectedPlaylist?.uri && (
            <button
              type="button"
              onClick={() => playPlaylist(selectedPlaylist)}
              disabled={!playbackActions?.onPlayContext || pendingContextUri === selectedPlaylist.uri}
              aria-label={t('libraryBrowse.playPlaylist', selectedPlaylist.name)}
              title={t('libraryBrowse.playPlaylist', selectedPlaylist.name)}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#0071e3] px-3 text-xs font-bold text-white transition-colors hover:bg-[#0077ed] disabled:cursor-wait disabled:bg-[#c7c7cc] dark:disabled:bg-[#545458] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
            >
              {pendingContextUri === selectedPlaylist.uri ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={13} className="translate-x-px" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{t('libraryBrowse.playSelectedPlaylist')}</span>
            </button>
          )}
        </div>

        <TrackList
          contextUri={selectedPlaylist?.uri || ''}
          emptyText={selectedPlaylist ? t('libraryBrowse.playlistEmpty') : t('libraryBrowse.selectPlaylist')}
          error={playlistError}
          isLoading={isLoadingPlaylist}
          loadingText={t('libraryBrowse.loading')}
          onPlayTrack={playTrack}
          pendingTrackId={pendingTrackId}
          t={t}
          tracks={playlistTracks}
        />

        {playlistHasMore && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={loadMorePlaylistTracks}
              disabled={isLoadingMore}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#e8e8ed] px-4 text-xs font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white disabled:cursor-wait disabled:text-[#86868b] dark:bg-[#2d2d30] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
            >
              {isLoadingMore && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>{t('libraryBrowse.loadMore')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderSearch = () => (
    <div className="grid gap-4">
      <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="spotify-track-search">
          {t('libraryBrowse.search')}
        </label>
        <input
          id="spotify-track-search"
          type="search"
          value={searchQuery}
          onChange={handleSearchQueryChange}
          placeholder={t('libraryBrowse.searchPlaceholder')}
          className="min-h-10 flex-1 rounded-lg border border-[#e5e5e7] bg-white px-3 text-sm font-semibold text-[#1d1d1f] outline-none transition-colors placeholder:text-[#86868b] focus:border-[#0071e3] focus-visible:ring-2 focus-visible:ring-[#0071e3]/20 dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:text-[#f5f5f7]"
        />
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0071e3] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-[#c7c7cc] dark:disabled:bg-[#545458] outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40"
        >
          {isSearching ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={14} aria-hidden="true" />
          )}
          <span>{t('libraryBrowse.searchSubmit')}</span>
        </button>
      </form>

      <TrackList
        emptyText={searchQuery.trim() ? t('libraryBrowse.noResults') : t('libraryBrowse.searchEmpty')}
        error={searchError}
        isLoading={isSearching}
        loadingText={t('libraryBrowse.loading')}
        onPlayTrack={playTrack}
        pendingTrackId={pendingTrackId}
        t={t}
        tracks={searchResults}
      />
    </div>
  );

  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <BrowseTabs activeTab={activeTab} onChange={setActiveTab} t={t} />

      {(trackActionError || playbackActions?.error) && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
          {trackActionError || playbackActions.error}
        </p>
      )}

      <div className="min-h-[620px] min-w-0">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'playlists' && renderPlaylists()}
        {activeTab === 'search' && renderSearch()}
      </div>
    </div>
  );
};
