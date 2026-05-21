export const MUSIC_MODEL_VERSION = 1;

export const MUSIC_PROVIDERS = {
  spotify: 'spotify',
  unknown: 'unknown',
};

const normalizeString = (value) => (
  value === null || value === undefined ? '' : String(value).trim()
);

const splitList = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(',');
};

const normalizeNamedList = (value) => (
  splitList(value)
    .map(item => {
      if (typeof item === 'string') return item.trim();
      return normalizeString(item?.name || item?.label || item?.id);
    })
    .filter(Boolean)
);

export const formatList = (value) => normalizeNamedList(value).join(',');

export const inferProviderFromUri = (uri) => {
  const normalizedUri = normalizeString(uri);
  if (normalizedUri.startsWith('spotify:')) return MUSIC_PROVIDERS.spotify;
  return MUSIC_PROVIDERS.unknown;
};

export const getSpotifyTrackIdFromUri = (uri) => {
  const match = normalizeString(uri).match(/^spotify:track:([^:]+)$/);
  return match?.[1] || '';
};

const getSpotifyPlaylistIdFromUri = (uri) => {
  const match = normalizeString(uri).match(/^spotify:playlist:([^:]+)$/);
  return match?.[1] || '';
};

export const formatExplicit = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  const normalizedValue = normalizeString(value).toLowerCase();
  if (['yes', 'true', '1'].includes(normalizedValue)) return 'Yes';
  if (['no', 'false', '0'].includes(normalizedValue)) return 'No';
  return '';
};

export const normalizeExplicit = (value) => {
  if (value === true || value === false) return value;
  const label = formatExplicit(value);
  if (label === 'Yes') return true;
  if (label === 'No') return false;
  return null;
};

export const normalizeAlbum = (value, fallbackName = '') => {
  if (typeof value === 'string' || !value) {
    return { name: normalizeString(value || fallbackName) };
  }

  return {
    providerAlbumId: normalizeString(value.providerAlbumId || value.id),
    name: normalizeString(value.name || fallbackName),
  };
};

export const normalizeTrack = (track = {}, defaults = {}) => {
  const uri = normalizeString(track.uri);
  const provider = normalizeString(track.provider || defaults.provider || inferProviderFromUri(uri));
  const providerTrackId = normalizeString(
    track.providerTrackId
      || track.spotifyTrackId
      || track.id
      || (provider === MUSIC_PROVIDERS.spotify ? getSpotifyTrackIdFromUri(uri) : '')
  );
  const providerPlaylistId = normalizeString(
    track.providerPlaylistId
      || defaults.providerPlaylistId
      || track.playlistId
  );
  const artists = normalizeNamedList(normalizeString(track.artistNames) ? track.artistNames : track.artists);
  const album = normalizeAlbum(track.album, track.albumName);
  const genres = normalizeNamedList(normalizeString(track.genreNames) ? track.genreNames : track.genres);
  const explicit = normalizeExplicit(track.explicit);

  return {
    modelVersion: track.modelVersion || MUSIC_MODEL_VERSION,
    provider: provider || MUSIC_PROVIDERS.unknown,
    providerTrackId,
    providerPlaylistId,
    uri: uri || (provider === MUSIC_PROVIDERS.spotify && providerTrackId ? `spotify:track:${providerTrackId}` : ''),
    isrc: normalizeString(track.isrc || track.ISRC),
    name: normalizeString(track.name || track.trackName),
    artists,
    artistNames: formatList(artists),
    album,
    albumName: album.name,
    releaseDate: normalizeString(track.releaseDate),
    durationMs: track.durationMs === null || track.durationMs === undefined ? '' : track.durationMs,
    popularity: track.popularity === null || track.popularity === undefined ? '' : track.popularity,
    explicit,
    explicitLabel: formatExplicit(explicit),
    genres,
    genreNames: formatList(genres),
    recordLabel: normalizeString(track.recordLabel),
    addedAt: normalizeString(track.addedAt),
    addedBy: normalizeString(track.addedBy),
    rawSource: track.rawSource ?? null,
  };
};

export const normalizePlaylist = (playlist = {}, defaults = {}) => {
  const provider = normalizeString(
    playlist.provider
      || defaults.provider
      || (playlist.external_urls?.spotify ? MUSIC_PROVIDERS.spotify : '')
  ) || MUSIC_PROVIDERS.unknown;
  const providerPlaylistId = normalizeString(
    playlist.providerPlaylistId
      || playlist.id
      || (provider === MUSIC_PROVIDERS.spotify ? getSpotifyPlaylistIdFromUri(playlist.uri) : '')
  );

  return {
    modelVersion: playlist.modelVersion || MUSIC_MODEL_VERSION,
    provider,
    providerPlaylistId,
    uri: normalizeString(playlist.uri),
    name: normalizeString(playlist.name),
    trackCount: playlist.trackCount ?? playlist.tracks?.total ?? 0,
    owner: playlist.owner || null,
    rawSource: playlist.rawSource ?? null,
  };
};

export const getPlaylistIdentity = (playlist) => {
  const normalizedPlaylist = normalizePlaylist(playlist);
  if (normalizedPlaylist.provider !== MUSIC_PROVIDERS.unknown && normalizedPlaylist.providerPlaylistId) {
    return `${normalizedPlaylist.provider}:playlist:${normalizedPlaylist.providerPlaylistId}`;
  }
  if (normalizedPlaylist.uri) return `uri:${normalizedPlaylist.uri}`;
  return `playlist:${normalizedPlaylist.name}`;
};

export const getTrackIdentity = (track) => {
  const normalizedTrack = normalizeTrack(track);
  if (normalizedTrack.isrc) return `isrc:${normalizedTrack.isrc.toUpperCase()}`;
  if (normalizedTrack.provider !== MUSIC_PROVIDERS.unknown && normalizedTrack.providerTrackId) {
    return `${normalizedTrack.provider}:track:${normalizedTrack.providerTrackId}`;
  }
  if (normalizedTrack.uri) return `uri:${normalizedTrack.uri}`;

  return [
    normalizedTrack.name,
    normalizedTrack.artistNames,
    normalizedTrack.albumName,
    normalizedTrack.durationMs,
  ]
    .map(value => normalizeString(value).toLowerCase())
    .filter(Boolean)
    .join('|');
};
