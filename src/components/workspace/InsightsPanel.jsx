import { useMemo } from 'react';
import { BarChart3, Clock3 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { buildInsights } from '../../services/insights.js';
import { HistoryRecordSelect } from './HistoryRecordSelect.jsx';

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
  <div className="rounded-lg bg-[#fafafa] dark:bg-[#161617] p-3">
    <p className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{value}</p>
    <p className="text-[10px] text-[#86868b]">{label}</p>
  </div>
);

const TrackMetricCard = ({ label, track }) => {
  const duration = Number(track?.durationMs) || 0;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const value = track ? `${minutes}:${String(seconds).padStart(2, '0')}` : '-';

  return (
    <div className="rounded-lg bg-[#fafafa] dark:bg-[#161617] p-3">
      <p className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{value}</p>
      <p className="text-[10px] text-[#86868b]">{label}</p>
      {track && (
        <p className="mt-1 truncate text-[11px] font-medium text-[#6e6e73] dark:text-[#a1a1a6]">
          {[track.name, track.artistNames].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
};

export const InsightsPanel = ({ history, selectedHistoryId, onSelectHistory }) => {
  const { t } = useI18n();
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

  return (
    <div className="mt-4 bg-white dark:bg-[#1d1d1f] border border-[#e5e5e7] dark:border-[#333336]/40 rounded-lg p-4 shadow-sm dark:shadow-none">
      <div className="rounded-lg bg-[#fafafa] dark:bg-[#161617] p-3">
        <div className="grid gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
              <Clock3 size={13} />
              {t('insights.sourceHistory')}
            </span>
            <HistoryRecordSelect
              history={history}
              selectedId={effectiveHistoryId}
              selectedItem={selectedHistoryItem}
              onChange={onSelectHistory}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
              <BarChart3 size={13} />
              {t('insights.currentRecord')}
            </span>
            <div className="flex min-h-[58px] flex-col justify-center rounded-lg border border-[#e5e5e7] dark:border-[#333336] bg-white dark:bg-[#1d1d1f] px-3 py-2">
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
        <div className="mt-5 grid gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.summary')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
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
              <MetricCard label={t('insights.avgReleaseYear')} value={insights.averageReleaseYear || '-'} />
              <MetricCard
                label={t('insights.commonReleaseYear')}
                value={insights.mostCommonReleaseYear ? `${insights.mostCommonReleaseYear.label} (${insights.mostCommonReleaseYear.count})` : '-'}
              />
              <MetricCard
                label={t('insights.releaseSpan')}
                value={insights.oldestYear && insights.newestYear ? `${insights.oldestYear}-${insights.newestYear}` : '-'}
              />
              <TrackMetricCard label={t('insights.longestTrack')} track={insights.longestTrack} />
              <TrackMetricCard label={t('insights.shortestTrack')} track={insights.shortestTrack} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{t('insights.popularityBuckets')}</p>
            {insights.popularityBuckets.map(item => (
              <MiniBar key={item.label} item={item} max={insights.trackCount} />
            ))}
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
  );
};
