import { spotify } from '../spotify.js';
import { assertMusicProvider, PROVIDER_ERROR_CODES } from './musicProvider.js';

export const SPOTIFY_PROVIDER_ID = 'spotify';

const SPOTIFY_ERROR_KEYS = {
  SPOTIFY_RATE_LIMIT_EXCEEDED: 'error.spotifyRateLimit',
  SPOTIFY_REQUEST_FAILED: 'error.spotifyRequestFailed',
  SPOTIFY_AUTH_DENIED: 'error.authFailed',
  SPOTIFY_AUTH_EXCHANGE_FAILED: 'error.authFailed',
  SPOTIFY_AUTH_EXPIRED: 'error.spotifyAuthExpired',
  SPOTIFY_AUTH_STATE_MISMATCH: 'error.spotifyAuthStateMismatch',
  SPOTIFY_PERMISSION_DENIED: 'error.spotifyPermissionDenied',
  SPOTIFY_REQUEST_CANCELLED: 'error.spotifyRequestCancelled',
  [PROVIDER_ERROR_CODES.REQUEST_CANCELLED]: 'error.spotifyRequestCancelled',
  SPOTIFY_USER_PROFILE_UNAVAILABLE: 'error.spotifyUserUnavailable',
  SPOTIFY_PLAYLISTS_UNAVAILABLE: 'error.spotifyPlaylistsUnavailable',
};

export const getSpotifyErrorInfo = (error) => {
  const code = error?.code || error?.message || 'UNKNOWN_PROVIDER_ERROR';

  return {
    code,
    translationKey: SPOTIFY_ERROR_KEYS[code] || 'error.genericDetail',
    isAuthExpired: code === 'SPOTIFY_AUTH_EXPIRED',
    isCancelled: code === 'SPOTIFY_REQUEST_CANCELLED' || code === PROVIDER_ERROR_CODES.REQUEST_CANCELLED,
  };
};

export const spotifyProvider = assertMusicProvider({
  id: SPOTIFY_PROVIDER_ID,
  name: 'Spotify',
  capabilities: {
    nowPlaying: true,
  },
  authorize: (...args) => spotify.authorize(...args),
  handleCallback: (...args) => spotify.handleCallback(...args),
  logout: (...args) => spotify.logout(...args),
  isLoggedIn: (...args) => spotify.isLoggedIn(...args),
  getPlaylists: (...args) => spotify.getPlaylists(...args),
  getPlaylistTracks: (...args) => spotify.getPlaylistTracks(...args),
  getPlaylistTracksPreview: (...args) => spotify.getPlaylistTracksPreview(...args),
  createPlaylist: (...args) => spotify.createPlaylist(...args),
  addTracksToPlaylist: (...args) => spotify.addTracksToPlaylist(...args),
  restorePlaylist: (...args) => spotify.restorePlaylist(...args),
  searchTracks: (...args) => spotify.searchTracks(...args),
  getNowPlaying: (...args) => spotify.getNowPlaying(...args),
  getErrorInfo: getSpotifyErrorInfo,
});
