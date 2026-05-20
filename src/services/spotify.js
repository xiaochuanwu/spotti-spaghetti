// Spotify Web API Service with PKCE Authorization
import likedSongsCover from '../assets/images/liked_songs.png';
import { STORAGE_KEYS } from '../config/storage.js';
import { SPOTIFY_CONFIG, getSpotifyClientId } from '../config/spotify.js';
import {
  chunkArray,
  enrichTracksWithMetadata,
  getUniqueMetadataIds,
  mapAlbumLabels,
  mapArtistGenres,
  mapPlaylistTrackItem,
  mapPreviewTrackItem,
} from './spotifyMapper.js';

const MAX_RATE_LIMIT_RETRIES = 4;
const authStorage = sessionStorage;

export const spotify = {
  // Authorization PKCE Code Flow
  async authorize() {
    const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const codeVerifier = crypto.getRandomValues(new Uint8Array(64))
      .reduce((acc, x) => acc + alphanumeric[x % alphanumeric.length], "");
    
    const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashed)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    authStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
    const clientId = getSpotifyClientId();
    
    window.location = "https://accounts.spotify.com/authorize?client_id=" + clientId +
      "&redirect_uri=" + encodeURIComponent(SPOTIFY_CONFIG.redirectUri) +
      "&scope=" + encodeURIComponent(SPOTIFY_CONFIG.scopes) +
      "&response_type=code&code_challenge_method=S256&code_challenge=" + codeChallenge +
      "&show_dialog=true";
  },

  // Token exchange after redirect
  async handleCallback() {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return false;

    // Clear code from URL immediately for clean address bar
    window.history.replaceState({}, '', '/');

    try {
      const clientId = getSpotifyClientId();
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: SPOTIFY_CONFIG.redirectUri,
          code_verifier: authStorage.getItem(STORAGE_KEYS.codeVerifier) || ''
        })
      });

      if (response.ok) {
        const tokenData = await response.json();
        if (tokenData.access_token) {
          authStorage.setItem(STORAGE_KEYS.accessToken, tokenData.access_token);
          authStorage.setItem(STORAGE_KEYS.accessTokenTimestamp, Date.now().toString());
          return true;
        }
      }
      this.clearAuth();
      return false;
    } catch (error) {
      console.error('Failed to exchange authorization code:', error);
      this.clearAuth();
      return false;
    }
  },

  // Check if session is valid (1 hour window)
  isLoggedIn() {
    const token = authStorage.getItem(STORAGE_KEYS.accessToken);
    const timestamp = authStorage.getItem(STORAGE_KEYS.accessTokenTimestamp);
    if (!token || !timestamp) return false;
    return Date.now() - parseInt(timestamp, 10) < SPOTIFY_CONFIG.tokenExpiry;
  },

  // Logout
  logout() {
    this.clearAuth();
    window.location.href = window.location.origin;
  },

  clearAuth() {
    authStorage.removeItem(STORAGE_KEYS.accessToken);
    authStorage.removeItem(STORAGE_KEYS.accessTokenTimestamp);
    authStorage.removeItem(STORAGE_KEYS.codeVerifier);
  },

  // Base API calling helper
  async apiCall(url, delay = 0, onRateLimit = null, retryCount = 0, options = {}) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const token = authStorage.getItem(STORAGE_KEYS.accessToken);
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        body: options.body,
      });

      if (response.ok) {
        if (response.status === 204) return null;
        return await response.json();
      }

      if (response.status === 401) {
        // Token expired
        this.clearAuth();
        window.location.href = window.location.origin;
        return null;
      }

      if (response.status === 429) {
        // Rate limiting hit
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
        if (retryCount >= MAX_RATE_LIMIT_RETRIES) {
          throw new Error(`Spotify API rate limit exceeded after ${MAX_RATE_LIMIT_RETRIES} retries`);
        }
        if (onRateLimit) {
          onRateLimit(retryAfter);
        }
        console.warn(`Rate limit hit. Retrying in ${retryAfter}s...`);
        return await this.apiCall(url, retryAfter * 1000, onRateLimit, retryCount + 1, options);
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error(`API Call error for ${url}:`, error);
      throw error;
    }
  },

  // Get current user profile
  async getUser() {
    return this.apiCall("https://api.spotify.com/v1/me");
  },

  async createPlaylist(name, description = '') {
    const user = await this.getUser();
    if (!user?.id) throw new Error('Unable to load Spotify user profile');

    return this.apiCall(`https://api.spotify.com/v1/users/${user.id}/playlists`, 0, null, 0, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: false,
      }),
    });
  },

  async addTracksToPlaylist(playlistId, trackUris, onProgress = null) {
    const chunks = chunkArray(trackUris, 100);

    for (let i = 0; i < chunks.length; i++) {
      await this.apiCall(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, i * 100, null, 0, {
        method: 'POST',
        body: JSON.stringify({ uris: chunks[i] }),
      });
      if (onProgress) {
        onProgress(Math.round(((i + 1) / chunks.length) * 100));
      }
    }
  },

  async restorePlaylist(name, trackUris, onProgress = null) {
    const playlist = await this.createPlaylist(name, 'Restored by Spotti Spaghetti');
    await this.addTracksToPlaylist(playlist.id, trackUris, onProgress);
    return playlist;
  },

  // Fetch all playlists (including virtual "Liked Songs")
  async getPlaylists(onStatusChange = null) {
    if (onStatusChange) onStatusChange({ step: 'userProfile' }, 0);
    const user = await this.getUser();
    if (!user) throw new Error('Unable to load Spotify user profile');

    if (onStatusChange) onStatusChange({ step: 'likedSongsCount' }, 10);
    const libraryInfo = await this.apiCall("https://api.spotify.com/v1/me/tracks?offset=0&limit=1");
    
    const playlists = [];
    
    // 1. Inject Liked Songs as a virtual playlist
    if (libraryInfo) {
      playlists.push({
        id: 'liked_songs',
        name: "Liked Songs",
        external_urls: { spotify: "https://open.spotify.com/collection/tracks" },
        images: [{ url: likedSongsCover }],
        owner: {
          id: user.id,
          display_name: user.display_name || user.id,
          external_urls: { spotify: user.external_urls.spotify }
        },
        tracks: {
          total: libraryInfo.total,
          href: "https://api.spotify.com/v1/me/tracks"
        }
      });
    }

    if (onStatusChange) onStatusChange({ step: 'userPlaylists' }, 30);
    
    // 2. Fetch standard playlists
    let response = await this.apiCall("https://api.spotify.com/v1/me/playlists?limit=50&offset=0");
    if (!response) throw new Error('Unable to load Spotify playlists');

    playlists.push(...response.items);
    
    // Fetch remaining pages of playlists (if > 50)
    const requests = [];
    for (let offset = 50; offset < response.total; offset += 50) {
      requests.push(this.apiCall(`https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`, (offset - 50) * 10));
    }
    
    if (requests.length > 0) {
      const responses = await Promise.all(requests);
      responses.forEach(res => {
        if (res && res.items) {
          playlists.push(...res.items);
        }
      });
    }

    return playlists;
  },

  // Fetch tracks, artist genres, and album labels for a given playlist
  // Report detailed progress using `onProgress(percentage, stepDescription)`
  async getPlaylistTracks(playlist, onProgress = null, onRateLimit = null) {
    const isLiked = playlist.id === 'liked_songs';
    const limit = isLiked ? 50 : 100; // Liked songs limit is max 50
    const total = playlist.tracks.total;
    
    if (total === 0) return [];

    const tracks = [];

    // Step 1: Fetch tracks in pages
    const pageCount = Math.ceil(total / limit);
    for (let i = 0; i < pageCount; i++) {
      const offset = i * limit;
      if (onProgress) {
        onProgress(
          Math.round((i / pageCount) * 40), 
          { step: 'downloadTracks', offset, total }
        );
      }
      
      // Stagger requests slightly to avoid rate limit spikes
      const res = await this.apiCall(`${playlist.tracks.href}?offset=${offset}&limit=${limit}`, i * 50, onRateLimit);
      if (res && res.items) {
        tracks.push(...res.items.map(mapPlaylistTrackItem).filter(Boolean));
      }
    }

    const { artistIds, albumIds } = getUniqueMetadataIds(tracks);

    // Step 2: Fetch genres for artists (50 per request)
    if (onProgress) onProgress(45, { step: 'artistGenres' });
    const artistGenres = {};
    const artistChunks = chunkArray(artistIds, 50);

    const artistRequests = artistChunks.map((chunk, index) => 
      this.apiCall(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, index * 100, onRateLimit)
        .then(res => {
          Object.assign(artistGenres, mapArtistGenres(res?.artists));
        })
    );
    await Promise.all(artistRequests);

    // Step 3: Fetch record labels for albums (20 per request)
    if (onProgress) onProgress(75, { step: 'albumLabels' });
    const albumLabels = {};
    const albumChunks = chunkArray(albumIds, 20);

    const albumRequests = albumChunks.map((chunk, index) => 
      this.apiCall(`https://api.spotify.com/v1/albums?ids=${chunk.join(',')}`, index * 120, onRateLimit)
        .then(res => {
          Object.assign(albumLabels, mapAlbumLabels(res?.albums));
        })
    );
    await Promise.all(albumRequests);

    // Step 4: Map artist genres and album labels back to tracks
    if (onProgress) onProgress(95, { step: 'organizingExport' });
    const enrichedTracks = enrichTracksWithMetadata(tracks, artistGenres, albumLabels);

    if (onProgress) onProgress(100, { step: 'complete' });
    return enrichedTracks;
  },

  // Fetch a preview page of tracks (up to 50 tracks) for modal display
  async getPlaylistTracksPreview(playlist) {
    const limit = 50;
    const url = `${playlist.tracks.href}?offset=0&limit=${limit}`;
    const res = await this.apiCall(url);
    if (!res || !res.items) return [];
    
    return res.items.map(mapPreviewTrackItem).filter(Boolean);
  }
};
