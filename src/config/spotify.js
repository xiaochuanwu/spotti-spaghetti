const env = import.meta.env || {};

export const SPOTIFY_CONFIG = {
  clientId: env.VITE_SPOTIFY_CLIENT_ID || '',
  redirectUri: `${window.location.origin}/`,
  scopes: 'playlist-read-private playlist-read-collaborative user-library-read playlist-modify-private playlist-modify-public',
  tokenExpiry: 3600000,
};

export const getSpotifyClientId = () => {
  if (!SPOTIFY_CONFIG.clientId) {
    throw new Error('Missing VITE_SPOTIFY_CLIENT_ID environment variable.');
  }

  return SPOTIFY_CONFIG.clientId;
};
