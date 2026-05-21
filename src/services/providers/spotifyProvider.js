import { spotify } from '../spotify.js';
import { assertMusicProvider } from './musicProvider.js';

export const SPOTIFY_PROVIDER_ID = 'spotify';

export const spotifyProvider = assertMusicProvider({
  id: SPOTIFY_PROVIDER_ID,
  name: 'Spotify',
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
});
