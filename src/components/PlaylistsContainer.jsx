import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, FileArchive, Music, Loader2, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';

export const PlaylistsContainer = ({ 
  playlists, 
  onExportSingle, 
  onExportAll, 
  exportingState,
  viewMode,
  onPreview
}) => {
  const { t } = useI18n();
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState(() => new Set());
  const selectAllRef = useRef(null);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedPlaylists = useMemo(() => {
    if (!sortColumn) return playlists;

    return [...playlists].sort((a, b) => {
      let comparison = 0;
      if (sortColumn === 'Tracks') {
        comparison = (a.tracks?.total || 0) - (b.tracks?.total || 0);
      } else if (sortColumn === 'Name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortColumn === 'Owner') {
        const ownerA = a.owner?.display_name || a.owner?.id || '';
        const ownerB = b.owner?.display_name || b.owner?.id || '';
        comparison = ownerA.localeCompare(ownerB);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [playlists, sortColumn, sortDirection]);

  const playlistIds = useMemo(() => playlists.map(playlist => playlist.id).filter(Boolean), [playlists]);
  const selectedPlaylists = useMemo(
    () => playlists.filter(playlist => selectedPlaylistIds.has(playlist.id)),
    [playlists, selectedPlaylistIds]
  );
  const selectedCount = selectedPlaylists.length;
  const allSelected = playlistIds.length > 0 && playlistIds.every(id => selectedPlaylistIds.has(id));
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const togglePlaylistSelection = (playlistId) => {
    setSelectedPlaylistIds(current => {
      const next = new Set(current);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedPlaylistIds(current => {
      const next = new Set(current);
      if (allSelected) {
        playlistIds.forEach(id => next.delete(id));
      } else {
        playlistIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPlaylistIds(new Set());
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown size={12} className="inline ml-1 text-[#86868b] group-hover:text-[#1d1d1f] dark:group-hover:text-white transition-colors" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={12} className="inline ml-1 text-[#0071e3]" />
      : <ArrowDown size={12} className="inline ml-1 text-[#0071e3]" />;
  };

  const isGlobalExporting = exportingState.isExporting && exportingState.activePlaylistId === 'all';

  const renderGridView = () => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-fade-in-up">
        {sortedPlaylists.map((playlist, i) => {
          const isCurrentExporting = exportingState.isExporting && exportingState.activePlaylistId === playlist.id;
          const isAnyExporting = exportingState.isExporting;
          const imageUrl = playlist.images && playlist.images.length > 0 ? playlist.images[0].url : null;

          return (
            <div 
              key={playlist.id || i}
              className="bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 p-4 rounded-2xl transition-all duration-300 hover:bg-[#f0f0f2] dark:hover:bg-[#2d2d30] flex flex-col select-none shadow-sm dark:shadow-none"
            >
              <label className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold text-[#86868b]">
                <input
                  type="checkbox"
                  checked={selectedPlaylistIds.has(playlist.id)}
                  onChange={() => togglePlaylistSelection(playlist.id)}
                  aria-label={t('playlists.selectOne', playlist.name)}
                  className="h-4 w-4 rounded border-[#d2d2d7] accent-[#0071e3]"
                />
                <span>{t('playlists.select')}</span>
              </label>

              <div 
                onClick={() => onPreview && onPreview(playlist)}
                className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#f0f0f2] dark:bg-[#161617] flex items-center justify-center mb-4 cursor-pointer group/cover border border-black/[0.04] dark:border-white/[0.04]"
                title={t('preview.title')}
              >
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={playlist.name} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-105"
                  />
                ) : (
                  <Music className="w-10 h-10 text-[#86868b]" />
                )}
                
                <div className="absolute inset-0 bg-black/10 dark:bg-black/20 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <span className="bg-white/95 dark:bg-[#1c1c1e]/95 text-[#1d1d1f] dark:text-[#f5f5f7] text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm transform translate-y-2 group-hover/cover:translate-y-0 transition-transform duration-200 border border-black/[0.05] dark:border-white/[0.05]">
                    {t('preview.title')}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-1 justify-between mb-0.5">
                    <button 
                      onClick={() => onPreview && onPreview(playlist)}
                      className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm md:text-base leading-tight truncate hover:underline hover:text-[#0071e3] dark:hover:text-[#30a2ff] text-left block flex-1 cursor-pointer"
                    >
                      {playlist.name}
                    </button>
                    {playlist.external_urls?.spotify && (
                      <a 
                        href={playlist.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#86868b] hover:text-[#0071e3] transition-colors p-0.5 mt-0.5 shrink-0"
                        title={t('playlists.openSpotify')}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  
                  <div className="text-xs text-[#86868b] truncate">
                    {t('playlists.creator')}{' '}
                    <a 
                      href={playlist.owner?.external_urls?.spotify} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"
                    >
                      {playlist.owner?.display_name || playlist.owner?.id}
                    </a>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#e5e5e7] dark:border-[#333336]/40 pt-3">
                  <span className="text-[11px] font-semibold text-[#86868b]">
                    {playlist.tracks?.total} {t('playlists.tracks')}
                  </span>

                  <button
                    onClick={() => onExportSingle(playlist)}
                    disabled={isAnyExporting}
                    className="inline-flex items-center justify-center bg-[#e8e8ed] dark:bg-[#2d2d30] hover:bg-[#0071e3] disabled:bg-neutral-200 dark:disabled:bg-neutral-800/40 text-[#0071e3] hover:text-white disabled:text-neutral-400 dark:disabled:text-neutral-600 px-4 py-1 rounded-full text-xs font-bold tracking-tight cursor-pointer transition-all duration-200 ease-out active:scale-95 disabled:cursor-not-allowed uppercase"
                  >
                    {isCurrentExporting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      t('playlists.export')
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl overflow-hidden animate-fade-in-up shadow-sm dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#fafafa] dark:bg-[#1c1c1e] border-b border-[#e5e5e7] dark:border-[#333336] select-none">
              <tr className="text-xs tracking-wider text-[#86868b] uppercase">
                <th className="p-3 w-12 text-center">{t('playlists.select')}</th>
                <th className="p-3 w-16 text-center">{t('playlists.col.cover')}</th>
                <th 
                  className="p-3 font-semibold cursor-pointer group hover:bg-[#f0f0f2] dark:hover:bg-[#2d2d30] transition-colors"
                  onClick={() => handleSort('Name')}
                >
                  <span>{t('playlists.col.name')}</span>
                  {renderSortIcon('Name')}
                </th>
                <th 
                  className="p-3 font-semibold cursor-pointer group hover:bg-[#f0f0f2] dark:hover:bg-[#2d2d30] transition-colors"
                  onClick={() => handleSort('Owner')}
                >
                  <span>{t('playlists.col.owner')}</span>
                  {renderSortIcon('Owner')}
                </th>
                <th 
                  className="p-3 font-semibold cursor-pointer group hover:bg-[#f0f0f2] dark:hover:bg-[#2d2d30] transition-colors text-center w-28"
                  onClick={() => handleSort('Tracks')}
                >
                  <span>{t('playlists.col.tracks')}</span>
                  {renderSortIcon('Tracks')}
                </th>
                <th className="p-3 text-right w-36">{t('playlists.col.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e7] dark:divide-[#333336]/40 text-sm text-[#1d1d1f] dark:text-[#f5f5f7]">
              {sortedPlaylists.map((playlist, i) => {
                const isCurrentExporting = exportingState.isExporting && exportingState.activePlaylistId === playlist.id;
                const isAnyExporting = exportingState.isExporting;
                const imageUrl = playlist.images && playlist.images.length > 0 ? playlist.images[0].url : null;

                return (
                  <tr 
                    key={playlist.id || i}
                    className="hover:bg-[#f5f5f7] dark:hover:bg-[#2d2d30]/40 transition-colors duration-150 group"
                  >
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPlaylistIds.has(playlist.id)}
                        onChange={() => togglePlaylistSelection(playlist.id)}
                        aria-label={t('playlists.selectOne', playlist.name)}
                        className="h-4 w-4 rounded border-[#d2d2d7] accent-[#0071e3]"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <div 
                        onClick={() => onPreview && onPreview(playlist)}
                        className="w-8 h-8 rounded bg-[#f0f0f2] dark:bg-[#161617] border border-neutral-200 dark:border-neutral-800/10 overflow-hidden mx-auto flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        title={t('preview.title')}
                      >
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={playlist.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-3.5 h-3.5 text-[#86868b]" />
                        )}
                      </div>
                    </td>

                    <td className="p-2.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => onPreview && onPreview(playlist)}
                          className="hover:underline text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#30a2ff] cursor-pointer font-medium text-left"
                        >
                          {playlist.name}
                        </button>
                        {playlist.external_urls?.spotify && (
                          <a 
                            href={playlist.external_urls.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#86868b] hover:text-[#0071e3] transition-colors p-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title={t('playlists.openSpotify')}
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="p-2.5 text-[#86868b]">
                      <a 
                        href={playlist.owner?.external_urls?.spotify} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors"
                      >
                        {playlist.owner?.display_name || playlist.owner?.id}
                      </a>
                    </td>

                    <td className="p-2.5 text-center text-[#86868b] font-semibold">
                      {playlist.tracks?.total}
                    </td>

                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => onExportSingle(playlist)}
                        disabled={isAnyExporting}
                        className="inline-flex items-center justify-center bg-[#e8e8ed] dark:bg-[#2d2d30] hover:bg-[#0071e3] disabled:bg-neutral-200 dark:disabled:bg-neutral-800/40 text-[#0071e3] hover:text-white disabled:text-neutral-400 dark:disabled:text-neutral-600 px-4 py-1 rounded-full text-xs font-bold tracking-tight cursor-pointer transition-all duration-200 ease-out active:scale-95 disabled:cursor-not-allowed uppercase"
                      >
                        {isCurrentExporting ? (
                          <>
                            <Loader2 size={11} className="animate-spin mr-1" />
                            <span>{t('playlists.exporting')}</span>
                          </>
                        ) : (
                          <span>{t('playlists.export')}</span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      <div className="flex flex-col gap-3 border-b border-[#e5e5e7] dark:border-[#333336] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold text-[#86868b] tracking-wider uppercase">
          {t('playlists.title')}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e7] dark:border-[#333336] bg-white dark:bg-[#1d1d1f] px-3 py-2 text-xs font-bold text-[#6e6e73] dark:text-[#a1a1a6]">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={playlistIds.length === 0}
              aria-label={allSelected ? t('playlists.selectNone') : t('playlists.selectAll')}
              className="h-4 w-4 rounded border-[#d2d2d7] accent-[#0071e3]"
            />
            <span>{allSelected ? t('playlists.selectNone') : t('playlists.selectAll')}</span>
          </label>

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full px-3 py-2 text-xs font-bold text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
            >
              {t('playlists.clearSelection')}
            </button>
          )}

          <button
            onClick={() => onExportAll(selectedPlaylists)}
            disabled={exportingState.isExporting || selectedCount === 0}
            className="inline-flex items-center gap-1.5 bg-[#e8e8ed] dark:bg-[#2d2d30] hover:bg-[#0071e3] disabled:bg-neutral-200 dark:disabled:bg-neutral-800/40 text-[#0071e3] hover:text-white disabled:text-neutral-400 dark:disabled:text-neutral-600 text-xs font-bold px-4 py-2 rounded-full cursor-pointer transition-all duration-200 disabled:cursor-not-allowed hover:shadow active:scale-95"
          >
            {isGlobalExporting && selectedCount > 0 ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileArchive size={13} />
            )}
            <span>{t('playlists.exportSelected', selectedCount)}</span>
          </button>

          <button
            onClick={() => onExportAll()}
            disabled={exportingState.isExporting}
            className="inline-flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#0077ed] disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-bold px-4 py-2 rounded-full cursor-pointer transition-all duration-200 disabled:cursor-not-allowed hover:shadow active:scale-95"
          >
            {isGlobalExporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileArchive size={13} />
            )}
            <span>{t('playlists.exportAll')}</span>
          </button>
        </div>
      </div>

      {playlists.length > 0 ? (
        viewMode === 'grid' ? renderGridView() : renderListView()
      ) : (
        <div className="w-full bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-2xl p-16 text-center text-[#86868b] font-medium animate-fade-in shadow-sm dark:shadow-none">
          {t('playlists.empty')}
        </div>
      )}
    </div>
  );
};
