import { MUSIC_PROVIDERS } from './musicModel.js';

export const mapPlaylistTrackItem = (item, playlist = null) => {
  if (!item?.track) return null;

  const track = item.track;
  const album = track.album || {};

  return {
    provider: MUSIC_PROVIDERS.spotify,
    providerTrackId: track.id || '',
    providerPlaylistId: playlist?.id || '',
    artists: track.artists?.map(artist => artist?.id).filter(Boolean) || [],
    artistNames: track.artists?.map(artist => artist?.name).filter(Boolean) || [],
    albumId: album.id || '',
    albumName: album.name || '',
    uri: track.uri || '',
    isrc: track.external_ids?.isrc || '',
    name: track.name || '',
    releaseDate: album.release_date || '',
    durationMs: track.duration_ms ?? '',
    popularity: track.popularity ?? '',
    explicit: Boolean(track.explicit),
    addedById: item.added_by?.id || '',
    addedAt: item.added_at || ''
  };
};

export const getUniqueMetadataIds = (tracks) => ({
  artistIds: Array.from(new Set(tracks.flatMap(track => track.artists).filter(Boolean))),
  albumIds: Array.from(new Set(tracks.map(track => track.albumId).filter(Boolean))),
});

export const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export const mapArtistGenres = (artists = []) => {
  const genres = {};

  artists.forEach((artist) => {
    if (artist?.id) {
      genres[artist.id] = artist.genres?.join(',') || '';
    }
  });

  return genres;
};

export const mapAlbumLabels = (albums = []) => {
  const labels = {};

  albums.forEach((album) => {
    if (album?.id) {
      labels[album.id] = album.label || '';
    }
  });

  return labels;
};

export const enrichTracksWithMetadata = (tracks, artistGenres, albumLabels) => (
  tracks.map((track) => {
    const genresSet = new Set();

    track.artists.forEach((id) => {
      const genresStr = artistGenres[id];
      if (genresStr) {
        genresStr.split(',').forEach((genre) => {
          if (genre) genresSet.add(genre);
        });
      }
    });

    return {
      modelVersion: 1,
      provider: track.provider,
      providerTrackId: track.providerTrackId,
      providerPlaylistId: track.providerPlaylistId || '',
      uri: track.uri,
      isrc: track.isrc || '',
      name: track.name,
      artists: track.artistNames,
      albumName: track.albumName,
      album: { providerAlbumId: track.albumId, name: track.albumName },
      artistNames: track.artistNames.join(','),
      releaseDate: track.releaseDate,
      durationMs: track.durationMs,
      popularity: track.popularity,
      explicit: track.explicit ? 'Yes' : 'No',
      explicitLabel: track.explicit ? 'Yes' : 'No',
      addedBy: track.addedById,
      addedAt: track.addedAt,
      genres: Array.from(genresSet),
      genreNames: Array.from(genresSet).join(','),
      recordLabel: albumLabels[track.albumId] || '',
      rawSource: null,
    };
  })
);

export const mapPreviewTrackItem = (item) => {
  const track = item?.track || item?.item || (
    item &&
    !Object.prototype.hasOwnProperty.call(item, 'track') &&
    !Object.prototype.hasOwnProperty.call(item, 'item')
      ? item
      : null
  );
  if (!track || (track.type && track.type !== 'track')) return null;

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: track.artists?.map(artist => artist.name).join(', ') || '',
    albumName: track.album?.name || '',
    albumCover: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || '',
    durationMs: track.duration_ms,
    externalUrl: track.external_urls?.spotify
  };
};
