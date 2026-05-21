import { useState } from 'react';
import { useI18n } from '../../i18n';
import { extractTrackUrisFromCSV } from '../../services/csv.js';

export const RestorePanel = ({ formatError, isBusy, onRestorePlaylist }) => {
  const { t } = useI18n();
  const [restoreName, setRestoreName] = useState('');
  const [restoreUris, setRestoreUris] = useState([]);
  const [restoreStatus, setRestoreStatus] = useState('');

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
      {restoreStatus && <p className="mt-3 text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6]">{restoreStatus}</p>}
    </div>
  );
};
