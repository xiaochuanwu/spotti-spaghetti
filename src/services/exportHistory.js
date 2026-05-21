import { database, DB_STORES } from './database.js';
import {
  getPlaylistIdentity,
  getTrackIdentity,
  MUSIC_MODEL_VERSION,
  MUSIC_PROVIDERS,
  normalizePlaylist,
  normalizeTrack,
} from './musicModel.js';

const MAX_HISTORY_ITEMS = 30;

const sortNewestFirst = (history) => (
  [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
);

const readHistory = async () => {
  const history = await database.getAll(DB_STORES.exportHistory);
  return sortNewestFirst(history.map(normalizeHistorySnapshot));
};

const trimHistory = async () => {
  const history = await readHistory();
  const staleItems = history.slice(MAX_HISTORY_ITEMS);

  await Promise.all(staleItems.map(item => (
    database.delete(DB_STORES.exportHistory, item.id)
  )));
};

const compactTrack = (track, defaults = {}) => {
  const normalizedTrack = normalizeTrack(track, defaults);

  return {
    modelVersion: MUSIC_MODEL_VERSION,
    provider: normalizedTrack.provider,
    providerTrackId: normalizedTrack.providerTrackId,
    providerPlaylistId: normalizedTrack.providerPlaylistId,
    uri: normalizedTrack.uri,
    isrc: normalizedTrack.isrc,
    name: normalizedTrack.name,
    artists: normalizedTrack.artists,
    artistNames: normalizedTrack.artistNames,
    album: normalizedTrack.album,
    albumName: normalizedTrack.albumName,
    releaseDate: normalizedTrack.releaseDate,
    durationMs: normalizedTrack.durationMs,
    popularity: normalizedTrack.popularity,
    explicit: normalizedTrack.explicit,
    explicitLabel: normalizedTrack.explicitLabel,
    genres: normalizedTrack.genres,
    genreNames: normalizedTrack.genreNames,
    recordLabel: normalizedTrack.recordLabel,
    addedAt: normalizedTrack.addedAt,
    addedBy: normalizedTrack.addedBy,
    rawSource: normalizedTrack.rawSource,
  };
};

export const getTrackUrisFromSnapshot = (snapshot) => (
  normalizeHistorySnapshot(snapshot).tracks
    .map(track => track.uri)
    .filter(uri => uri?.startsWith('spotify:track:'))
);

export const normalizeHistorySnapshot = (snapshot, index = 0) => {
  const playlistName = snapshot?.playlistName || snapshot?.name || 'Imported playlist';
  const provider = snapshot?.provider || MUSIC_PROVIDERS.spotify;
  const providerPlaylistId = snapshot?.providerPlaylistId || snapshot?.playlistId || '';
  const normalizedPlaylist = normalizePlaylist({
    provider,
    providerPlaylistId,
    id: providerPlaylistId,
    name: playlistName,
    trackCount: snapshot?.trackCount,
  });
  const playlistId = snapshot?.playlistId || normalizedPlaylist.providerPlaylistId || playlistName;
  const tracks = Array.isArray(snapshot?.tracks)
    ? snapshot.tracks
      .filter(Boolean)
      .map(track => compactTrack(track, {
        provider: normalizedPlaylist.provider,
        providerPlaylistId: normalizedPlaylist.providerPlaylistId,
      }))
      .filter(track => getTrackIdentity(track))
    : [];

  return {
    modelVersion: snapshot?.modelVersion || MUSIC_MODEL_VERSION,
    id: snapshot?.id || `${playlistId}-${snapshot?.createdAt || Date.now()}-${index}`,
    provider: normalizedPlaylist.provider,
    providerPlaylistId: normalizedPlaylist.providerPlaylistId,
    playlistKey: snapshot?.playlistKey || getPlaylistIdentity(normalizedPlaylist),
    playlistId,
    playlistName,
    createdAt: snapshot?.createdAt || new Date().toISOString(),
    trackCount: Number.isFinite(snapshot?.trackCount) ? snapshot.trackCount : tracks.length,
    tracks,
  };
};

export const exportHistory = {
  async all() {
    return readHistory();
  },

  async addSnapshot(playlist, tracks) {
    const normalizedPlaylist = normalizePlaylist(playlist, { provider: MUSIC_PROVIDERS.spotify });
    const playlistKey = getPlaylistIdentity(normalizedPlaylist);
    const snapshot = {
      modelVersion: MUSIC_MODEL_VERSION,
      id: `${playlistKey}-${Date.now()}`,
      provider: normalizedPlaylist.provider,
      providerPlaylistId: normalizedPlaylist.providerPlaylistId,
      playlistKey,
      playlistId: normalizedPlaylist.providerPlaylistId || normalizedPlaylist.name,
      playlistName: normalizedPlaylist.name,
      createdAt: new Date().toISOString(),
      trackCount: tracks.length,
      tracks: tracks.map(track => compactTrack(track, {
        provider: normalizedPlaylist.provider,
        providerPlaylistId: normalizedPlaylist.providerPlaylistId,
      })),
    };

    await database.put(DB_STORES.exportHistory, snapshot);
    await trimHistory();
    return snapshot;
  },

  async latestForPlaylist(playlistRef) {
    const history = await readHistory();
    const normalizedPlaylist = typeof playlistRef === 'object'
      ? normalizePlaylist(playlistRef, { provider: MUSIC_PROVIDERS.spotify })
      : null;
    const playlistIds = new Set([
      typeof playlistRef === 'string' ? playlistRef : '',
      normalizedPlaylist?.providerPlaylistId || '',
      normalizedPlaylist ? getPlaylistIdentity(normalizedPlaylist) : '',
    ].filter(Boolean));

    return history.find(item => (
      playlistIds.has(item.playlistKey)
      || playlistIds.has(item.providerPlaylistId)
      || playlistIds.has(item.playlistId)
    )) || null;
  },

  compare(snapshot, previousSnapshot) {
    if (!snapshot || !previousSnapshot) {
      return { added: [], removed: [], unchangedCount: 0 };
    }

    const normalizedSnapshot = normalizeHistorySnapshot(snapshot);
    const normalizedPreviousSnapshot = normalizeHistorySnapshot(previousSnapshot);
    const previousByKey = new Map(normalizedPreviousSnapshot.tracks.map(track => [getTrackIdentity(track), track]));
    const currentByKey = new Map(normalizedSnapshot.tracks.map(track => [getTrackIdentity(track), track]));

    const added = normalizedSnapshot.tracks.filter(track => !previousByKey.has(getTrackIdentity(track)));
    const removed = normalizedPreviousSnapshot.tracks.filter(track => !currentByKey.has(getTrackIdentity(track)));
    const unchanged = normalizedSnapshot.tracks.filter(track => previousByKey.has(getTrackIdentity(track)));
    const unchangedCount = unchanged.length;

    return { added, removed, unchanged, unchangedCount };
  },

  async deleteSnapshot(id) {
    await database.delete(DB_STORES.exportHistory, id);
  },

  async importSnapshots(input) {
    const snapshots = Array.isArray(input) ? input : input?.history || input?.snapshots || [];
    const normalizedSnapshots = snapshots
      .map(normalizeHistorySnapshot)
      .filter(snapshot => snapshot.tracks.length > 0);

    await Promise.all(normalizedSnapshots.map(snapshot => (
      database.put(DB_STORES.exportHistory, snapshot)
    )));
    await trimHistory();

    return normalizedSnapshots.length;
  },

  async clear() {
    await database.clear(DB_STORES.exportHistory);
  },
};
