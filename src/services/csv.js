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
  'Record Label'
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
  const rows = tracks.map(track => [
    track.uri,
    track.name,
    track.albumName,
    track.artistNames,
    track.releaseDate,
    track.durationMs,
    track.popularity,
    track.explicit,
    track.addedBy,
    track.addedAt,
    track.genres,
    track.recordLabel
  ]);

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

export const extractTrackUrisFromCSV = (csvText) => {
  const rows = parseCSV(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => header.trim().toLowerCase());
  const uriIndex = headers.indexOf('track uri');
  if (uriIndex === -1) return [];

  return Array.from(new Set(
    rows
      .slice(1)
      .map(row => row[uriIndex]?.trim())
      .filter(value => value?.startsWith('spotify:track:'))
  ));
};
