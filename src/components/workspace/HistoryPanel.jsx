import { useMemo, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { exportHistory } from '../../services/exportHistory.js';

const formatTrack = (track) => (
  [track.name, track.artistNames].filter(Boolean).join(' · ')
);

const TrackList = ({ emptyLabel, items, title }) => (
  <div className="rounded-xl bg-[#fafafa] dark:bg-[#161617] p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{title}</p>
    {items.length === 0 ? (
      <p className="mt-2 text-xs text-[#86868b]">{emptyLabel}</p>
    ) : (
      <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
        {items.map(track => (
          <p key={track.uri || formatTrack(track)} className="truncate text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
            {formatTrack(track)}
          </p>
        ))}
      </div>
    )}
  </div>
);

export const HistoryPanel = ({
  history,
  latestDiff,
  onAnalyze,
  onClearHistory,
  onDeleteHistory,
  onExportHistory,
}) => {
  const { t } = useI18n();
  const [comparePlaylistId, setComparePlaylistId] = useState('');
  const [currentSnapshotId, setCurrentSnapshotId] = useState('');
  const [baselineSnapshotId, setBaselineSnapshotId] = useState('');
  const latestHistory = history.slice(0, 6);

  const comparableGroups = useMemo(() => {
    const groups = new Map();
    history.forEach((item) => {
      const key = item.playlistId || item.playlistName;
      if (!groups.has(key)) {
        groups.set(key, {
          playlistId: key,
          playlistName: item.playlistName,
          snapshots: [],
        });
      }
      groups.get(key).snapshots.push(item);
    });
    return Array.from(groups.values()).filter(group => group.snapshots.length >= 2);
  }, [history]);

  const effectiveCompareGroup = useMemo(() => (
    comparableGroups.find(group => group.playlistId === comparePlaylistId) || comparableGroups[0] || null
  ), [comparableGroups, comparePlaylistId]);
  const compareSnapshots = effectiveCompareGroup?.snapshots || [];
  const currentSnapshot = compareSnapshots.find(item => item.id === currentSnapshotId) || compareSnapshots[0] || null;
  const baselineSnapshot = compareSnapshots.find(item => item.id === baselineSnapshotId && item.id !== currentSnapshot?.id)
    || compareSnapshots.find(item => item.id !== currentSnapshot?.id)
    || null;
  const comparison = currentSnapshot && baselineSnapshot
    ? exportHistory.compare(currentSnapshot, baselineSnapshot)
    : null;

  return (
    <div className="mt-4 bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl p-4 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#86868b]">{t('history.title')}</h3>
          <p className="mt-1 text-[11px] font-medium text-[#86868b]">{t('history.localNote')}</p>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onExportHistory}
              className="inline-flex items-center gap-1 rounded-full bg-[#e8e8ed] px-3 py-1.5 text-xs font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30]"
            >
              <Download size={12} />
              <span>{t('history.exportLocal')}</span>
            </button>
            <button onClick={onClearHistory} className="text-xs font-bold text-red-500 hover:text-red-600">
              {t('history.clear')}
            </button>
          </div>
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
            <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#fafafa] dark:bg-[#161617] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{item.playlistName}</p>
                <p className="text-[11px] text-[#86868b]">
                  {new Date(item.createdAt).toLocaleString()} · {item.trackCount} {t('playlists.tracks')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => onAnalyze(item.id)}
                  className="min-w-14 rounded-full bg-[#e8e8ed] px-3 py-1 text-[11px] font-bold text-[#0071e3] hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30]"
                >
                  {t('history.analyze')}
                </button>
                <button
                  onClick={() => onDeleteHistory(item.id)}
                  className="rounded-full p-1.5 text-[#86868b] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                  aria-label={t('history.deleteOne', item.playlistName)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-[#e5e5e7] dark:border-[#333336]/60 pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#86868b]">{t('history.compareTitle')}</h4>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[#86868b]">{t('history.compareEmpty')}</p>
        ) : !effectiveCompareGroup ? (
          <p className="mt-2 text-sm text-[#86868b]">{t('history.compareNeedsTwo')}</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('history.comparePlaylist')}</span>
                <select
                  value={effectiveCompareGroup.playlistId}
                  onChange={(event) => setComparePlaylistId(event.target.value)}
                  className="rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-[#fafafa] dark:bg-[#161617] px-3 py-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3]"
                >
                  {comparableGroups.map(group => (
                    <option key={group.playlistId} value={group.playlistId}>{group.playlistName}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('history.compareCurrent')}</span>
                <select
                  value={currentSnapshot?.id || ''}
                  onChange={(event) => setCurrentSnapshotId(event.target.value)}
                  className="rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-[#fafafa] dark:bg-[#161617] px-3 py-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3]"
                >
                  {compareSnapshots.map(snapshot => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.trackCount} {t('playlists.tracks')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('history.compareBaseline')}</span>
                <select
                  value={baselineSnapshot?.id || ''}
                  onChange={(event) => setBaselineSnapshotId(event.target.value)}
                  className="rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-[#fafafa] dark:bg-[#161617] px-3 py-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3]"
                >
                  {compareSnapshots.filter(snapshot => snapshot.id !== currentSnapshot?.id).map(snapshot => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.trackCount} {t('playlists.tracks')}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {comparison && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#fafafa] dark:bg-[#161617] p-3">
                    <p className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{comparison.added.length}</p>
                    <p className="text-[10px] text-[#86868b]">{t('history.compareAdded')}</p>
                  </div>
                  <div className="rounded-xl bg-[#fafafa] dark:bg-[#161617] p-3">
                    <p className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{comparison.removed.length}</p>
                    <p className="text-[10px] text-[#86868b]">{t('history.compareRemoved')}</p>
                  </div>
                  <div className="rounded-xl bg-[#fafafa] dark:bg-[#161617] p-3">
                    <p className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{comparison.unchangedCount}</p>
                    <p className="text-[10px] text-[#86868b]">{t('history.compareUnchanged')}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <TrackList emptyLabel={t('history.compareNone')} items={comparison.added} title={t('history.compareAdded')} />
                  <TrackList emptyLabel={t('history.compareNone')} items={comparison.removed} title={t('history.compareRemoved')} />
                  <TrackList emptyLabel={t('history.compareNone')} items={comparison.unchanged} title={t('history.compareUnchanged')} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
