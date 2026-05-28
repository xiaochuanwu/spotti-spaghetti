import {
  normalizeChineseScriptVariants,
  normalizeEquivalentPunctuation,
  normalizeText,
} from './textMatching.js';

const INFO_LINE_LABELS = [
  '作词',
  '作詞',
  '填词',
  '填詞',
  '词',
  '詞',
  '作曲',
  '曲',
  '编曲',
  '編曲',
  '制作人',
  '製作人',
  '制作',
  '製作',
  '监制',
  '監製',
  '出品',
  '发行',
  '發行',
  '录音',
  '錄音',
  '混音',
  '母带',
  '母帶',
  '和声',
  '和聲',
  '吉他',
  '贝斯',
  '貝斯',
  '钢琴',
  '鋼琴',
  '弦乐',
  '弦樂',
  '鼓',
  '键盘',
  '鍵盤',
  '统筹',
  '統籌',
  '策划',
  '策劃',
  '企划',
  '企劃',
  'OP',
  'SP',
  'Producer',
  'Composer',
  'Lyricist',
  'Arranger',
  'Mixing',
  'Mastering',
  'Recording',
];

const COPYRIGHT_INFO_LINE_PATTERNS = [
  /未经.*许可/i,
  /未經.*許可/i,
  /不得.*(翻唱|翻录|翻錄|使用|转载|轉載)/i,
  /版权所有|版權所有/i,
  /all rights reserved/i,
  /netease cloud music/i,
  /网易云音乐|網易雲音樂/i,
  /腾讯音乐|騰訊音樂/i,
];

const LRC_METADATA_PATTERN = /^\[[a-z]+:.*\]$/i;

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

const cleanWordSyncedText = (text = '') => (
  String(text)
    .replace(/\(\d+,\d+(?:,\d+)?\)/g, '')
    .replace(/<\d+,\d+(?:,\d+)?>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const parseWordSyncedLyric = (lyricText = '') => {
  const lines = [];
  const millisecondLinePattern = /^\[(\d+),(\d+)\](.*)$/;
  const lrcLinePattern = /^\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\](.*)$/;

  lyricText.split(/\r?\n/).forEach((rawLine) => {
    const match = rawLine.match(millisecondLinePattern);
    const lrcMatch = match ? null : rawLine.match(lrcLinePattern);
    if (!match && !lrcMatch) return;

    const timeMs = match
      ? Number(match[1])
      : parseTimestampMs(lrcMatch?.[1], lrcMatch?.[2]);
    const rawText = match?.[3] ?? lrcMatch?.[3];

    const text = cleanWordSyncedText(rawText);
    if (!text) return;

    lines.push({
      timeMs,
      text,
    });
  });

  return lines.sort((a, b) => a.timeMs - b.timeMs);
};

const parsePlainLyric = (lyricText = '') => (
  String(lyricText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !LRC_METADATA_PATTERN.test(line))
    .map((text, index) => ({
      isSynced: false,
      lineIndex: index,
      text,
      timeMs: null,
    }))
);

const isLyricInfoLine = (text = '') => {
  const normalized = normalizeChineseScriptVariants(
    normalizeEquivalentPunctuation(text).trim()
  );
  if (!normalized) return false;

  if (COPYRIGHT_INFO_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const labelMatch = normalized.match(/^([\p{L}\p{N}\s./&-]{1,30})\s*[:：]/u);
  if (!labelMatch) return false;

  const label = normalizeText(labelMatch[1]).replace(/\s+/g, '');
  return INFO_LINE_LABELS.some((infoLabel) => (
    label === normalizeText(infoLabel).replace(/\s+/g, '')
  ));
};

const removeInfoLines = (lines = []) => lines.filter((line) => !isLyricInfoLine(line.text));

const mergeTranslatedLines = (lyricLines, translatedLines) => {
  if (!translatedLines.length) return lyricLines;

  let translationIndex = 0;

  return lyricLines.map((line) => {
    while (
      translationIndex < translatedLines.length
      && translatedLines[translationIndex].timeMs < line.timeMs - 500
    ) {
      translationIndex += 1;
    }

    const candidates = [
      translatedLines[translationIndex],
      translatedLines[translationIndex + 1],
    ].filter(Boolean);
    const translatedLine = candidates
      .filter((candidate) => Math.abs(candidate.timeMs - line.timeMs) <= 500)
      .sort((a, b) => (
        Math.abs(a.timeMs - line.timeMs) - Math.abs(b.timeMs - line.timeMs)
      ))[0];

    return {
      ...line,
      translation: translatedLine?.text || '',
    };
  });
};

export const parseNeteaseLyricResponse = (response = {}) => {
  const lyricLines = removeInfoLines(parseLrc(response?.lrc?.lyric || ''));
  const fallbackWordLines = lyricLines.length
    ? lyricLines
    : removeInfoLines(parseWordSyncedLyric(response?.yrc?.lyric || response?.klyric?.lyric || ''));
  const translatedLines = parseLrc(response?.tlyric?.lyric || '');

  if (fallbackWordLines.length) {
    return mergeTranslatedLines(fallbackWordLines, translatedLines);
  }

  return removeInfoLines(parsePlainLyric(response?.lrc?.lyric || ''));
};
