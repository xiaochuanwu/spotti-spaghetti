import {
  cleanSearchQueryWithoutParentheses,
  createMatchedSourceTrack,
  getCandidateArtistNames,
  getCandidateDurationMs,
  getSearchQueryVariants,
  getTargetArtistNames,
  MATCH_SCORE_THRESHOLD,
  normalizeText,
  normalizeTitle,
  rankNeteaseMatches,
  selectBestNeteaseMatch,
  stripFeatureHints,
} from './textMatching.js';
import { parseNeteaseLyricResponse } from './lyricParsing.js';

const DEFAULT_API_BASE = '/netease-api';
const SEARCH_LIMIT = 8;
const LYRICS_DEBUG_STORAGE_KEY = 'spotti:lyrics-debug';
const CACHE_LIMIT = 50;
const STRONG_MATCH_SCORE_THRESHOLD = 118;

export { parseNeteaseLyricResponse, selectBestNeteaseMatch };

const isLyricsDebugEnabled = () => {
  if (import.meta.env?.DEV) return true;
  if (typeof localStorage === 'undefined') return false;

  try {
    return localStorage.getItem(LYRICS_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const logLyricsDebug = (...args) => {
  if (isLyricsDebugEnabled()) {
    console.debug(...args);
  }
};

const createLruCache = (limit = CACHE_LIMIT) => {
  const cache = new Map();

  return {
    get(key) {
      if (!cache.has(key)) return undefined;
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    },
    set(key, value) {
      if (!key) return;
      if (cache.has(key)) {
        cache.delete(key);
      }
      cache.set(key, value);
      while (cache.size > limit) {
        cache.delete(cache.keys().next().value);
      }
    },
  };
};

const dedupeSongsById = (songs = []) => {
  const songsById = new Map();
  songs.forEach((song) => {
    if (!song) return;
    const id = song?.id ?? `${song?.name || ''}:${getCandidateArtistNames(song).join(',')}:${getCandidateDurationMs(song)}`;
    if (!songsById.has(id)) {
      songsById.set(id, song);
    }
  });
  return [...songsById.values()];
};

const getTrackCacheKey = (track = {}) => {
  if (track.isrc) return `isrc:${String(track.isrc).trim().toLowerCase()}`;
  if (track.providerTrackId) return `provider:${String(track.providerTrackId).trim()}`;
  if (track.uri) return `uri:${String(track.uri).trim()}`;

  return [
    normalizeTitle(track.name),
    getTargetArtistNames(track).map(normalizeText).join(','),
    normalizeTitle(track.albumName),
    track.durationMs || '',
  ].join('|');
};

const getSearchQueryStages = (track = {}) => {
  const targetArtists = getTargetArtistNames(track);
  const primaryArtist = targetArtists[0] || '';
  const allArtists = targetArtists.join(' ');
  const cleanTitle = cleanSearchQueryWithoutParentheses(stripFeatureHints(track.name));

  const rawStages = [
    [{ query: track.isrc, preserve: true }],
    [
      { query: [track.name, allArtists, track.albumName].filter(Boolean).join(' ') },
      { query: [stripFeatureHints(track.name), allArtists, track.albumName].filter(Boolean).join(' ') },
    ],
    [
      { query: [track.name, primaryArtist].filter(Boolean).join(' ') },
      { query: [cleanTitle, primaryArtist].filter(Boolean).join(' ') },
      { query: cleanTitle },
    ],
  ];

  const seenQueries = new Set();

  return rawStages
    .map((stage) => stage.flatMap(({ query, preserve }) => (
      getSearchQueryVariants(query, { preserve })
    )))
    .map((queries) => queries.filter((query) => {
      if (seenQueries.has(query)) return false;
      seenQueries.add(query);
      return true;
    }))
    .filter((queries) => queries.length);
};

const logRankedMatch = (label, rankedMatch) => {
  if (!rankedMatch) return;
  logLyricsDebug(`[Lyrics Matching] ${label}: "${rankedMatch.song?.name}" | Score: ${rankedMatch.score}`, {
    reasons: rankedMatch.reasons,
    sourceTrack: rankedMatch.song,
  });
};

export const createNeteaseLyricsClient = ({
  apiBase = DEFAULT_API_BASE,
  cacheLimit = CACHE_LIMIT,
  fetchImpl = fetch,
} = {}) => {
  const lyricsCache = createLruCache(cacheLimit);
  const searchCache = createLruCache(cacheLimit);
  const trackLyricsCache = createLruCache(cacheLimit);

  const requestJson = async (path, params, options = {}) => {
    const query = new URLSearchParams(params);
    const response = await fetchImpl(`${apiBase}${path}?${query.toString()}`, {
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`NETEASE_LYRICS_REQUEST_FAILED:${response.status}`);
    }

    return response.json();
  };

  const searchTrack = async (track, options = {}) => {
    const cacheKey = getTrackCacheKey(track);
    const cachedSourceTrack = searchCache.get(cacheKey);
    if (cachedSourceTrack) return cachedSourceTrack;

    const songs = [];
    logLyricsDebug(`[Lyrics Matching] Target Track: "${track.name}" by [${getTargetArtistNames(track).join(', ')}] | Album: "${track.albumName}" | Duration: ${track.durationMs}ms`);

    for (const queries of getSearchQueryStages(track)) {
      for (const query of queries) {
        try {
          const data = await requestJson('/search/get', {
            s: query,
            type: '1',
            limit: String(SEARCH_LIMIT),
            offset: '0',
          }, options);
          logLyricsDebug(`[Lyrics Matching] Query: "${query}" | Response Data:`, data);
          songs.push(...(data?.result?.songs || []));
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          logLyricsDebug(`[Lyrics Matching] Query failed: "${query}"`, error);
        }
      }

      const best = rankNeteaseMatches(dedupeSongsById(songs), track)[0];
      if (best?.score >= STRONG_MATCH_SCORE_THRESHOLD) {
        const sourceTrack = createMatchedSourceTrack(best);
        logRankedMatch('Strong match found', best);
        if (!options.signal?.aborted) {
          searchCache.set(cacheKey, sourceTrack);
        }
        return sourceTrack;
      }
    }

    const rankedBest = rankNeteaseMatches(dedupeSongsById(songs), track)[0];
    logRankedMatch('Best candidate', rankedBest);

    const match = rankedBest?.score >= MATCH_SCORE_THRESHOLD
      ? createMatchedSourceTrack(rankedBest)
      : null;
    if (match && !options.signal?.aborted) {
      searchCache.set(cacheKey, match);
    }
    return match;
  };

  const getLyricsBySongId = async (songId, options = {}) => {
    const cacheKey = String(songId);
    const cachedLines = lyricsCache.get(cacheKey);
    if (cachedLines) return cachedLines;

    const data = await requestJson('/song/lyric', {
      id: String(songId),
      lv: '1',
      kv: '1',
      tv: '-1',
    }, options);

    const lines = parseNeteaseLyricResponse(data);
    if (!options.signal?.aborted) {
      lyricsCache.set(cacheKey, lines);
    }
    return lines;
  };

  const getLyricsForTrack = async (track, options = {}) => {
    const cacheKey = getTrackCacheKey(track);
    const cachedResult = trackLyricsCache.get(cacheKey);
    if (cachedResult) return cachedResult;

    const sourceTrack = await searchTrack(track, options);
    if (!sourceTrack) {
      return { lines: [], sourceTrack: null };
    }

    const result = {
      lines: await getLyricsBySongId(sourceTrack.id, options),
      sourceTrack,
    };

    if (!options.signal?.aborted) {
      trackLyricsCache.set(cacheKey, result);
    }

    return result;
  };

  return {
    getLyricsForTrack,
    getLyricsBySongId,
    searchTrack,
  };
};

export const neteaseLyrics = createNeteaseLyricsClient();
