import { useState } from 'react';
import { BarChart3, Clock3, Compass, FolderCog, LibraryBig, ScrollText, Upload } from 'lucide-react';
import { useI18n } from '../../i18n';
import { PlaylistLibrary } from './PlaylistLibrary.jsx';
import { HistoryPanel } from '../workspace/HistoryPanel.jsx';
import { InsightsPanel } from '../workspace/InsightsPanel.jsx';
import { LyricsPanel } from '../workspace/LyricsPanel.jsx';
import { PlaybackBrowserPanel } from '../workspace/PlaybackBrowserPanel.jsx';
import { RestorePanel } from '../workspace/RestorePanel.jsx';

const pageMeta = {
  browse: { icon: Compass, titleKey: 'workspace.browse', eyebrowKey: 'workspace.browseEyebrow' },
  library: { icon: FolderCog, titleKey: 'workspace.playlistTools', eyebrowKey: 'workspace.library' },
  lyrics: { icon: ScrollText, titleKey: 'workspace.lyrics', eyebrowKey: 'workspace.lyricsEyebrow' },
};

const libraryToolItems = [
  { id: 'playlists', icon: LibraryBig, labelKey: 'libraryTools.backup' },
  { id: 'restore', icon: Upload, labelKey: 'libraryTools.restore' },
  { id: 'history', icon: Clock3, labelKey: 'libraryTools.history' },
  { id: 'insights', icon: BarChart3, labelKey: 'libraryTools.insights' },
];

const PageHeader = ({ activeTool }) => {
  const { t } = useI18n();
  const meta = pageMeta[activeTool] || pageMeta.library;
  const Icon = meta.icon;

  return (
    <div className="mb-5 flex items-start gap-3 border-b border-[#e5e5e7] pb-4 dark:border-[#333336]/70">
      <div className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8e8ed] text-[#0071e3] dark:bg-[#2d2d30]">
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
          {t(meta.eyebrowKey)}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          {t(meta.titleKey)}
        </h2>
      </div>
    </div>
  );
};

const LibraryToolTabs = ({ active, onChange }) => {
  const { t } = useI18n();

  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {libraryToolItems.map(({ id, icon: Icon, labelKey }) => {
        const isActive = active === id;
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
};

export const WorkspaceView = ({
  activeTool,
  exportingState,
  formatError,
  history,
  latestDiff,
  onClearHistory,
  onDeleteHistory,
  onExportAll,
  onExportHistory,
  onExportSingle,
  onImportHistory,
  onProviderAuthExpired,
  onPreview,
  onRestorePlaylist,
  onRestoreSnapshot,
  onSearchChange,
  onSelectedPlaylistIdsChange,
  onToolChange,
  onViewModeChange,
  playback,
  playbackActions,
  playlistCount,
  playlists,
  provider,
  searchQuery,
  selectedPlaylistIds,
  viewMode,
}) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [libraryTool, setLibraryTool] = useState('playlists');
  const currentTool = activeTool === 'browse' || activeTool === 'lyrics' ? activeTool : 'library';

  const handleAnalyze = (id) => {
    setSelectedHistoryId(id);
    setLibraryTool('insights');
    onToolChange('library');
  };

  if (currentTool === 'library') {
    return (
      <section className="w-full min-w-0 max-w-full overflow-hidden lg:min-h-[720px]">
        <PageHeader activeTool="library" />
        <LibraryToolTabs active={libraryTool} onChange={setLibraryTool} />

        {libraryTool === 'playlists' && (
          <PlaylistLibrary
            playlists={playlists}
            playlistCount={playlistCount}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            onExportSingle={onExportSingle}
            onExportAll={onExportAll}
            exportingState={exportingState}
            selectedPlaylistIds={selectedPlaylistIds}
            onSelectedPlaylistIdsChange={onSelectedPlaylistIdsChange}
            onPreview={onPreview}
            showHeader={false}
          />
        )}

        {libraryTool === 'restore' && (
          <RestorePanel formatError={formatError} isBusy={exportingState.isExporting} onRestorePlaylist={onRestorePlaylist} />
        )}

        {libraryTool === 'history' && (
          <HistoryPanel
            history={history}
            latestDiff={latestDiff}
            onAnalyze={handleAnalyze}
            onClearHistory={onClearHistory}
            onDeleteHistory={onDeleteHistory}
            onExportHistory={onExportHistory}
            onImportHistory={onImportHistory}
            onRestoreSnapshot={onRestoreSnapshot}
          />
        )}

        {libraryTool === 'insights' && (
          <InsightsPanel
            history={history}
            selectedHistoryId={selectedHistoryId}
            onSelectHistory={setSelectedHistoryId}
          />
        )}
      </section>
    );
  }

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden lg:min-h-[720px]">
      <PageHeader activeTool={currentTool} />

      {currentTool === 'browse' && (
        <PlaybackBrowserPanel
          formatError={formatError}
          onAuthExpired={onProviderAuthExpired}
          playbackActions={playbackActions}
          playlists={playlists}
          provider={provider}
        />
      )}

      {currentTool === 'lyrics' && (
        <LyricsPanel
          playback={playback}
        />
      )}
    </section>
  );
};
