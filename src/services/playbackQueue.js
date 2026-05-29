import { MUSIC_PROVIDERS, normalizeTrack } from './musicModel.js';

export const RECENTLY_PLAYED_OPTIMISTIC_TTL_MS = 5 * 60 * 1000;

const RECENTLY_PLAYED_API_SETTLE_WINDOW_MS = 45 * 1000;
const SPOTIFY_TRACK_URI_PREFIX = 'spotify:track:';

const readTrackSource = (item = {}) => (
  item?.track || item?.item || item
);

const getSpotifyTrackIdFromValue = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith(SPOTIFY_TRACK_URI_PREFIX)) {
    return text.slice(SPOTIFY_TRACK_URI_PREFIX.length);
  }

  const spotifyUrlMatch = text.match(/open\.spotify\.com\/track\/([^?]+)/);
  return spotifyUrlMatch ? decodeURIComponent(spotifyUrlMatch[1]) : text;
};

export const getPlaybackItemTrackId = (item = {}) => {
  if (typeof item === 'string') return getSpotifyTrackIdFromValue(item);

  const track = readTrackSource(item);
  return getSpotifyTrackIdFromValue(
    item?.providerTrackId ||
      item?.id ||
      item?.uri ||
      track?.providerTrackId ||
      track?.id ||
      track?.uri ||
      track?.rawSource?.id ||
      ''
  );
};

const readAlbumCover = (item = {}, track = {}) => (
  item.albumCover ||
  track.albumCover ||
  track.rawSource?.album?.images?.[0]?.url ||
  item.rawSource?.album?.images?.[0]?.url ||
  track.album?.images?.[0]?.url ||
  ''
);

const readExternalUrl = (item = {}, track = {}) => (
  item.externalUrl ||
  track.externalUrl ||
  track.rawSource?.external_urls?.spotify ||
  item.rawSource?.external_urls?.spotify ||
  ''
);

const readDurationMs = (item = {}, track = {}) => (
  item.durationMs ?? track.durationMs ?? track.rawSource?.duration_ms ?? 0
);

export const createOptimisticRecentItem = (source, playedAt = new Date().toISOString()) => {
  const trackSource = readTrackSource(source);
  const providerTrackId = getPlaybackItemTrackId(source);
  if (!trackSource || !providerTrackId) return null;

  const normalizedTrack = normalizeTrack({
    provider: trackSource.provider || source?.provider || MUSIC_PROVIDERS.spotify,
    providerTrackId,
    uri: trackSource.uri || source?.uri || `${SPOTIFY_TRACK_URI_PREFIX}${providerTrackId}`,
    isrc: trackSource.isrc || source?.isrc || '',
    name: trackSource.name || source?.name || '',
    artists: trackSource.artistNames || trackSource.artists || source?.artistNames || source?.artists || [],
    album: trackSource.album || source?.album || null,
    albumName: trackSource.albumName || source?.albumName || '',
    releaseDate: trackSource.releaseDate || source?.releaseDate || '',
    durationMs: readDurationMs(source, trackSource),
    popularity: trackSource.popularity || source?.popularity || '',
    explicit: trackSource.explicit ?? source?.explicit ?? null,
    rawSource: trackSource.rawSource || source?.rawSource || null,
  }, { provider: MUSIC_PROVIDERS.spotify });
  if (!normalizedTrack.name) return null;

  return {
    id: providerTrackId,
    uri: normalizedTrack.uri,
    type: 'track',
    track: normalizedTrack,
    albumCover: readAlbumCover(source, trackSource),
    durationMs: readDurationMs(source, trackSource),
    externalUrl: readExternalUrl(source, trackSource),
    playedAt,
    isOptimistic: true,
  };
};

const getPlayedAtMs = (item = {}) => {
  const playedAtMs = Date.parse(item.playedAt || '');
  return Number.isNaN(playedAtMs) ? 0 : playedAtMs;
};

const isFreshOptimisticItem = (item, nowMs) => {
  const playedAtMs = getPlayedAtMs(item);
  return playedAtMs > 0 && nowMs - playedAtMs <= RECENTLY_PLAYED_OPTIMISTIC_TTL_MS;
};

const hasSettledApiMatch = (optimisticItem, apiItems) => {
  const optimisticTrackId = getPlaybackItemTrackId(optimisticItem);
  const optimisticPlayedAtMs = getPlayedAtMs(optimisticItem);
  if (!optimisticTrackId || optimisticPlayedAtMs <= 0) return false;

  return apiItems.some(item => {
    if (getPlaybackItemTrackId(item) !== optimisticTrackId) return false;
    const apiPlayedAtMs = getPlayedAtMs(item);
    return apiPlayedAtMs > 0 &&
      apiPlayedAtMs >= optimisticPlayedAtMs - RECENTLY_PLAYED_API_SETTLE_WINDOW_MS;
  });
};

export const mergeRecentlyPlayedItems = (
  apiItems = [],
  optimisticItems = [],
  nowMs = Date.now()
) => {
  const safeApiItems = Array.isArray(apiItems) ? apiItems.filter(Boolean) : [];
  const safeOptimisticItems = Array.isArray(optimisticItems) ? optimisticItems.filter(Boolean) : [];
  const optimisticFallbackItems = safeOptimisticItems
    .filter(item => isFreshOptimisticItem(item, nowMs))
    .filter(item => !hasSettledApiMatch(item, safeApiItems));

  return [...optimisticFallbackItems, ...safeApiItems];
};
