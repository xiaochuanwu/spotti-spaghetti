const DEFAULT_API_BASE = '/netease-api';
const SEARCH_LIMIT = 8;
const DURATION_TOLERANCE_MS = 8000;
const FEATURE_HINT_PATTERN = /\s+(feat\.?|featuring|ft\.?)\s+.+$/i;

const cleanSearchQuery = (query = '') => {
  return query
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanSearchQueryWithoutParentheses = (query = '') => {
  return query
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractVersionTags = (name = '') => {
  const normalized = name.toLowerCase();
  const tags = new Set();

  if (normalized.includes('live')) tags.add('live');
  if (normalized.includes('acoustic')) tags.add('acoustic');
  if (normalized.includes('remix') || normalized.includes('remixed')) tags.add('remix');
  if (normalized.includes('cover')) tags.add('cover');
  if (normalized.includes('instrumental')) tags.add('instrumental');
  if (normalized.includes('demo')) tags.add('demo');

  const partMatch = normalized.match(/(?:part|pt|vol|volume)\.?\s*(\d+|[ivxldm]+)/i);
  if (partMatch) {
    tags.add(`part-${partMatch[1]}`);
  }

  return tags;
};

const checkVersionMismatch = (targetName, candidateName) => {
  const targetTags = extractVersionTags(targetName);
  const candidateTags = extractVersionTags(candidateName);

  for (const tag of targetTags) {
    if (!candidateTags.has(tag)) return true;
  }
  for (const tag of candidateTags) {
    if (!targetTags.has(tag)) return true;
  }
  return false;
};

const normalizeText = (value = '') => (
  String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
);

const normalizeTitle = (value = '') => normalizeText(
  String(value).replace(FEATURE_HINT_PATTERN, '')
);

const tokenSetFor = (value = '') => new Set(normalizeText(value).split(' ').filter(Boolean));

const uniqueValues = (values = []) => (
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
);

const tokenOverlapScore = (left = '', right = '') => {
  const leftTokens = tokenSetFor(left);
  const rightTokens = tokenSetFor(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
};

const parseTimestampMs = (minutes, seconds) => (
  Math.round((Number(minutes) * 60 + Number(seconds)) * 1000)
);

const parseLrc = (lrcText = '') => {
  const lines = [];
  const timestampPattern = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

  lrcText.split(/\r?\n/).forEach((rawLine) => {
    const matches = [...rawLine.matchAll(timestampPattern)];
    if (!matches.length) return;

    const text = rawLine.replace(timestampPattern, '').trim();
    matches.forEach((match) => {
      lines.push({
        timeMs: parseTimestampMs(match[1], match[2]),
        text,
      });
    });
  });

  return lines
    .filter((line) => line.text)
    .sort((a, b) => a.timeMs - b.timeMs);
};

const mergeTranslatedLines = (lyricLines, translatedLines) => {
  if (!translatedLines.length) return lyricLines;

  return lyricLines.map((line) => {
    const translatedLine = translatedLines.find((candidate) => (
      Math.abs(candidate.timeMs - line.timeMs) <= 500
    ));

    return {
      ...line,
      translation: translatedLine?.text || '',
    };
  });
};

const durationScoreFor = (candidateDurationMs, targetDurationMs) => {
  if (!targetDurationMs || !candidateDurationMs) return 0;

  const delta = Math.abs(candidateDurationMs - targetDurationMs);
  if (delta <= 3000) return 30;
  if (delta <= DURATION_TOLERANCE_MS) return 18;
  if (delta <= 15000) return 8;
  return -20;
};

const getTargetArtistNames = (track = {}) => {
  if (Array.isArray(track.artists) && track.artists.length) {
    return track.artists;
  }

  return String(track.artistNames || '')
    .split(',')
    .map((artist) => artist.trim())
    .filter(Boolean);
};

const getCandidateArtistNames = (candidate = {}) => (
  (candidate.artists || [])
    .map((artist) => artist?.name)
    .filter(Boolean)
);

const artistNamesMatch = (targetArtist, candidateArtist) => {
  if (!targetArtist || !candidateArtist) return false;
  return candidateArtist === targetArtist
    || candidateArtist.includes(targetArtist)
    || targetArtist.includes(candidateArtist)
    || tokenOverlapScore(candidateArtist, targetArtist) >= 0.55;
};

const artistScoreFor = (candidate, track) => {
  const targetArtists = getTargetArtistNames(track).map(normalizeText).filter(Boolean);
  const candidateArtists = getCandidateArtistNames(candidate).map(normalizeText).filter(Boolean);
  if (!targetArtists.length || !candidateArtists.length) return 0;

  const matchedTargets = targetArtists.filter((targetArtist) => (
    candidateArtists.some((candidateArtist) => artistNamesMatch(targetArtist, candidateArtist))
  ));

  if (!matchedTargets.length) return -48;

  let score = 0;
  const primaryArtist = targetArtists[0];
  if (candidateArtists.some((candidateArtist) => artistNamesMatch(primaryArtist, candidateArtist))) {
    score += 32;
  }

  score += Math.min(24, matchedTargets.length * 12);
  score += Math.round(tokenOverlapScore(candidateArtists.join(' '), targetArtists.join(' ')) * 12);
  return score;
};

const scoreCandidate = (candidate, track) => {
  const targetName = normalizeTitle(track.name);
  const candidateName = normalizeTitle(candidate.name);
  const targetAlbum = normalizeTitle(track.albumName);
  const candidateAlbum = normalizeTitle(candidate.album?.name);

  let score = 0;
  let titleMatchDetail = '';
  if (candidateName === targetName) {
    score += 45;
    titleMatchDetail = 'Exact Match (+45)';
  } else if (candidateName.includes(targetName) || targetName.includes(candidateName)) {
    score += 25;
    titleMatchDetail = 'Partial Match (+25)';
  } else {
    const overlap = Math.round(tokenOverlapScore(candidate.name, track.name) * 20);
    score += overlap;
    titleMatchDetail = `Token Overlap (+${overlap})`;
  }

  const artistScore = artistScoreFor(candidate, track);
  score += artistScore;

  let albumScore = 0;
  if (targetAlbum && candidateAlbum) {
    if (targetAlbum === candidateAlbum) albumScore = 14;
    else albumScore = Math.round(tokenOverlapScore(candidate.album?.name, track.albumName) * 10);
  }
  score += albumScore;

  const durationScore = durationScoreFor(candidate.duration, track.durationMs);
  score += durationScore;
  if (candidate.status !== 0) score -= 6;

  const isMismatch = checkVersionMismatch(track.name, candidate.name);
  if (isMismatch) {
    score -= 90;
  }

  console.log(`[Score Details] Candidate: "${candidate.name}" by ${getCandidateArtistNames(candidate).join(',')} | Album: "${candidate.album?.name}" | Duration: ${candidate.duration}ms
  - Title: ${titleMatchDetail}
  - Artist Score: ${artistScore}
  - Album Score: ${albumScore}
  - Duration Score: ${durationScore}
  - Version Mismatch Penalty: ${isMismatch ? -90 : 0}
  - Status Penalty: ${candidate.status !== 0 ? -6 : 0}
  - Total Score: ${score}`);

  return score;
};

export const selectBestNeteaseMatch = (songs = [], track = {}) => {
  console.log(`[Lyrics Matching] Target Track: "${track.name}" by [${getTargetArtistNames(track).join(', ')}] | Album: "${track.albumName}" | Duration: ${track.durationMs}ms`);
  if (!songs.length) {
    console.log('[Lyrics Matching] No songs returned from NetEase.');
    return null;
  }

  const rankedSongs = songs
    .map((song) => ({ song, score: scoreCandidate(song, track) }))
    .sort((a, b) => b.score - a.score);

  const best = rankedSongs[0];
  console.log(`[Lyrics Matching] Best Candidate: "${best.song.name}" | Score: ${best.score} (Threshold: 55)`);
  return best?.score >= 55 ? best.song : null;
};

export const parseNeteaseLyricResponse = (response = {}) => {
  const lyricLines = parseLrc(response?.lrc?.lyric || '');
  const translatedLines = parseLrc(response?.tlyric?.lyric || '');

  return mergeTranslatedLines(lyricLines, translatedLines);
};

export const createNeteaseLyricsClient = ({ apiBase = DEFAULT_API_BASE, fetchImpl = fetch } = {}) => {
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
    const targetArtists = getTargetArtistNames(track);
    const primaryArtist = targetArtists[0] || '';
    const allArtists = targetArtists.join(' ');

    const rawQueries = [
      track.isrc,
      [track.name, allArtists, track.albumName].filter(Boolean).join(' '),
      [track.name, primaryArtist].filter(Boolean).join(' '),
      [cleanSearchQueryWithoutParentheses(track.name), primaryArtist].filter(Boolean).join(' '),
    ];

    const queries = uniqueValues(
      rawQueries.map(q => {
        if (!q) return '';
        return q === track.isrc ? q : cleanSearchQuery(q);
      })
    );

    for (const query of queries) {
      const data = await requestJson('/search/get/web', {
        s: query,
        type: '1',
        limit: String(SEARCH_LIMIT),
        offset: '0',
      }, options);
      const match = selectBestNeteaseMatch(data?.result?.songs || [], track);
      if (match) return match;
    }

    return null;
  };

  const getLyricsBySongId = async (songId, options = {}) => {
    const data = await requestJson('/song/lyric', {
      id: String(songId),
      lv: '1',
      kv: '1',
      tv: '-1',
    }, options);

    return parseNeteaseLyricResponse(data);
  };

  const getLyricsForTrack = async (track, options = {}) => {
    const sourceTrack = await searchTrack(track, options);
    if (!sourceTrack) {
      return { lines: [], sourceTrack: null };
    }

    return {
      lines: await getLyricsBySongId(sourceTrack.id, options),
      sourceTrack,
    };
  };

  return {
    getLyricsForTrack,
    getLyricsBySongId,
    searchTrack,
  };
};

export const neteaseLyrics = createNeteaseLyricsClient();
