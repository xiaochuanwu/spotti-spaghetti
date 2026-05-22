import { useId, useState } from 'react';
import { useI18n } from '../../i18n';
import { extractTrackUrisFromCSV } from '../../services/csv.js';

export const RestorePanel = ({ formatError, isBusy, onRestorePlaylist }) => {
  const { t } = useI18n();
  const csvFileInputId = useId();
  const [restoreName, setRestoreName] = useState('');
  const [restoreUris, setRestoreUris] = useState([]);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [dedupeTracks, setDedupeTracks] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [selectedCsvFileName, setSelectedCsvFileName] = useState('');

  const updateRestoreUris = (text, shouldDedupe) => {
    const uris = extractTrackUrisFromCSV(text, { dedupe: shouldDedupe });
    setRestoreUris(uris);
    setRestoreStatus(t(shouldDedupe ? 'restore.loadedDeduped' : 'restore.loaded', uris.length));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setSelectedCsvFileName(file.name);
    setCsvText(text);
    updateRestoreUris(text, dedupeTracks);
    if (!restoreName) {
      setRestoreName(file.name.replace(/\.csv$/i, ''));
    }
  };

  const handleDedupeChange = (shouldDedupe) => {
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
    <div className="mt-4 bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-lg p-4 shadow-sm dark:shadow-none">
      <div className="grid gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('restore.csv')}</span>
          <input
            id={csvFileInputId}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="sr-only"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor={csvFileInputId}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg bg-[#e8e8ed] px-4 py-2 text-xs font-bold text-[#0071e3] transition-colors hover:bg-[#0071e3] hover:text-white dark:bg-[#2d2d30]"
            >
              {t('restore.chooseFile')}
            </label>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">
              {selectedCsvFileName || t('restore.noFileSelected')}
            </span>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('restore.name')}</span>
          <input
            value={restoreName}
            onChange={(event) => setRestoreName(event.target.value)}
            className="rounded-lg border border-[#e5e5e7] dark:border-[#333336] bg-[#fafafa] dark:bg-[#161617] px-3 py-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none focus:border-[#0071e3]"
          />
        </label>
        <button
          type="button"
          onClick={handleRestore}
          disabled={isBusy || !restoreName.trim() || restoreUris.length === 0}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0071e3] px-4 py-2 text-xs font-bold text-white disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800"
        >
          {t('restore.submit')}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1a6]">{t('restore.dedupe')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={dedupeTracks}
          aria-label={t('restore.dedupe')}
          onClick={() => handleDedupeChange(!dedupeTracks)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            dedupeTracks ? 'bg-[#0071e3]' : 'bg-[#d2d2d7] dark:bg-[#3a3a3c]'
          }`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            dedupeTracks ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
      {restoreStatus && <p className="mt-3 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6]">{restoreStatus}</p>}
    </div>
  );
};
