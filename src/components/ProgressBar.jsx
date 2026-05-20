import { Loader2, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n';

export const ProgressBar = ({ exportingState }) => {
  const { t } = useI18n();
  const { isExporting, activePlaylistId, currentItem, progress, taskName } = exportingState;

  if (!isExporting) return null;

  const title = activePlaylistId === 'all'
    ? t('progress.batchTitle')
    : activePlaylistId === 'restore'
      ? t('progress.restoreTitle')
      : t('progress.singleTitle');

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 w-80 md:w-96 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-lg border border-[#e5e5e7] dark:border-[#333336] p-4.5 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] select-none animate-fade-in-up flex flex-col gap-2.5"
      role="status"
      aria-live="polite"
    >
      {/* Header Notification Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 size={13} className="text-[#0071e3] animate-spin" />
          <span className="font-semibold text-xs text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            {title}
          </span>
        </div>
        <span className="text-xs font-bold text-[#0071e3]">
          {progress}%
        </span>
      </div>

      {/* Thin Apple Progress Track */}
      <div className="w-full h-1 bg-[#e5e5e7] dark:bg-[#2d2d30] rounded-full overflow-hidden">
        <div 
          className="h-full bg-[#0071e3] transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Task Details */}
      <div className="flex flex-col gap-0.5 mt-0.5">
        <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
          {currentItem || t('progress.waiting')}
        </p>
        <p className="text-[10px] text-[#86868b] font-medium tracking-wide uppercase">
          {taskName || t('progress.init')}
        </p>
      </div>

      {/* Download Ready Toast */}
      {progress === 100 && (
        <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-[#0071e3] bg-[#f0f5ff] dark:bg-[#161617] border border-[#0071e3]/20 py-2 px-3 rounded-xl animate-fade-in">
          <CheckCircle2 size={13} className="shrink-0" />
          <span>{t('progress.done')}</span>
        </div>
      )}
    </div>
  );
};
