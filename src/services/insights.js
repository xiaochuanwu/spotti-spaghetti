const countValues = (items, selector) => {
  const counts = new Map();

  items.forEach((item) => {
    const values = selector(item);
    values.forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

const parseYear = (value) => {
  const year = Number(String(value || '').slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
};

const formatDurationHours = (durationMs) => (
  Math.round((durationMs / 3600000) * 10) / 10
);

const uniqueCount = (items) => new Set(items.filter(Boolean)).size;

const getDurationExtremes = (tracks) => {
  const tracksWithDuration = tracks.filter(track => Number(track.durationMs) > 0);
  if (tracksWithDuration.length === 0) {
    return { longestTrack: null, shortestTrack: null };
  }

  return tracksWithDuration.reduce((extremes, track) => {
    const duration = Number(track.durationMs);
    return {
      longestTrack: duration > Number(extremes.longestTrack.durationMs) ? track : extremes.longestTrack,
      shortestTrack: duration < Number(extremes.shortestTrack.durationMs) ? track : extremes.shortestTrack,
    };
  }, {
    longestTrack: tracksWithDuration[0],
    shortestTrack: tracksWithDuration[0],
  });
};

const getPopularityBuckets = (tracks) => {
  const ranges = [
    { label: '0-20', min: 0, max: 20 },
    { label: '21-40', min: 21, max: 40 },
    { label: '41-60', min: 41, max: 60 },
    { label: '61-80', min: 61, max: 80 },
    { label: '81-100', min: 81, max: 100 },
  ];

  return ranges.map(range => ({
    label: range.label,
    count: tracks.filter(track => {
      const popularity = Number(track.popularity);
      return Number.isFinite(popularity) && popularity >= range.min && popularity <= range.max;
    }).length,
  }));
};

export const buildInsights = (history) => {
  const tracks = history.flatMap(snapshot => snapshot.tracks || []);
  const uniqueTracks = Array.from(new Map(tracks.map(track => [track.uri, track])).values());
  const trackCount = uniqueTracks.length;

  if (trackCount === 0) {
    return {
      trackCount: 0,
      snapshotCount: history.length,
      averagePopularity: 0,
      averageDurationMinutes: 0,
      explicitRatio: 0,
      highPopularityRatio: 0,
      discoveryRatio: 0,
      totalDurationHours: 0,
      artistCount: 0,
      albumCount: 0,
      genreCount: 0,
      labelCount: 0,
      averageReleaseYear: null,
      oldestYear: null,
      newestYear: null,
      longestTrack: null,
      shortestTrack: null,
      mostCommonReleaseYear: null,
      popularityBuckets: getPopularityBuckets([]),
      topArtists: [],
      topAlbums: [],
      topDecades: [],
      topGenres: [],
      topLabels: [],
      topYears: [],
    };
  }

  const popularities = uniqueTracks
    .map(track => Number(track.popularity))
    .filter(value => Number.isFinite(value));

  const explicitCount = uniqueTracks.filter(track => track.explicit === 'Yes').length;
  const highPopularityCount = uniqueTracks.filter(track => Number(track.popularity) >= 70).length;
  const discoveryCount = uniqueTracks.filter(track => Number(track.popularity) > 0 && Number(track.popularity) <= 40).length;
  const totalDurationMs = uniqueTracks.reduce((sum, track) => sum + (Number(track.durationMs) || 0), 0);
  const years = uniqueTracks.map(track => parseYear(track.releaseDate)).filter(Boolean);
  const artistNames = uniqueTracks.flatMap(track => (track.artistNames || '').split(',').map(value => value.trim()));
  const genres = uniqueTracks.flatMap(track => (track.genres || '').split(',').map(value => value.trim()));
  const releaseYearCounts = countValues(uniqueTracks, track => {
    const year = parseYear(track.releaseDate);
    return year ? [String(year)] : [];
  });
  const { longestTrack, shortestTrack } = getDurationExtremes(uniqueTracks);

  return {
    trackCount,
    snapshotCount: history.length,
    averagePopularity: popularities.length
      ? Math.round(popularities.reduce((sum, value) => sum + value, 0) / popularities.length)
      : 0,
    averageDurationMinutes: totalDurationMs
      ? Math.round((totalDurationMs / trackCount / 60000) * 10) / 10
      : 0,
    explicitRatio: Math.round((explicitCount / trackCount) * 100),
    highPopularityRatio: Math.round((highPopularityCount / trackCount) * 100),
    discoveryRatio: Math.round((discoveryCount / trackCount) * 100),
    totalDurationHours: formatDurationHours(totalDurationMs),
    artistCount: uniqueCount(artistNames),
    albumCount: uniqueCount(uniqueTracks.map(track => track.albumName)),
    genreCount: uniqueCount(genres),
    labelCount: uniqueCount(uniqueTracks.map(track => track.recordLabel)),
    averageReleaseYear: years.length
      ? Math.round(years.reduce((sum, year) => sum + year, 0) / years.length)
      : null,
    oldestYear: years.length ? Math.min(...years) : null,
    newestYear: years.length ? Math.max(...years) : null,
    longestTrack,
    shortestTrack,
    mostCommonReleaseYear: releaseYearCounts[0] || null,
    popularityBuckets: getPopularityBuckets(uniqueTracks),
    topArtists: countValues(uniqueTracks, track => (track.artistNames || '').split(',').map(value => value.trim())).slice(0, 8),
    topAlbums: countValues(uniqueTracks, track => [track.albumName]).slice(0, 8),
    topDecades: countValues(uniqueTracks, track => {
      const year = parseYear(track.releaseDate);
      return year ? [`${Math.floor(year / 10) * 10}s`] : [];
    }).slice(0, 8),
    topGenres: countValues(uniqueTracks, track => (track.genres || '').split(',').map(value => value.trim())).slice(0, 8),
    topLabels: countValues(uniqueTracks, track => [track.recordLabel]).slice(0, 8),
    topYears: releaseYearCounts.slice(0, 8),
  };
};
