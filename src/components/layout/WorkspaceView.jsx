import { useState } from 'react';
import { BarChart3, Clock3, Library, ListMusic, Upload } from 'lucide-react';
import { useI18n } from '../../i18n';
import { PlaylistLibrary } from './PlaylistLibrary.jsx';
import { HistoryPanel } from '../workspace/HistoryPanel.jsx';
import { InsightsPanel } from '../workspace/InsightsPanel.jsx';
import { LyricsPanel } from '../workspace/LyricsPanel.jsx';
import { RestorePanel } from '../workspace/RestorePanel.jsx';

const pageMeta = {
  library: { icon: Library, titleKey: 'workspace.playlists', eyebrowKey: 'workspace.library' },
  restore: { icon: Upload, titleKey: 'workspace.restore', eyebrowKey: 'workspace.restoreEyebrow' },
  history: { icon: Clock3, titleKey: 'workspace.history', eyebrowKey: 'workspace.historyEyebrow' },
  insights: { icon: BarChart3, titleKey: 'workspace.insights', eyebrowKey: 'workspace.insightsEyebrow' },
  lyrics: { icon: ListMusic, titleKey: 'workspace.lyrics', eyebrowKey: 'workspace.lyricsEyebrow' },
};

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

export const WorkspaceView = ({
  activeTool,
  exportingState,
  formatError,
  history,
  latestDiff,
  onAuthExpired,
  onClearHistory,
  onDeleteHistory,
  onExportAll,
  onExportHistory,
  onExportSingle,
  onImportHistory,
  onPreview,
  onRestorePlaylist,
  onRestoreSnapshot,
  onSearchChange,
  onSelectedPlaylistIdsChange,
  onToolChange,
  onViewModeChange,
  playlistCount,
  playlists,
  provider,
  searchQuery,
  selectedPlaylistIds,
  viewMode,
}) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const currentTool = activeTool || 'library';

  const handleAnalyze = (id) => {
    setSelectedHistoryId(id);
    onToolChange('insights');
  };

  if (currentTool === 'library') {
    return (
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
      />
    );
  }

  return (
    <section className="min-w-0">
      <PageHeader activeTool={currentTool} />

      {currentTool === 'restore' && (
        <RestorePanel formatError={formatError} isBusy={exportingState.isExporting} onRestorePlaylist={onRestorePlaylist} />
      )}

      {currentTool === 'history' && (
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

      {currentTool === 'insights' && (
        <InsightsPanel
          history={history}
          selectedHistoryId={selectedHistoryId}
          onSelectHistory={setSelectedHistoryId}
        />
      )}

      {currentTool === 'lyrics' && (
        <LyricsPanel
          formatError={formatError}
          onAuthExpired={onAuthExpired}
          provider={provider}
        />
      )}
    </section>
  );
};
