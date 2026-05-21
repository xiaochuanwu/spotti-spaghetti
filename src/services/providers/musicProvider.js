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
];

export const assertMusicProvider = (provider) => {
  const missingMethods = REQUIRED_PROVIDER_METHODS.filter(method => (
    typeof provider?.[method] !== 'function'
  ));

  if (!provider?.id || missingMethods.length > 0) {
    throw new Error(`Invalid music provider: ${missingMethods.join(', ') || 'missing id'}`);
  }

  return provider;
};
