import { Search, LayoutGrid, List } from 'lucide-react';
import { useI18n } from '../i18n';

export const SearchFilter = ({ 
  value, 
  onChange, 
  viewMode, 
  onViewModeChange 
}) => {
  const { t } = useI18n();

  return (
    <div className="w-full flex flex-col sm:flex-row items-center gap-4 mb-6 select-none animate-fade-in-up">
      {/* Search Input Box */}
      <div className="relative flex-1 w-full">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#86868b]">
          <Search size={15} />
        </div>
        <input
          type="text"
          placeholder={t('search.placeholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#1d1d1f] hover:bg-[#f0f0f2] dark:hover:bg-[#2d2d30] focus:bg-[#fafafa] dark:focus:bg-[#161617] border border-[#e5e5e7] dark:border-[#333336] focus:border-[#0071e3] rounded-xl text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] text-sm font-normal focus:outline-none transition-all duration-200 shadow-sm dark:shadow-none"
        />
      </div>

      {/* Segmented Control View Switcher */}
      <div className="flex items-center bg-[#e8e8ed] dark:bg-[#1d1d1f] p-1 rounded-xl border border-[#d2d2d7] dark:border-[#333336] shrink-0">
        <button
          onClick={() => onViewModeChange('grid')}
          aria-label={t('search.grid')}
          className={`p-2 rounded-lg cursor-pointer transition-all duration-150 ${
            viewMode === 'grid' 
              ? 'bg-white dark:bg-[#424245] text-[#1d1d1f] dark:text-white shadow-sm dark:shadow-none' 
              : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
          }`}
        >
          <LayoutGrid size={15} />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          aria-label={t('search.list')}
          className={`p-2 rounded-lg cursor-pointer transition-all duration-150 ${
            viewMode === 'list' 
              ? 'bg-white dark:bg-[#424245] text-[#1d1d1f] dark:text-white shadow-sm dark:shadow-none' 
              : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
          }`}
        >
          <List size={15} />
        </button>
      </div>
    </div>
  );
};
