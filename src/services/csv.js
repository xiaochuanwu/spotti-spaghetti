import { formatExplicit, formatList, normalizeTrack } from './musicModel.js';

export const CSV_HEADERS = [
  'Track URI',
  'Track Name',
  'Album Name',
  'Artist Name(s)',
  'Release Date',
  'Duration (ms)',
  'Popularity',
  'Explicit',
  'Added By',
  'Added At',
  'Genres',
  'Record Label',
  'Provider',
  'Provider Track ID',
  'Provider Playlist ID',
  'ISRC'
];

export const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';

  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

export const toCSV = (tracks) => {
  const rows = tracks.map((track) => {
    const normalizedTrack = normalizeTrack(track);

    return [
      normalizedTrack.uri,
      normalizedTrack.name,
      normalizedTrack.albumName,
      normalizedTrack.artistNames,
      normalizedTrack.releaseDate,
      normalizedTrack.durationMs,
      normalizedTrack.popularity,
      formatExplicit(normalizedTrack.explicit),
      normalizedTrack.addedBy,
      normalizedTrack.addedAt,
      formatList(normalizedTrack.genres),
      normalizedTrack.recordLabel,
      normalizedTrack.provider,
      normalizedTrack.providerTrackId,
      normalizedTrack.providerPlaylistId,
      normalizedTrack.isrc
    ];
  });

  return [
    CSV_HEADERS.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
};

export const getSafeFileName = (playlistName) => {
  const safeName = playlistName
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return safeName || 'playlist';
};

export const parseCSV = (csvText) => {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows.filter(row => row.some(value => value.trim() !== ''));
};

const getColumnValue = (row, headerIndex, headerName) => {
  const index = headerIndex.get(headerName);
  return index === undefined ? '' : row[index]?.trim() || '';
};

export const parseTracksFromCSV = (csvText) => {
  const rows = parseCSV(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => header.trim().toLowerCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return rows
    .slice(1)
    .map(row => normalizeTrack({
      uri: getColumnValue(row, headerIndex, 'track uri'),
      name: getColumnValue(row, headerIndex, 'track name'),
      albumName: getColumnValue(row, headerIndex, 'album name'),
      artistNames: getColumnValue(row, headerIndex, 'artist name(s)'),
      releaseDate: getColumnValue(row, headerIndex, 'release date'),
      durationMs: getColumnValue(row, headerIndex, 'duration (ms)'),
      popularity: getColumnValue(row, headerIndex, 'popularity'),
      explicit: getColumnValue(row, headerIndex, 'explicit'),
      addedBy: getColumnValue(row, headerIndex, 'added by'),
      addedAt: getColumnValue(row, headerIndex, 'added at'),
      genres: getColumnValue(row, headerIndex, 'genres'),
      recordLabel: getColumnValue(row, headerIndex, 'record label'),
      provider: getColumnValue(row, headerIndex, 'provider'),
      providerTrackId: getColumnValue(row, headerIndex, 'provider track id'),
      providerPlaylistId: getColumnValue(row, headerIndex, 'provider playlist id'),
      isrc: getColumnValue(row, headerIndex, 'isrc'),
    }))
    .filter(track => track.uri || track.providerTrackId || track.name);

};

export const extractTrackUrisFromCSV = (csvText, { dedupe = true } = {}) => {
  const uris = parseTracksFromCSV(csvText)
    .map(track => track.uri)
    .filter(value => value?.startsWith('spotify:track:'));

  return dedupe ? Array.from(new Set(uris)) : uris;
};
