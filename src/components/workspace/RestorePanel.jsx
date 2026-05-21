import { useState } from 'react';
import { useI18n } from '../../i18n';
import { extractTrackUrisFromCSV } from '../../services/csv.js';

export const RestorePanel = ({ formatError, isBusy, onRestorePlaylist }) => {
  const { t } = useI18n();
  const [restoreName, setRestoreName] = useState('');
  const [restoreUris, setRestoreUris] = useState([]);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [dedupeTracks, setDedupeTracks] = useState(false);
  const [csvText, setCsvText] = useState('');

  const updateRestoreUris = (text, shouldDedupe) => {
    const uris = extractTrackUrisFromCSV(text, { dedupe: shouldDedupe });
    setRestoreUris(uris);
    setRestoreStatus(t(shouldDedupe ? 'restore.loadedDeduped' : 'restore.loaded', uris.length));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvText(text);
    updateRestoreUris(text, dedupeTracks);
    if (!restoreName) {
      setRestoreName(file.name.replace(/\.csv$/i, ''));
    }
  };

  const handleDedupeChange = (event) => {
    const shouldDedupe = event.target.checked;
    setDedupeTracks(shouldDedupe);
    if (csvText) updateRestoreUris(csvText, shouldDedupe);
  };

  const handleRestore = async () => {
    if (!restoreName.trim() || restoreUris.length === 0) return;
    setRestoreStatus(t('restore.running'));
    try {
      const playlist = await onRestorePlaylist(restoreName.trim(), restoreUris);
      setRestoreStatus(t('restore.done', playlist?.name || restoreName));
    } catch (err) {
      setRestoreStatus(t('restore.failed', formatError?.(err) || t('error.genericDetail')));
    }
  };

  return (
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
      <label className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
        <input
          type="checkbox"
          checked={dedupeTracks}
          onChange={handleDedupeChange}
          className="h-4 w-4 rounded border-[#d2d2d7] accent-[#0071e3]"
        />
        <span>{t('restore.dedupe')}</span>
      </label>
      {restoreStatus && <p className="mt-3 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6]">{restoreStatus}</p>}
    </div>
  );
};
