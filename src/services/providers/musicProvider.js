export const REQUIRED_PROVIDER_METHODS = [
  'authorize',
  'handleCallback',
  'logout',
  'isLoggedIn',
  'getPlaylists',
  'getPlaylistTracks',
  'getPlaylistTracksPreview',
  'createPlaylist',
  'addTracksToPlaylist',
  'restorePlaylist',
  'searchTracks',
  'getErrorInfo',
];

export const PROVIDER_ERROR_CODES = {
  REQUEST_CANCELLED: 'PROVIDER_REQUEST_CANCELLED',
};

const CAPABILITY_METHODS = {
  nowPlaying: 'getNowPlaying',
  playbackState: 'getPlaybackState',
};

export const createProviderError = (code, details = {}) => (
  Object.assign(new Error(code), { code, details })
);

export const assertMusicProvider = (provider) => {
  const missingMethods = REQUIRED_PROVIDER_METHODS.filter(method => (
    typeof provider?.[method] !== 'function'
  ));
  const missingCapabilityMethods = Object.entries(provider?.capabilities || {})
    .filter(([, enabled]) => enabled)
    .map(([capability]) => CAPABILITY_METHODS[capability])
    .filter(method => method && typeof provider?.[method] !== 'function');

  const allMissingMethods = [...missingMethods, ...missingCapabilityMethods];

  if (!provider?.id || allMissingMethods.length > 0) {
    throw new Error(`Invalid music provider: ${allMissingMethods.join(', ') || 'missing id'}`);
  }

  return provider;
};
