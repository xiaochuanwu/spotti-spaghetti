import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Check, ChevronDown, Clock3, RotateCcw, Upload, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { extractTrackUrisFromCSV } from '../services/csv.js';
import { buildInsights } from '../services/insights.js';

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

const MiniBar = ({ item, max }) => (
  <div className="flex items-center gap-2">
    <span className="w-24 truncate text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">{item.label}</span>
    <div className="h-1.5 flex-1 rounded-full bg-[#e5e5e7] dark:bg-[#333336] overflow-hidden">
      <div className="h-full rounded-full bg-[#0071e3]" style={{ width: `${max ? (item.count / max) * 100 : 0}%` }} />
    </div>
    <span className="w-8 text-right text-[11px] font-semibold text-[#86868b]">{item.count}</span>
  </div>
);

const MetricCard = ({ label, value }) => (
  <div className="rounded-xl bg-[#fafafa] dark:bg-[#161617] p-3">
    <p className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{value}</p>
    <p className="text-[10px] text-[#86868b]">{label}</p>
  </div>
);

const HistoryRecordSelect = ({ history, selectedId, selectedItem, onChange, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const isDisabled = history.length === 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-white dark:bg-[#1d1d1f] px-3 py-2 text-left text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none transition-colors hover:border-[#0071e3]/60 focus:border-[#0071e3] disabled:text-[#86868b]"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {selectedItem?.playlistName || t('insights.noHistory')}
          </span>
          {selectedItem && (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-[#86868b]">
              {new Date(selectedItem.createdAt).toLocaleString()} · {selectedItem.trackCount} {t('playlists.tracks')}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#86868b] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && !isDisabled && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-white/95 dark:bg-[#1d1d1f]/95 p-1.5 shadow-xl backdrop-blur-xl animate-fade-in"
        >
          {history.map(item => {
            const selected = item.id === selectedId;

            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(item.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? 'bg-[#0071e3]/10 text-[#0071e3]'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7] dark:text-[#f5f5f7] dark:hover:bg-[#2d2d30]'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.playlistName}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-[#86868b]">
                    {new Date(item.createdAt).toLocaleString()} · {item.trackCount} {t('playlists.tracks')}
                  </span>
                </span>
                {selected && <Check size={15} className="shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const WorkspacePanel = ({
  batchSessionState,
  history,
  isBusy,
  latestDiff,
  onClearHistory,
  onRestorePlaylist,
  onRetryBatch,
}) => {
  const { t } = useI18n();
  const [activePanel, setActivePanel] = useState(null);
  const [restoreName, setRestoreName] = useState('');
  const [restoreUris, setRestoreUris] = useState([]);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [selectedHistoryId, setSelectedHistoryId] = useState('');

  const latestHistory = history.slice(0, 6);
  const effectiveHistoryId = useMemo(() => {
    if (history.some(item => item.id === selectedHistoryId)) return selectedHistoryId;
    return history[0]?.id || '';
  }, [history, selectedHistoryId]);
  const selectedHistoryItem = useMemo(
    () => history.find(item => item.id === effectiveHistoryId) || null,
    [history, effectiveHistoryId]
  );
  const analysisSnapshot = selectedHistoryItem;
  const insights = useMemo(
    () => buildInsights(analysisSnapshot ? [analysisSnapshot] : []),
    [analysisSnapshot]
  );
  const maxArtistCount = useMemo(() => Math.max(...insights.topArtists.map(item => item.count), 0), [insights]);
  const maxAlbumCount = useMemo(() => Math.max(...insights.topAlbums.map(item => item.count), 0), [insights]);
  const maxDecadeCount = useMemo(() => Math.max(...insights.topDecades.map(item => item.count), 0), [insights]);
  const maxGenreCount = useMemo(() => Math.max(...insights.topGenres.map(item => item.count), 0), [insights]);
  const maxLabelCount = useMemo(() => Math.max(...insights.topLabels.map(item => item.count), 0), [insights]);
  const maxYearCount = useMemo(() => Math.max(...insights.topYears.map(item => item.count), 0), [insights]);

  const togglePanel = (panel) => {
    setActivePanel(current => current === panel ? null : panel);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const uris = extractTrackUrisFromCSV(text);
    setRestoreUris(uris);
    setRestoreStatus(t('restore.loaded', uris.length));
    if (!restoreName) {
      setRestoreName(file.name.replace(/\.csv$/i, ''));
    }
  };

  const handleRestore = async () => {
    if (!restoreName.trim() || restoreUris.length === 0) return;
    setRestoreStatus(t('restore.running'));
    try {
      const playlist = await onRestorePlaylist(restoreName.trim(), restoreUris);
      setRestoreStatus(t('restore.done', playlist?.name || restoreName));
    } catch (err) {
      setRestoreStatus(t('restore.failed', err.message));
    }
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
        <div className="mt-4 bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl p-4 shadow-sm dark:shadow-none">
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('restore.csv')}</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="text-xs text-[#6e6e73] file:mr-3 file:rounded-full file:border-0 file:bg-[#e8e8ed] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#0071e3] dark:file:bg-[#2d2d30]" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('restore.name')}</span>
              <input
                value={restoreName}
                onChange={(event) => setRestoreName(event.target.value)}
                className="rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-[#fafafa] dark:bg-[#161617] px-3 py-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3]"
              />
            </label>
            <button
              onClick={handleRestore}
              disabled={isBusy || !restoreName.trim() || restoreUris.length === 0}
              className="rounded-full bg-[#0071e3] px-4 py-2 text-xs font-bold text-white disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800"
            >
              {t('restore.submit')}
            </button>
          </div>
          {restoreStatus && <p className="mt-3 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6]">{restoreStatus}</p>}
        </div>
      )}

      {activePanel === 'history' && (
        <div className="mt-4 bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl p-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b]">{t('history.title')}</h3>
            {history.length > 0 && (
              <button onClick={onClearHistory} className="text-xs font-bold text-red-500 hover:text-red-600">
                {t('history.clear')}
              </button>
            )}
          </div>
          {latestDiff && (
            <div className="mb-3 rounded-xl bg-[#f0f5ff] dark:bg-[#161617] border border-[#0071e3]/20 px-3 py-2">
              <p className="text-xs font-bold text-[#0071e3]">
                {latestDiff.hasPrevious
                  ? t('history.latestDiff', latestDiff.playlistName, latestDiff.added.length, latestDiff.removed.length)
                  : t('history.firstSnapshot', latestDiff.playlistName)}
              </p>
              {latestDiff.hasPrevious && (latestDiff.added.length > 0 || latestDiff.removed.length > 0) && (
                <p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] truncate">
                  {[...latestDiff.added.slice(0, 2), ...latestDiff.removed.slice(0, 2)].map(track => track.name).filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )}
          {latestHistory.length === 0 ? (
            <p className="text-sm text-[#86868b]">{t('history.empty')}</p>
          ) : (
            <div className="grid gap-2">
              {latestHistory.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#fafafa] dark:bg-[#161617] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{item.playlistName}</p>
                    <p className="text-[11px] text-[#86868b]">{new Date(item.createdAt).toLocaleString()} · {item.trackCount} {t('playlists.tracks')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedHistoryId(item.id);
                      setActivePanel('insights');
                    }}
                    className="shrink-0 rounded-full bg-[#e8e8ed] px-3 py-1 text-[11px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30]"
                  >
                    {t('history.analyze')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activePanel === 'insights' && (
        <div className="mt-4 bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl p-4 shadow-sm dark:shadow-none">
          <div className="rounded-xl bg-[#fafafa] dark:bg-[#161617] p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                  <Clock3 size={13} />
                  {t('insights.sourceHistory')}
                </span>
                <HistoryRecordSelect
                  history={history}
                  selectedId={effectiveHistoryId}
                  selectedItem={selectedHistoryItem}
                  onChange={setSelectedHistoryId}
                  t={t}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                  <BarChart3 size={13} />
                  {t('insights.currentRecord')}
                </span>
                <div className="flex min-h-[58px] flex-col justify-center rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-white dark:bg-[#1d1d1f] px-3 py-2">
                  <p className="truncate text-xs font-bold text-[#0071e3]">
                    {analysisSnapshot ? t('insights.currentSource', analysisSnapshot.playlistName) : t('insights.noHistory')}
                  </p>
                  {analysisSnapshot && (
                    <p className="mt-1 truncate text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">
                      {new Date(analysisSnapshot.createdAt).toLocaleString()} · {analysisSnapshot.trackCount} {t('playlists.tracks')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {insights.trackCount === 0 ? (
            <p className="mt-4 text-sm text-[#86868b]">{t('insights.empty')}</p>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.summary')}</p>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  <MetricCard label={t('insights.tracks')} value={insights.trackCount} />
                  <MetricCard label={t('insights.uniqueArtists')} value={insights.artistCount} />
                  <MetricCard label={t('insights.albums')} value={insights.albumCount} />
                  <MetricCard label={t('insights.genreCount')} value={insights.genreCount} />
                  <MetricCard label={t('insights.labelCount')} value={insights.labelCount} />
                  <MetricCard label={t('insights.duration')} value={`${insights.totalDurationHours}h`} />
                  <MetricCard label={t('insights.avgDuration')} value={`${insights.averageDurationMinutes}m`} />
                  <MetricCard label={t('insights.popularity')} value={insights.averagePopularity} />
                  <MetricCard label={t('insights.explicit')} value={`${insights.explicitRatio}%`} />
                  <MetricCard label={t('insights.mainstream')} value={`${insights.highPopularityRatio}%`} />
                  <MetricCard label={t('insights.discovery')} value={`${insights.discoveryRatio}%`} />
                  <MetricCard
                    label={t('insights.releaseSpan')}
                    value={insights.oldestYear && insights.newestYear ? `${insights.oldestYear}-${insights.newestYear}` : '-'}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.artists')}</p>
                {insights.topArtists.map(item => <MiniBar key={item.label} item={item} max={maxArtistCount} />)}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.topAlbums')}</p>
                {insights.topAlbums.map(item => <MiniBar key={item.label} item={item} max={maxAlbumCount} />)}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.genres')}</p>
                {insights.topGenres.map(item => <MiniBar key={item.label} item={item} max={maxGenreCount} />)}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.labels')}</p>
                {insights.topLabels.map(item => <MiniBar key={item.label} item={item} max={maxLabelCount} />)}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.decades')}</p>
                {insights.topDecades.map(item => <MiniBar key={item.label} item={item} max={maxDecadeCount} />)}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.years')}</p>
                {insights.topYears.map(item => <MiniBar key={item.label} item={item} max={maxYearCount} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
