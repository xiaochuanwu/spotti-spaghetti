import { Converter } from 'opencc-js/t2cn';

const DURATION_TOLERANCE_MS = 8000;
const FEATURE_HINT_PATTERN = /\s+(feat\.?|featuring|ft\.?)\s+.+$/i;
export const MATCH_SCORE_THRESHOLD = 55;
const CJK_CHARACTER_PATTERN = /\p{Script=Han}/u;
export const BRACKET_CONTENT_PATTERN = /\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】/g;

const convertHongKongTraditionalToSimplified = Converter({ from: 'hk', to: 'cn' });
const convertTaiwanTraditionalToSimplified = Converter({ from: 'tw', to: 'cn' });

export const normalizeChineseScriptVariants = (value = '') => {
  const text = String(value);
  return convertTaiwanTraditionalToSimplified(
    convertHongKongTraditionalToSimplified(text)
  )
    .replaceAll('藉', '借')
    .replaceAll('咀', '嘴')
    .replaceAll('昇', '升')
    .replaceAll('髒', '脏');
};

export const normalizeEquivalentPunctuation = (value = '') => String(value)
  .replace(/[’‘]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[，、]/g, ',')
  .replace(/[：]/g, ':')
  .replace(/[！]/g, '!')
  .replace(/[？]/g, '?')
  .replace(/[（【]/g, '(')
  .replace(/[）】]/g, ')')
  .replace(/[\u2010-\u2015]/g, '-');

export const cleanSearchQuery = (query = '') => {
  return query
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const uniqueValues = (values = []) => (
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
);

export const getSearchQueryVariants = (query = '', { preserve = false } = {}) => {
  const cleaned = preserve ? String(query || '').trim() : cleanSearchQuery(query);
  if (!cleaned) return [];

  return uniqueValues([
    normalizeChineseScriptVariants(cleaned),
    cleaned,
  ]);
};

export const cleanSearchQueryWithoutParentheses = (query = '') => {
  return query
    .replace(BRACKET_CONTENT_PATTERN, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const stripFeatureHints = (value = '') => String(value)
  .replace(/\s*[-–—]\s*(feat\.?|featuring|ft\.?|with)\s+.+$/i, '')
  .replace(/\s*\((feat\.?|featuring|ft\.?|with)\s+[^)]*\)/gi, '')
  .replace(/\s*\[(feat\.?|featuring|ft\.?|with)\s+[^\]]*\]/gi, '')
  .replace(FEATURE_HINT_PATTERN, '')
  .trim();

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

export const normalizeText = (value = '') => (
  normalizeChineseScriptVariants(
    normalizeEquivalentPunctuation(value)
      .normalize('NFKD')
      .toLowerCase()
      .replace(BRACKET_CONTENT_PATTERN, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
);

export const normalizeTitle = (value = '') => normalizeText(
  stripFeatureHints(value)
);

const tokenSetFor = (value = '') => new Set(normalizeText(value).split(' ').filter(Boolean));

const tokenOverlapScore = (left = '', right = '') => {
  const leftTokens = tokenSetFor(left);
  const rightTokens = tokenSetFor(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
};

const normalizedCharactersFor = (value = '') => [...normalizeText(value).replace(/\s+/g, '')];

const cjkCharacterSetFor = (value = '') => (
  new Set(normalizedCharactersFor(value).filter((char) => CJK_CHARACTER_PATTERN.test(char)))
);

const cjkCharacterOverlapScore = (left = '', right = '') => {
  const leftCharacters = cjkCharacterSetFor(left);
  const rightCharacters = cjkCharacterSetFor(right);
  if (!leftCharacters.size || !rightCharacters.size) return 0;

  const overlap = [...leftCharacters].filter((char) => rightCharacters.has(char)).length;
  return overlap / Math.max(leftCharacters.size, rightCharacters.size);
};

const longestCommonSubsequenceScore = (left = '', right = '') => {
  const leftChars = normalizedCharactersFor(left);
  const rightChars = normalizedCharactersFor(right);
  if (!leftChars.length || !rightChars.length) return 0;

  let previous = new Array(rightChars.length + 1).fill(0);
  let current = new Array(rightChars.length + 1).fill(0);

  for (const leftChar of leftChars) {
    for (let index = 0; index < rightChars.length; index += 1) {
      current[index + 1] = leftChar === rightChars[index]
        ? previous[index] + 1
        : Math.max(previous[index + 1], current[index]);
    }
    [previous, current] = [current, previous];
    current.fill(0);
  }

  return previous[rightChars.length] / Math.max(leftChars.length, rightChars.length);
};

const textSimilarityScore = (left = '', right = '') => Math.max(
  tokenOverlapScore(left, right),
  cjkCharacterOverlapScore(left, right),
  longestCommonSubsequenceScore(left, right)
);

const hasCjkText = (...values) => values.some((value) => CJK_CHARACTER_PATTERN.test(String(value || '')));

const normalizeLooseName = (value = '') => normalizeTitle(value).replace(/\s+/g, '');

const removeNameDecorations = (value = '') => normalizeText(
  String(value)
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\b(acoustic version|explicit|deluxe|special edition|bonus track)\b/gi, ' ')
);

const compareNameScore = (target = '', candidate = '', maxScore = 45) => {
  const targetName = normalizeTitle(target);
  const candidateName = normalizeTitle(candidate);
  if (!targetName || !candidateName) return 0;

  if (targetName === candidateName) return maxScore;
  if (normalizeLooseName(target) === normalizeLooseName(candidate)) return Math.round(maxScore * 0.94);
  if (removeNameDecorations(target) === removeNameDecorations(candidate)) return Math.round(maxScore * 0.9);
  if (candidateName.includes(targetName) || targetName.includes(candidateName)) return Math.round(maxScore * 0.64);

  const similarity = textSimilarityScore(candidate, target);
  if (similarity > 0.9) return Math.round(maxScore * 0.85);
  if (similarity > 0.8) return Math.round(maxScore * 0.7);
  if (similarity > 0.68) return Math.round(maxScore * 0.5);
  if (similarity > 0.55) return Math.round(maxScore * 0.28);
  return 0;
};

const durationScoreFor = (candidateDurationMs, targetDurationMs) => {
  if (!targetDurationMs || !candidateDurationMs) return 0;

  const delta = Math.abs(candidateDurationMs - targetDurationMs);
  if (delta <= 300) return 30;
  if (delta <= 700) return 26;
  if (delta <= 1500) return 22;
  if (delta <= 3500) return 16;
  if (delta <= DURATION_TOLERANCE_MS) return 8;
  if (delta <= 15000) return -4;
  return -24;
};

export const getCandidateDurationMs = (candidate = {}) => (
  candidate?.duration || candidate?.dt || candidate?.durationMs || 0
);

export const getTargetArtistNames = (track = {}) => {
  if (Array.isArray(track.artists) && track.artists.length) {
    return track.artists;
  }

  return String(track.artistNames || '')
    .split(',')
    .map((artist) => artist.trim())
    .filter(Boolean);
};

const expandNameFields = (...values) => uniqueValues(values.flatMap((value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => expandNameFields(item));
  return [String(value)];
}));

const getCandidateNameVariants = (candidate = {}) => expandNameFields(
  candidate?.name,
  candidate?.alias,
  candidate?.aliases,
  candidate?.transNames,
  candidate?.tns
);

const getCandidateAlbumNameVariants = (candidate = {}) => expandNameFields(
  candidate?.album?.name,
  candidate?.album?.alias,
  candidate?.album?.aliases,
  candidate?.album?.transNames,
  candidate?.album?.tns
);

const getCandidateArtistGroups = (candidate = {}) => (
  (candidate?.artists || [])
    .map((artist) => expandNameFields(
      artist?.name,
      artist?.alias,
      artist?.aliases,
      artist?.transNames,
      artist?.tns
    ))
    .filter((names) => names.length)
);

export const getCandidateArtistNames = (candidate = {}) => (
  uniqueValues(getCandidateArtistGroups(candidate).flat())
);

const artistNamesMatch = (targetArtist, candidateArtist) => {
  if (!targetArtist || !candidateArtist) return false;
  const similarity = textSimilarityScore(candidateArtist, targetArtist);

  return candidateArtist === targetArtist
    || candidateArtist.includes(targetArtist)
    || targetArtist.includes(candidateArtist)
    || similarity >= (Math.min(candidateArtist.length, targetArtist.length) <= 3 ? 0.8 : 0.72);
};

const shouldSoftenCjkArtistMismatch = (candidate, track, context = {}) => (
  hasCjkText(candidate?.name, track?.name)
    && context.titleScore >= 42
    && context.durationScore >= 16
);

const artistScoreFor = (candidate, track, context = {}) => {
  const targetArtists = getTargetArtistNames(track).map(normalizeText).filter(Boolean);
  const candidateArtistGroups = getCandidateArtistGroups(candidate)
    .map((names) => names.map(normalizeText).filter(Boolean))
    .filter((names) => names.length);
  const candidateArtists = uniqueValues(candidateArtistGroups.flat());
  if (!targetArtists.length || !candidateArtists.length) {
    return { detail: 'Missing artist metadata', matchedTargets: [], score: 0 };
  }

  const matchedTargets = targetArtists.filter((targetArtist) => (
    candidateArtistGroups.some((candidateGroup) => (
      candidateGroup.some((candidateArtist) => artistNamesMatch(targetArtist, candidateArtist))
    ))
  ));

  if (!matchedTargets.length) {
    if (shouldSoftenCjkArtistMismatch(candidate, track, context)) {
      return {
        detail: 'No direct artist match; accepted by CJK title and duration',
        matchedTargets: [],
        score: -4,
      };
    }

    return { detail: 'No artist match', matchedTargets: [], score: -48 };
  }

  let score = 0;
  const primaryArtist = targetArtists[0];
  const primaryCandidateGroup = candidateArtistGroups[0] || [];
  if (primaryCandidateGroup.some((candidateArtist) => artistNamesMatch(primaryArtist, candidateArtist))) {
    score += 32;
  } else if (candidateArtists.some((candidateArtist) => artistNamesMatch(primaryArtist, candidateArtist))) {
    score += 20;
  }

  score += Math.min(24, matchedTargets.length * 12);
  score += Math.round(textSimilarityScore(candidateArtists.join(' '), targetArtists.join(' ')) * 12);
  return {
    detail: `${matchedTargets.length}/${targetArtists.length} target artists matched`,
    matchedTargets,
    score,
  };
};

export const scoreNeteaseCandidate = (candidate, track) => {
  const candidatePrimaryName = candidate?.name || '';
  const titleScoreDetails = getCandidateNameVariants(candidate)
    .map((name) => ({ name, score: compareNameScore(track.name, name) }))
    .sort((a, b) => b.score - a.score);
  const bestTitleScore = titleScoreDetails[0]?.score || 0;
  const bestTitleName = titleScoreDetails[0]?.name || candidatePrimaryName;

  const reasons = [{
    detail: bestTitleName,
    score: bestTitleScore,
    type: 'title',
  }];
  let score = bestTitleScore;

  const candidateDurationMs = getCandidateDurationMs(candidate);
  const durationScore = durationScoreFor(candidateDurationMs, track.durationMs);

  const artistScore = artistScoreFor(candidate, track, {
    durationScore,
    titleScore: bestTitleScore,
  });
  score += artistScore.score;
  reasons.push({
    detail: artistScore.detail,
    score: artistScore.score,
    type: 'artist',
  });

  let albumScore = 0;
  let bestAlbumName = '';
  if (track.albumName) {
    const albumScoreDetails = getCandidateAlbumNameVariants(candidate)
      .map((albumName) => ({ albumName, score: compareNameScore(track.albumName, albumName, 14) }))
      .sort((a, b) => b.score - a.score);
    albumScore = albumScoreDetails[0]?.score || 0;
    bestAlbumName = albumScoreDetails[0]?.albumName || '';
  }
  score += albumScore;
  reasons.push({
    detail: bestAlbumName || 'No album match',
    score: albumScore,
    type: 'album',
  });

  score += durationScore;
  reasons.push({
    detail: candidateDurationMs && track.durationMs
      ? `${Math.abs(candidateDurationMs - track.durationMs)}ms delta`
      : 'Missing duration',
    score: durationScore,
    type: 'duration',
  });

  const hasStatusPenalty = candidate.status != null && candidate.status !== 0;
  if (hasStatusPenalty) {
    score -= 6;
    reasons.push({
      detail: `NetEase status ${candidate.status}`,
      score: -6,
      type: 'status',
    });
  }

  const isMismatch = checkVersionMismatch(track.name, candidatePrimaryName);
  if (isMismatch) {
    score -= 90;
    reasons.push({
      detail: 'Version tags differ',
      score: -90,
      type: 'version',
    });
  }

  return { reasons, score };
};

export const rankNeteaseMatches = (songs = [], track = {}) => (
  songs
    .map((song) => {
      const { reasons, score } = scoreNeteaseCandidate(song, track);
      return { reasons, score, song };
    })
    .sort((a, b) => b.score - a.score)
);

export const createMatchedSourceTrack = (rankedMatch) => {
  if (!rankedMatch?.song) return null;
  return {
    ...rankedMatch.song,
    matchReasons: rankedMatch.reasons,
    matchScore: rankedMatch.score,
  };
};

export const selectBestNeteaseMatch = (songs = [], track = {}) => {
  const best = rankNeteaseMatches(songs, track)[0];
  return best?.score >= MATCH_SCORE_THRESHOLD ? createMatchedSourceTrack(best) : null;
};
