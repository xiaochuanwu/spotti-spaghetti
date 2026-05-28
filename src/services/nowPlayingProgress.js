const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const DEFAULT_DISPLAY_LATENCY_MS = 500;

const parseFetchedAtMs = (fetchedAt) => {
  if (typeof fetchedAt === "number") {
    return Number.isFinite(fetchedAt) ? fetchedAt : null;
  }

  if (typeof fetchedAt !== "string" || fetchedAt.trim() === "") {
    return null;
  }

  const parsed = Date.parse(fetchedAt);
  return Number.isFinite(parsed) ? parsed : null;
};

export const calculateDisplayProgressMs = (
  {
    progressMs = 0,
    durationMs = 0,
    isPlaying = false,
    fetchedAt = null,
    displayLatencyMs = DEFAULT_DISPLAY_LATENCY_MS,
  } = {},
  nowMs = Date.now(),
) => {
  const duration = Math.max(0, toFiniteNumber(durationMs));
  if (duration <= 0) return 0;

  const baseProgress = clamp(toFiniteNumber(progressMs), 0, duration);
  if (!isPlaying) return baseProgress;

  const fetchedAtMs = parseFetchedAtMs(fetchedAt);
  const currentMs = toFiniteNumber(nowMs);
  if (fetchedAtMs === null || currentMs <= 0) return baseProgress;

  const latencyMs = clamp(toFiniteNumber(displayLatencyMs), 0, 5000);
  const elapsedMs = Math.max(0, currentMs - fetchedAtMs);
  return clamp(baseProgress + elapsedMs - latencyMs, 0, duration);
};
