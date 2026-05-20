import { database, DB_STORES } from './database.js';

const MAX_HISTORY_ITEMS = 30;

const sortNewestFirst = (history) => (
  [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
);

const readHistory = async () => {
  const history = await database.getAll(DB_STORES.exportHistory);
  return sortNewestFirst(history);
};

const trimHistory = async () => {
  const history = await readHistory();
  const staleItems = history.slice(MAX_HISTORY_ITEMS);

  await Promise.all(staleItems.map(item => (
    database.delete(DB_STORES.exportHistory, item.id)
  )));
};

const compactTrack = (track) => ({
  uri: track.uri,
  name: track.name,
  albumName: track.albumName,
  artistNames: track.artistNames,
  releaseDate: track.releaseDate,
  durationMs: track.durationMs,
  popularity: track.popularity,
  explicit: track.explicit,
  genres: track.genres,
  recordLabel: track.recordLabel,
});

export const exportHistory = {
  async all() {
    return readHistory();
  },

  async addSnapshot(playlist, tracks) {
    const snapshot = {
      id: `${playlist.id || playlist.name}-${Date.now()}`,
      playlistId: playlist.id || playlist.name,
      playlistName: playlist.name,
      createdAt: new Date().toISOString(),
      trackCount: tracks.length,
      tracks: tracks.map(compactTrack),
    };

    await database.put(DB_STORES.exportHistory, snapshot);
    await trimHistory();
    return snapshot;
  },

  async latestForPlaylist(playlistId) {
    const history = await readHistory();
    return history.find(item => item.playlistId === playlistId) || null;
  },

  compare(snapshot, previousSnapshot) {
    if (!snapshot || !previousSnapshot) {
      return { added: [], removed: [], unchangedCount: 0 };
    }

    const previousByUri = new Map(previousSnapshot.tracks.map(track => [track.uri, track]));
    const currentByUri = new Map(snapshot.tracks.map(track => [track.uri, track]));

    const added = snapshot.tracks.filter(track => !previousByUri.has(track.uri));
    const removed = previousSnapshot.tracks.filter(track => !currentByUri.has(track.uri));
    const unchangedCount = snapshot.tracks.length - added.length;

    return { added, removed, unchangedCount };
  },

  async clear() {
    await database.clear(DB_STORES.exportHistory);
  },
};
