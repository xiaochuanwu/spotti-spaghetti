import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { exporter } from './services/exporter';
import { Header } from './components/Header';
import { SearchFilter } from './components/SearchFilter';
import { PlaylistsContainer } from './components/PlaylistsContainer';
import { ProgressBar } from './components/ProgressBar';
import { Footer } from './components/Footer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { WorkspacePanel } from './components/workspace/WorkspacePanel';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from './i18n';
import { PlaylistPreviewModal } from './components/PlaylistPreviewModal';
import { useThemePreference } from './hooks/useThemePreference.js';
import { batchSession } from './services/batchSession.js';
import { exportHistory, getTrackUrisFromSnapshot } from './services/exportHistory.js';
import { getMusicProvider } from './services/providers/providerRegistry.js';

const musicProvider = getMusicProvider();

const SPOTIFY_ERROR_KEYS = {
  SPOTIFY_RATE_LIMIT_EXCEEDED: 'error.spotifyRateLimit',
  SPOTIFY_REQUEST_FAILED: 'error.spotifyRequestFailed',
  SPOTIFY_AUTH_DENIED: 'error.authFailed',
  SPOTIFY_AUTH_EXCHANGE_FAILED: 'error.authFailed',
  SPOTIFY_AUTH_EXPIRED: 'error.spotifyAuthExpired',
  SPOTIFY_AUTH_STATE_MISMATCH: 'error.spotifyAuthStateMismatch',
  SPOTIFY_PERMISSION_DENIED: 'error.spotifyPermissionDenied',
  SPOTIFY_REQUEST_CANCELLED: 'error.spotifyRequestCancelled',
  SPOTIFY_USER_PROFILE_UNAVAILABLE: 'error.spotifyUserUnavailable',
  SPOTIFY_PLAYLISTS_UNAVAILABLE: 'error.spotifyPlaylistsUnavailable',
};

const isAuthExpiredError = (err) => err?.code === 'SPOTIFY_AUTH_EXPIRED';
const isCancelledError = (err) => err?.code === 'SPOTIFY_REQUEST_CANCELLED';

export default function App() {
  const { t } = useI18n();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [previewPlaylist, setPreviewPlaylist] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [historySnapshots, setHistorySnapshots] = useState([]);
  const [latestDiff, setLatestDiff] = useState(null);
  const [batchSessionState, setBatchSessionState] = useState(() => batchSession.read());
  const [confirmation, setConfirmation] = useState(null);
  const activeExportAbortRef = useRef(null);
  const { setTheme, themePreference } = useThemePreference();

  // Single and batch export progress tracking
  const [exportingState, setExportingState] = useState({
    isExporting: false,
    activePlaylistId: null,
    progress: 0,
    taskName: '',
    currentItem: '',
    canCancel: false,
  });

  useEffect(() => {
    let isCurrent = true;

    exportHistory.all()
      .then(history => {
        if (isCurrent) setHistorySnapshots(history);
      })
      .catch(error => {
        console.error('Failed to load export history:', error);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const localizePlaylist = useCallback((playlist) => (
    playlist.id === 'liked_songs'
      ? { ...playlist, name: t('playlists.likedSongs') }
      : playlist
  ), [t]);

  const getErrorText = useCallback((err) => {
    const key = SPOTIFY_ERROR_KEYS[err?.code || err?.message] || 'error.genericDetail';
    return t(key);
  }, [t]);

  const loadPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const list = await musicProvider.getPlaylists();
      setPlaylists(list);
    } catch (err) {
      console.error(err);
      if (isAuthExpiredError(err)) setIsLoggedIn(false);
      setErrorMessage(isAuthExpiredError(err) ? getErrorText(err) : t('error.loadFailed'));
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, [getErrorText, t]);

  useEffect(() => {
    const initAuth = async () => {
      const hasCode = new URLSearchParams(window.location.search).has('code');
      if (hasCode) {
        setIsLoadingPlaylists(true);
        try {
          const success = await musicProvider.handleCallback();
          if (success) {
            setIsLoggedIn(true);
          } else {
            setErrorMessage(t('error.authFailed'));
          }
        } catch (err) {
          console.error(err);
          setErrorMessage(getErrorText(err));
        } finally {
          setIsLoadingPlaylists(false);
        }
      } else {
        const loggedIn = musicProvider.isLoggedIn();
        setIsLoggedIn(loggedIn);
      }
    };
    initAuth();
  }, [getErrorText, t]);

  useEffect(() => {
    if (isLoggedIn) {
      Promise.resolve().then(() => { loadPlaylists(); });
    }
  }, [isLoggedIn, loadPlaylists]);

  const handleLogin = async () => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      await musicProvider.authorize();
    } catch (err) {
      console.error(err);
      setErrorMessage(t('error.missingClientId'));
    }
  };

  const handleLogout = () => {
    musicProvider.logout();
    setIsLoggedIn(false);
    setPlaylists([]);
    setErrorMessage('');
    setStatusMessage('');
  };

  const formatProviderTask = useCallback((taskInfo, fallbackKey = 'task.downloading') => {
    if (!taskInfo) return t(fallbackKey);
    if (typeof taskInfo === 'string') return t(fallbackKey);
    if (taskInfo.step === 'downloadTracks') {
      return t('task.downloadTracks', taskInfo.offset, taskInfo.total);
    }
    return t(`task.${taskInfo.step}`);
  }, [t]);

  const recordSnapshot = async (playlist, tracks) => {
    const previousSnapshot = await exportHistory.latestForPlaylist(playlist);
    const snapshot = await exportHistory.addSnapshot(playlist, tracks);
    const diff = exportHistory.compare(snapshot, previousSnapshot);
    setHistorySnapshots(await exportHistory.all());
    setLatestDiff({
      playlistName: snapshot.playlistName,
      added: diff.added,
      removed: diff.removed,
      hasPrevious: Boolean(previousSnapshot),
    });
  };

  const closeConfirmation = useCallback(() => {
    setConfirmation(null);
  }, []);

  const clearHistory = async () => {
    setConfirmation({
      title: t('history.clearTitle'),
      message: t('history.clearConfirm'),
      confirmLabel: t('history.clear'),
      destructive: true,
      onConfirm: async () => {
        await exportHistory.clear();
        setHistorySnapshots([]);
        setLatestDiff(null);
        setErrorMessage('');
        setStatusMessage(t('status.historyCleared'));
      },
    });
  };

  const deleteHistorySnapshot = async (id) => {
    const target = historySnapshots.find(item => item.id === id);
    setConfirmation({
      title: t('history.deleteTitle'),
      message: t('history.deleteConfirm', target?.playlistName || t('history.title')),
      confirmLabel: t('history.delete'),
      destructive: true,
      onConfirm: async () => {
        await exportHistory.deleteSnapshot(id);
        setHistorySnapshots(await exportHistory.all());
        setLatestDiff(null);
        setErrorMessage('');
        setStatusMessage(t('status.historyDeleted'));
      },
    });
  };

  const exportLocalHistory = async () => {
    const history = await exportHistory.all();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spotti-spaghetti-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setErrorMessage('');
    setStatusMessage(t('status.historyExported', history.length));
  };

  const importLocalHistory = async (file) => {
    try {
      const content = JSON.parse(await file.text());
      const importedCount = await exportHistory.importSnapshots(content);
      setHistorySnapshots(await exportHistory.all());
      setLatestDiff(null);
      setErrorMessage('');
      setStatusMessage(t('status.historyImported', importedCount));
    } catch (err) {
      console.error(err);
      setStatusMessage('');
      setErrorMessage(t('error.historyImportFailed'));
    }
  };

  const handleExportSingle = async (playlist) => {
    const abortController = new AbortController();
    activeExportAbortRef.current = abortController;
    setExportingState({
      isExporting: true,
      activePlaylistId: playlist.id,
      progress: 0,
      taskName: t('task.connecting'),
      currentItem: playlist.name,
      canCancel: true,
    });
    setErrorMessage('');
    setStatusMessage('');

    try {
      const tracks = await musicProvider.getPlaylistTracks(
        playlist,
        (progress, taskInfo) => {
          setExportingState(prev => ({
            ...prev,
            progress,
            taskName: formatProviderTask(taskInfo)
          }));
        },
        (retrySeconds) => {
          setExportingState(prev => ({
            ...prev,
            taskName: t('task.rateLimit', retrySeconds)
          }));
        },
        { signal: abortController.signal }
      );
      
      if (tracks.length > 0) {
        await recordSnapshot(playlist, tracks);
        exporter.exportCSV(playlist.name, tracks);
      } else {
        setErrorMessage(t('error.noTracks', playlist.name));
      }
    } catch (err) {
      console.error(err);
      if (isCancelledError(err)) {
        setStatusMessage(t('status.exportCancelled'));
      } else {
        if (isAuthExpiredError(err)) setIsLoggedIn(false);
        setErrorMessage(t('error.exportFailed', playlist.name, getErrorText(err)));
      }
    } finally {
      if (activeExportAbortRef.current === abortController) {
        activeExportAbortRef.current = null;
      }
      setExportingState({
        isExporting: false, activePlaylistId: null,
        progress: 0, taskName: '', currentItem: '', canCancel: false
      });
    }
  };

  const handleExportAll = async (targetPlaylists = playlists) => {
    const abortController = new AbortController();
    activeExportAbortRef.current = abortController;
    const sourceTargets = Array.isArray(targetPlaylists) ? targetPlaylists : playlists;
    const exportTargets = sourceTargets.map(localizePlaylist);

    setExportingState({
      isExporting: true,
      activePlaylistId: 'all',
      progress: 0,
      taskName: t('task.preparing'),
      currentItem: t('task.batchItem'),
      canCancel: true,
    });
    setErrorMessage('');
    setStatusMessage('');

    const playlistsWithTracks = [];
    const failed = [];
    const totalPlaylists = exportTargets.length;

    try {
      if (totalPlaylists === 0) {
        setErrorMessage(t('error.batchEmptySelection'));
        return;
      }

      for (let i = 0; i < totalPlaylists; i++) {
        if (abortController.signal.aborted) {
          throw Object.assign(new Error('SPOTIFY_REQUEST_CANCELLED'), { code: 'SPOTIFY_REQUEST_CANCELLED' });
        }

        const playlist = exportTargets[i];
        
        setExportingState(prev => ({
          ...prev,
          currentItem: t('task.batchProgress', playlist.name, i + 1, totalPlaylists),
          taskName: t('task.downloading'),
          progress: Math.round((i / totalPlaylists) * 100)
        }));

        try {
          const tracks = await musicProvider.getPlaylistTracks(
            playlist,
            (playlistProgress, taskInfo) => {
              const overallStart = (i / totalPlaylists) * 100;
              const overallEnd = ((i + 1) / totalPlaylists) * 100;
              const currentOverallProgress = overallStart + (playlistProgress / 100) * (overallEnd - overallStart);
              setExportingState(prev => ({
                ...prev,
                progress: Math.round(currentOverallProgress),
                taskName: formatProviderTask(taskInfo)
              }));
            },
            (retrySeconds) => {
              setExportingState(prev => ({
                ...prev, taskName: t('task.rateLimitBatch', retrySeconds)
              }));
            },
            { signal: abortController.signal }
          );

          if (tracks.length > 0) {
            await recordSnapshot(playlist, tracks);
            playlistsWithTracks.push({ playlistName: playlist.name, tracks });
          }
        } catch (err) {
          console.error(err);
          if (isCancelledError(err) || isAuthExpiredError(err)) {
            throw err;
          }
          failed.push({ id: playlist.id, name: playlist.name, code: err.code || err.message });
        }
      }

      setExportingState(prev => ({
        ...prev, progress: 98,
        taskName: t('task.packing'),
        currentItem: t('task.batchItem')
      }));

      if (playlistsWithTracks.length > 0) {
        await exporter.exportZIP(playlistsWithTracks);
      }

      if (failed.length > 0) {
        const session = { failed };
        batchSession.save(session);
        setBatchSessionState(batchSession.read());
        if (playlistsWithTracks.length > 0) {
          setStatusMessage(t('status.batchExportedWithFailures', playlistsWithTracks.length, failed.length));
        } else {
          setErrorMessage(t('error.batchAllFailed', failed.length));
        }
      } else {
        batchSession.clear();
        setBatchSessionState(null);
        if (playlistsWithTracks.length > 0) {
          setStatusMessage(t('status.batchExported', playlistsWithTracks.length));
        } else {
          setErrorMessage(t('error.allEmpty'));
        }
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('');
      if (isCancelledError(err)) {
        setErrorMessage('');
        setStatusMessage(t('status.exportCancelled'));
      } else {
        if (isAuthExpiredError(err)) setIsLoggedIn(false);
        setErrorMessage(t('error.batchFailed', getErrorText(err)));
      }
    } finally {
      if (activeExportAbortRef.current === abortController) {
        activeExportAbortRef.current = null;
      }
      setExportingState({
        isExporting: false, activePlaylistId: null,
        progress: 0, taskName: '', currentItem: '', canCancel: false
      });
    }
  };

  const handleCancelExport = () => {
    activeExportAbortRef.current?.abort();
    setExportingState(prev => ({
      ...prev,
      taskName: t('task.cancelling'),
      canCancel: false,
    }));
  };

  const handleRetryFailedBatch = () => {
    setStatusMessage('');
    const failedIds = new Set(batchSessionState?.failed?.map(item => item.id) || []);
    const retryPlaylists = playlists.filter(playlist => failedIds.has(playlist.id));
    if (retryPlaylists.length === 0) {
      setErrorMessage(t('error.retryUnavailable'));
      return;
    }
    handleExportAll(retryPlaylists);
  };

  const handleRestorePlaylist = async (name, trackUris) => {
    setExportingState({
      isExporting: true,
      activePlaylistId: 'restore',
      progress: 0,
      taskName: t('task.restoring'),
      currentItem: name,
      canCancel: false,
    });
    setErrorMessage('');
    setStatusMessage('');

    try {
      const playlist = await musicProvider.restorePlaylist(name, trackUris, (progress) => {
        setExportingState(prev => ({ ...prev, progress }));
      }, t('restore.description'));
      await loadPlaylists();
      return playlist;
    } catch (err) {
      console.error(err);
      if (isAuthExpiredError(err)) setIsLoggedIn(false);
      setErrorMessage(t('error.restoreFailed', getErrorText(err)));
      throw err;
    } finally {
      setExportingState({
        isExporting: false, activePlaylistId: null,
        progress: 0, taskName: '', currentItem: '', canCancel: false
      });
    }
  };

  const handleRestoreSnapshot = async (snapshot) => {
    const trackUris = getTrackUrisFromSnapshot(snapshot);
    if (trackUris.length === 0) {
      setStatusMessage('');
      setErrorMessage(t('error.historyRestoreEmpty'));
      return;
    }

    await handleRestorePlaylist(t('history.restoreName', snapshot.playlistName), trackUris);
  };

  const localizedPlaylists = useMemo(
    () => playlists.map(localizePlaylist),
    [localizePlaylist, playlists]
  );

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return localizedPlaylists;
    const query = searchQuery.toLowerCase().trim();
    return localizedPlaylists.filter(p => p.name?.toLowerCase().includes(query));
  }, [localizedPlaylists, searchQuery]);

  return (
    <div className="relative flex-1 w-full max-w-6xl mx-auto flex flex-col px-4 pb-4 md:px-6 md:pb-6 min-h-screen">
      {/* Ambient dark-mode page glow */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 hidden dark:block"
        aria-hidden="true"
      >
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px] will-change-transform"
          style={{
            background: 'conic-gradient(from 180deg, #0071e3, #5e5ce6, #bf5af2, #0071e3)',
            animation: 'rotate-glow 20s linear infinite',
          }}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <Header 
          isLoggedIn={isLoggedIn} 
          onLogout={handleLogout}
          themePreference={themePreference}
          onSetTheme={setTheme}
        />

        <main className="flex-1 flex flex-col pb-10 md:pb-14">
          {errorMessage && (
            <div 
              id="error" 
              className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 text-red-900 dark:text-red-200 px-5 py-4 rounded-2xl shadow-md dark:shadow-none mb-6 animate-fade-in"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-700 dark:text-red-400" />
              <div className="text-sm font-semibold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {statusMessage && (
            <div
              className="flex items-start gap-3 bg-[#f0f5ff] dark:bg-[#071426] border border-[#0071e3]/20 text-[#0057b8] dark:text-[#8ec8ff] px-5 py-4 rounded-2xl shadow-md dark:shadow-none mb-6 animate-fade-in"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#0071e3]" />
              <div className="text-sm font-semibold leading-relaxed">{statusMessage}</div>
            </div>
          )}

          <ProgressBar exportingState={exportingState} onCancel={handleCancelExport} />

          {isLoggedIn ? (
            isLoadingPlaylists ? (
              <div className="flex-1 flex flex-col justify-center items-center py-20 min-h-[300px] select-none text-center">
                <Loader2 className="w-16 h-16 text-[#0071e3] animate-spin mb-4" />
                <p className="text-xs font-semibold text-[#86868b] animate-pulse">{t('loading.playlists')}</p>
              </div>
            ) : (
              <>
                <SearchFilter 
                  value={searchQuery} 
                  onChange={setSearchQuery} 
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
                
                <div id="subtitle" className="text-center font-bold text-[#86868b] text-[11px] tracking-wider uppercase mb-6 select-none animate-fade-in">
                  {t('playlists.count', filteredPlaylists.length)}
                </div>

                <WorkspacePanel
                  batchSessionState={batchSessionState}
                  history={historySnapshots}
                  isBusy={exportingState.isExporting}
                  latestDiff={latestDiff}
                  onClearHistory={clearHistory}
                  onDeleteHistory={deleteHistorySnapshot}
                  onExportHistory={exportLocalHistory}
                  onImportHistory={importLocalHistory}
                  formatError={getErrorText}
                  onRestorePlaylist={handleRestorePlaylist}
                  onRestoreSnapshot={handleRestoreSnapshot}
                  onRetryBatch={handleRetryFailedBatch}
                />

                <PlaylistsContainer 
                  playlists={filteredPlaylists}
                  onExportSingle={handleExportSingle}
                  onExportAll={handleExportAll}
                  exportingState={exportingState}
                  viewMode={viewMode}
                  onPreview={(playlist) => {
                    setPreviewPlaylist(playlist);
                    setIsPreviewOpen(true);
                  }}
                />
              </>
            )
          ) : (
            !isLoadingPlaylists && (
              <div className="flex-grow flex flex-col justify-center items-center py-20 select-none text-center animate-fade-in">

                {/* Halo Glow Container */}
                <div className="relative flex items-center justify-center w-full max-w-4xl mx-auto py-24">
                  {/* Layer 1: Extreme elongated horizontal line glow (bright event horizon streak with neon cyan/indigo) */}
                  <div 
                    className="absolute w-[100vw] max-w-[1280px] h-[10px] md:h-[18px] rounded-full bg-gradient-to-r from-transparent via-cyan-400/80 via-blue-500/90 via-purple-500/80 to-transparent opacity-80 dark:opacity-95 blur-[15px] md:blur-[22px] will-change-transform pointer-events-none"
                    aria-hidden="true"
                  />
                  
                  {/* Layer 2: Accretion disk (very flat, horizontally stretched ellipse with rich multi-colored gradient) */}
                  <div 
                    className="absolute w-[90vw] max-w-[1080px] h-[60px] md:h-[110px] rounded-[50%] bg-gradient-to-r from-blue-600/0 via-indigo-500/40 via-purple-500/55 via-pink-500/60 via-teal-400/40 to-blue-600/0 dark:via-indigo-500/60 dark:via-purple-500/70 dark:via-pink-500/75 dark:via-teal-400/50 blur-[45px] md:blur-[60px] will-change-transform pointer-events-none"
                    aria-hidden="true"
                  />

                  {/* Layer 3: Central atmospheric hotspot (massive deep magenta/blue glow) */}
                  <div 
                    className="absolute w-[450px] h-[200px] md:w-[650px] md:h-[300px] rounded-[50%] bg-gradient-to-r from-indigo-500/10 via-purple-500/25 to-blue-500/10 dark:from-indigo-500/15 dark:via-purple-500/35 dark:to-blue-500/15 blur-[80px] md:blur-[110px] pointer-events-none"
                    aria-hidden="true"
                  />

                  {/* Login Button */}
                  <button 
                    onClick={handleLogin}
                    aria-label={t('login.aria')}
                    className="relative z-10 inline-flex items-center gap-2.5 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold px-8 py-3.5 rounded-full text-sm md:text-base tracking-tight cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,113,227,0.45)] active:scale-95 select-none"
                  >
                    <svg 
                      className="w-5 h-5 fill-current" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 0C5.373 0 0 5.372 0 12c0 6.627 5.373 12 12 12 6.628 0 12-5.373 12-12 0-6.628-5.372-12-12-12zm5.49 17.31c-.22.36-.684.473-1.045.252-2.9-1.77-6.55-2.17-10.852-1.184-.41.093-.822-.162-.916-.572-.093-.41.163-.823.573-.917 4.71-1.077 8.73-.622 11.99 1.373.36.22.473.684.252 1.046zm1.465-3.264c-.276.45-.86.593-1.31.318-3.32-2.04-8.384-2.63-12.305-1.44-.506.155-1.04-.135-1.196-.64-.155-.508.136-1.043.64-1.198 4.482-1.36 10.05-.705 13.854 1.636.45.277.59.86.317 1.312zm.126-3.41c-3.98-2.363-10.55-2.58-14.352-1.424-.61.185-1.25-.157-1.436-.77-.186-.61.157-1.25.77-1.437 4.385-1.33 11.62-1.078 16.208 1.644.55.326.73 1.037.4 1.587-.327.55-1.037.73-1.587.4z"/>
                    </svg>
                    <span>{t('login.button')}</span>
                  </button>
                </div>

              </div>
            )
          )}
        </main>

        <Footer />
      </div>

      <PlaylistPreviewModal 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        playlist={previewPlaylist} 
        provider={musicProvider}
      />
      <ConfirmDialog
        isOpen={Boolean(confirmation)}
        title={confirmation?.title}
        message={confirmation?.message}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        onCancel={closeConfirmation}
        onConfirm={async () => {
          const action = confirmation?.onConfirm;
          closeConfirmation();
          await action?.();
        }}
      />
    </div>
  );
}
