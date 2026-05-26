import { BarChart3, Clock3, Library, ListMusic, Radio, RotateCcw, Upload } from 'lucide-react';
import { useI18n } from '../../i18n';

const navItems = [
  { id: 'library', icon: Library, labelKey: 'workspace.playlists' },
  { id: 'restore', icon: Upload, labelKey: 'workspace.restore' },
  { id: 'history', icon: Clock3, labelKey: 'workspace.history' },
  { id: 'insights', icon: BarChart3, labelKey: 'workspace.insights' },
  { id: 'lyrics', icon: ListMusic, labelKey: 'workspace.lyrics' },
];

const NavButton = ({ active, icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors lg:justify-start ${
      active
        ? 'bg-[#0071e3] text-white'
        : 'bg-white text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] dark:bg-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-[#2d2d30] dark:hover:text-white'
    }`}
  >
    <Icon size={15} aria-hidden="true" />
    <span className="truncate">{label}</span>
  </button>
);

export const SidebarNav = ({
  activeTool,
  batchFailedCount,
  isBusy,
  onRetryBatch,
  onToolChange,
  provider,
}) => {
  const { t } = useI18n();

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section className="rounded-lg border border-[#e5e5e7] bg-white p-3 shadow-sm dark:border-[#333336]/60 dark:bg-[#1d1d1f] dark:shadow-none">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
          {t('workspace.provider')}
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          <Radio size={15} className="text-[#0071e3]" aria-hidden="true" />
          <span className="truncate">{provider?.name || t('workspace.providerSpotify')}</span>
        </div>
      </section>

      <nav
        aria-label={t('workspace.navigation')}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
      >
        {navItems.map(item => (
          <NavButton
            key={item.id || 'playlists'}
            active={activeTool === item.id}
            icon={item.icon}
            label={t(item.labelKey)}
            onClick={() => onToolChange(item.id)}
          />
        ))}
      </nav>

      {batchFailedCount > 0 && (
        <button
          type="button"
          onClick={onRetryBatch}
          disabled={isBusy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 lg:justify-start"
        >
          <RotateCcw size={15} aria-hidden="true" />
          <span className="truncate">{t('batch.retryFailed', batchFailedCount)}</span>
        </button>
      )}
    </div>
  );
};
