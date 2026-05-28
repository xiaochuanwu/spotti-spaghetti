import { useEffect, useMemo, useState } from 'react';

const serializeArtists = (artists) => (Array.isArray(artists) ? JSON.stringify(artists) : '[]');

const loadNeteaseLyricsClient = () => import('../services/neteaseLyrics.js')
  .then(({ neteaseLyrics }) => neteaseLyrics);

const parseArtists = (value) => {
  try {
    const artists = JSON.parse(value);
    return Array.isArray(artists) ? artists.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const getTrackKey = (track) => [
  track?.providerTrackId || track?.uri || '',
  track?.name || '',
  track?.artistNames || '',
  serializeArtists(track?.artists),
  track?.albumName || '',
  track?.durationMs || '',
  track?.isrc || '',
].join('|');

export const useLyrics = ({ isAvailable, track }) => {
  const [lyricsState, setLyricsState] = useState({
    error: '',
    isLoading: false,
    lines: [],
    sourceTrack: null,
  });
  const trackKey = useMemo(() => getTrackKey(track), [track]);
  const artistsKey = serializeArtists(track?.artists);
  const albumName = track?.albumName || '';
  const artistNames = track?.artistNames || '';
  const durationMs = track?.durationMs || '';
  const isrc = track?.isrc || '';
  const name = track?.name || '';
  const providerTrackId = track?.providerTrackId || '';
  const uri = track?.uri || '';
  const trackForLyrics = useMemo(() => {
    if (!trackKey || !name) return null;

    return {
      providerTrackId,
      uri,
      name,
      artistNames,
      artists: parseArtists(artistsKey),
      albumName,
      durationMs,
      isrc,
    };
  }, [
    albumName,
    artistNames,
    durationMs,
    isrc,
    name,
    providerTrackId,
    uri,
    artistsKey,
    trackKey,
  ]);

  useEffect(() => {
    if (!isAvailable || !trackForLyrics?.name) {
      const resetId = window.setTimeout(() => {
        setLyricsState({
          error: '',
          isLoading: false,
          lines: [],
          sourceTrack: null,
        });
      }, 0);

      return () => {
        window.clearTimeout(resetId);
      };
    }

    const loadingId = window.setTimeout(() => {
      setLyricsState({
        error: '',
        lines: [],
        isLoading: true,
        sourceTrack: null,
      });
    }, 0);

    const abortController = new AbortController();

    loadNeteaseLyricsClient()
      .then((lyricsClient) => {
        if (abortController.signal.aborted) return null;
        return lyricsClient.getLyricsForTrack(trackForLyrics, { signal: abortController.signal });
      })
      .then((result) => {
        if (!result || abortController.signal.aborted) return;
        window.clearTimeout(loadingId);
        setLyricsState({
          error: '',
          isLoading: false,
          lines: result.lines,
          sourceTrack: result.sourceTrack,
        });
      })
      .catch((error) => {
        window.clearTimeout(loadingId);
        if (abortController.signal.aborted) return;
        console.error('Failed to load lyrics:', error);
        setLyricsState({
          error: 'lyrics.error',
          isLoading: false,
          lines: [],
          sourceTrack: null,
        });
      });

    return () => {
      window.clearTimeout(loadingId);
      abortController.abort();
    };
  }, [isAvailable, trackForLyrics]);

  return lyricsState;
};
