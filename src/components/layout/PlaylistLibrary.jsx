import { SearchFilter } from '../SearchFilter';
import { PlaylistsContainer } from '../PlaylistsContainer';
import { useI18n } from '../../i18n';

export const PlaylistLibrary = ({
  exportingState,
  onExportAll,
  onExportSingle,
  onPreview,
  onSearchChange,
  onSelectedPlaylistIdsChange,
  onViewModeChange,
  playlistCount,
  playlists,
  searchQuery,
  showHeader = true,
  selectedPlaylistIds,
  viewMode,
}) => {
  const { t } = useI18n();

  return (
    <section aria-labelledby={showHeader ? 'playlist-library-title' : undefined} className="min-w-0">
      {showHeader && (
      <div className="mb-5 border-b border-[#e5e5e7] pb-4 dark:border-[#333336]/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
              {t('workspace.library')}
            </p>
            <h2
              id="playlist-library-title"
              className="mt-1 text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              {t('playlists.title')}
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#86868b]">
              {t('playlists.count', playlistCount)}
            </p>
          </div>

          <div className="w-full xl:max-w-xl">
            <SearchFilter
              value={searchQuery}
              onChange={onSearchChange}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />
          </div>
        </div>
      </div>
      )}

      <PlaylistsContainer
        playlists={playlists}
        onExportSingle={onExportSingle}
        onExportAll={onExportAll}
        exportingState={exportingState}
        viewMode={viewMode}
        onPreview={onPreview}
        selectedPlaylistIds={selectedPlaylistIds}
        onSelectedPlaylistIdsChange={onSelectedPlaylistIdsChange}
        showTitle={false}
      />
    </section>
  );
};
