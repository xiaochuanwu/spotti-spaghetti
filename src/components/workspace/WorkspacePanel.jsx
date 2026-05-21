import { useState } from 'react';
import { BarChart3, Clock3, RotateCcw, Upload, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { HistoryPanel } from './HistoryPanel.jsx';
import { InsightsPanel } from './InsightsPanel.jsx';
import { RestorePanel } from './RestorePanel.jsx';

const PanelButton = ({ active, children, icon: Icon, onClick }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
      active
        ? 'bg-[#0071e3] text-white'
        : 'bg-white dark:bg-[#1d1d1f] text-[#6e6e73] dark:text-[#a1a1a6] border border-[#e5e5e7] dark:border-[#333336] hover:text-[#0071e3]'
    }`}
  >
    <Icon size={14} />
    <span>{children}</span>
  </button>
);

export const WorkspacePanel = ({
  batchSessionState,
  formatError,
  history,
  isBusy,
  latestDiff,
  onClearHistory,
  onDeleteHistory,
  onExportHistory,
  onImportHistory,
  onRestorePlaylist,
  onRestoreSnapshot,
  onRetryBatch,
}) => {
  const { t } = useI18n();
  const [activePanel, setActivePanel] = useState(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');

  const togglePanel = (panel) => {
    setActivePanel(current => current === panel ? null : panel);
  };

  const handleAnalyze = (id) => {
    setSelectedHistoryId(id);
    setActivePanel('insights');
  };

  return (
    <section className="w-full mb-6 select-none animate-fade-in-up">
      <div className="flex flex-wrap items-center gap-2">
        <PanelButton active={activePanel === 'restore'} icon={Upload} onClick={() => togglePanel('restore')}>
          {t('workspace.restore')}
        </PanelButton>
        <PanelButton active={activePanel === 'history'} icon={Clock3} onClick={() => togglePanel('history')}>
          {t('workspace.history')}
        </PanelButton>
        <PanelButton active={activePanel === 'insights'} icon={BarChart3} onClick={() => togglePanel('insights')}>
          {t('workspace.insights')}
        </PanelButton>
        {batchSessionState?.failed?.length > 0 && (
          <button
            onClick={onRetryBatch}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 disabled:opacity-50"
          >
            <RotateCcw size={14} />
            <span>{t('batch.retryFailed', batchSessionState.failed.length)}</span>
          </button>
        )}
        {activePanel && (
          <button
            onClick={() => setActivePanel(null)}
            className="ml-auto p-2 rounded-xl text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
            aria-label={t('workspace.close')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {activePanel === 'restore' && (
        <RestorePanel formatError={formatError} isBusy={isBusy} onRestorePlaylist={onRestorePlaylist} />
      )}

      {activePanel === 'history' && (
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

      {activePanel === 'insights' && (
        <InsightsPanel
          history={history}
          selectedHistoryId={selectedHistoryId}
          onSelectHistory={setSelectedHistoryId}
        />
      )}
    </section>
  );
};
