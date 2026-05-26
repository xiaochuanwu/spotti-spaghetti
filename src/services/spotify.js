// Spotify Web API Service with PKCE Authorization
import { STORAGE_KEYS } from '../config/storage.js';
import { SPOTIFY_CONFIG, getSpotifyClientId } from '../config/spotify.js';
import { MUSIC_PROVIDERS, normalizeTrack } from './musicModel.js';
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
const MAX_CONCURRENT_REQUESTS = 3;
const authStorage = sessionStorage;
const likedSongsCover = new URL('../assets/images/liked_songs.png', import.meta.url).href;

const createSpotifyError = (code, details = {}) => Object.assign(new Error(code), { code, details });
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let activeRequests = 0;
const requestQueue = [];

const drainRequestQueue = () => {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const { task, resolve, reject } = requestQueue.shift();
    activeRequests++;

    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        activeRequests--;
        drainRequestQueue();
      });
  }
};

const enqueueRequest = (task) => new Promise((resolve, reject) => {
  requestQueue.push({ task, resolve, reject });
  drainRequestQueue();
});

const createRandomString = (length = 48) => {
  const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return crypto.getRandomValues(new Uint8Array(length))
    .reduce((acc, x) => acc + alphanumeric[x % alphanumeric.length], '');
};

const readResponseBody = async (response) => {
  try {
    return await response.clone().json();
  } catch {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
};

const readSuccessfulResponseBody = async (response) => {
  if (response.status === 204 || response.status === 205) return null;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  return text;
};

const throwIfAborted = (signal) => {
  if (signal?.aborted) {
    throw createSpotifyError('SPOTIFY_REQUEST_CANCELLED');
  }
};

const normalizeSpotifyDevice = (device = null) => {
  if (!device) return null;

  return {
    id: device.id || '',
    isActive: Boolean(device.is_active),
    isPrivateSession: Boolean(device.is_private_session),
    isRestricted: Boolean(device.is_restricted),
    name: device.name || '',
    supportsVolume: Boolean(device.supports_volume),
    type: device.type || '',
    volumePercent: Number.isFinite(Number(device.volume_percent))
      ? Number(device.volume_percent)
      : null,
  };
};

const normalizeSpotifyPlayback = (response, fetchedAt, unavailableReason = 'no_active_playback') => {
  const device = normalizeSpotifyDevice(response?.device);
  const baseState = {
    context: response?.context ? {
      externalUrl: response.context.external_urls?.spotify || '',
      type: response.context.type || '',
      uri: response.context.uri || '',
    } : null,
    device,
    fetchedAt,
    isPlaying: Boolean(response?.is_playing),
    progressMs: response?.progress_ms ?? 0,
    repeatState: response?.repeat_state || '',
    shuffleState: typeof response?.shuffle_state === 'boolean' ? response.shuffle_state : null,
    timestamp: response?.timestamp ?? null,
  };

  if (!response?.item) {
    return {
      ...baseState,
      isAvailable: false,
      reason: unavailableReason,
    };
  }

  const currentlyPlayingType = response.currently_playing_type || response.item?.type || 'unknown';
  if (currentlyPlayingType !== 'track') {
    return {
      ...baseState,
      isAvailable: false,
      reason: 'unsupported_type',
      currentlyPlayingType,
    };
  }

  const track = response.item;
  const normalizedTrack = normalizeTrack({
    provider: MUSIC_PROVIDERS.spotify,
    providerTrackId: track.id,
    uri: track.uri,
    isrc: track.external_ids?.isrc || '',
    name: track.name,
    artists: track.artists?.map(artist => artist?.name).filter(Boolean) || [],
    album: {
      providerAlbumId: track.album?.id,
      name: track.album?.name,
    },
    releaseDate: track.album?.release_date,
    durationMs: track.duration_ms,
    popularity: track.popularity,
    explicit: track.explicit,
    rawSource: track,
  });

  return {
    ...baseState,
    isAvailable: true,
    durationMs: track.duration_ms ?? normalizedTrack.durationMs,
    track: normalizedTrack,
    albumCover: track.album?.images?.[0]?.url || '',
    externalUrl: track.external_urls?.spotify || '',
    currentlyPlayingType,
  };
};

const withDeviceQuery = (url, deviceId = '') => {
  if (!deviceId) return url;
  const params = new URLSearchParams({ device_id: deviceId });
  return `${url}?${params.toString()}`;
};

const getPlaybackControlRequest = (command, payload = {}) => {
  const deviceId = payload.deviceId || '';
  if (command === 'play') {
    return {
      method: 'PUT',
      url: withDeviceQuery('https://api.spotify.com/v1/me/player/play', deviceId),
    };
  }
  if (command === 'pause') {
    return {
      method: 'PUT',
      url: withDeviceQuery('https://api.spotify.com/v1/me/player/pause', deviceId),
    };
  }
  if (command === 'next') {
    return {
      method: 'POST',
      url: withDeviceQuery('https://api.spotify.com/v1/me/player/next', deviceId),
    };
  }
  if (command === 'previous') {
    return {
      method: 'POST',
      url: withDeviceQuery('https://api.spotify.com/v1/me/player/previous', deviceId),
    };
  }
  if (command === 'shuffle') {
    const state = payload.state ? 'true' : 'false';
    const params = new URLSearchParams({ state });
    if (deviceId) params.set('device_id', deviceId);
    return {
      method: 'PUT',
      url: `https://api.spotify.com/v1/me/player/shuffle?${params.toString()}`,
    };
  }
  if (command === 'repeat') {
    const state = ['track', 'context'].includes(payload.state) ? payload.state : 'off';
    const params = new URLSearchParams({ state });
    if (deviceId) params.set('device_id', deviceId);
    return {
      method: 'PUT',
      url: `https://api.spotify.com/v1/me/player/repeat?${params.toString()}`,
    };
  }
  if (command === 'seek') {
    const positionMs = Math.max(0, Math.round(Number(payload.positionMs) || 0));
    const params = new URLSearchParams({ position_ms: String(positionMs) });
    if (deviceId) params.set('device_id', deviceId);
    return {
      method: 'PUT',
      url: `https://api.spotify.com/v1/me/player/seek?${params.toString()}`,
    };
  }

  throw createSpotifyError('SPOTIFY_UNSUPPORTED_PLAYBACK_CONTROL', { command });
};

const parseStoredNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getTokenExpiryMs = (tokenData = {}) => {
  const expiresInSeconds = Number(tokenData.expires_in);
  if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    return expiresInSeconds * 1000;
  }
  return SPOTIFY_CONFIG.tokenExpiry;
};

const getStoredAccessTokenExpiresAt = () => {
  const expiresAt = parseStoredNumber(authStorage.getItem(STORAGE_KEYS.accessTokenExpiresAt));
  if (expiresAt > 0) return expiresAt;

  const legacyTimestamp = parseStoredNumber(authStorage.getItem(STORAGE_KEYS.accessTokenTimestamp));
  if (legacyTimestamp > 0) {
    const migratedExpiresAt = legacyTimestamp + SPOTIFY_CONFIG.tokenExpiry;
    authStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(migratedExpiresAt));
    authStorage.removeItem(STORAGE_KEYS.accessTokenTimestamp);
    return migratedExpiresAt;
  }

  return 0;
};

export const spotify = {
  // Authorization PKCE Code Flow
  async authorize() {
    const codeVerifier = createRandomString(64);
    const oauthState = createRandomString(48);
    
    const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashed)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    authStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
    authStorage.setItem(STORAGE_KEYS.oauthState, oauthState);
    const clientId = getSpotifyClientId();
    
    window.location = "https://accounts.spotify.com/authorize?client_id=" + clientId +
      "&redirect_uri=" + encodeURIComponent(SPOTIFY_CONFIG.redirectUri) +
      "&scope=" + encodeURIComponent(SPOTIFY_CONFIG.scopes) +
      "&response_type=code&code_challenge_method=S256&code_challenge=" + codeChallenge +
      "&state=" + encodeURIComponent(oauthState) +
      "&show_dialog=true";
  },

  // Token exchange after redirect
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const authError = params.get('error');
    if (!code && !authError) return false;

    // Clear code from URL immediately for clean address bar
    window.history.replaceState({}, '', window.location.pathname || '/');

    try {
      if (authError) {
        throw createSpotifyError('SPOTIFY_AUTH_DENIED', { authError });
      }

      const expectedState = authStorage.getItem(STORAGE_KEYS.oauthState);
      if (!expectedState || returnedState !== expectedState) {
        throw createSpotifyError('SPOTIFY_AUTH_STATE_MISMATCH');
      }

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
          const expiresAt = Date.now() + getTokenExpiryMs(tokenData);
          authStorage.setItem(STORAGE_KEYS.accessToken, tokenData.access_token);
          authStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(expiresAt));
          authStorage.removeItem(STORAGE_KEYS.accessTokenTimestamp);
          authStorage.removeItem(STORAGE_KEYS.codeVerifier);
          authStorage.removeItem(STORAGE_KEYS.oauthState);
          return true;
        }
      }
      const payload = await readResponseBody(response);
      throw createSpotifyError('SPOTIFY_AUTH_EXCHANGE_FAILED', {
        status: response.status,
        statusText: response.statusText,
        payload,
      });
    } catch (error) {
      console.error('Failed to exchange authorization code:', error);
      this.clearAuth();
      throw error;
    }
  },

  // Check if session is valid based on Spotify's expires_in value.
  isLoggedIn() {
    const token = authStorage.getItem(STORAGE_KEYS.accessToken);
    if (!token) return false;

    const expiresAt = getStoredAccessTokenExpiresAt();
    if (!expiresAt || Date.now() >= expiresAt) {
      this.clearAuth();
      return false;
    }

    return true;
  },

  // Logout
  logout() {
    this.clearAuth();
    window.location.href = window.location.origin;
  },

  clearAuth() {
    authStorage.removeItem(STORAGE_KEYS.accessToken);
    authStorage.removeItem(STORAGE_KEYS.accessTokenExpiresAt);
    authStorage.removeItem(STORAGE_KEYS.accessTokenTimestamp);
    authStorage.removeItem(STORAGE_KEYS.codeVerifier);
    authStorage.removeItem(STORAGE_KEYS.oauthState);
  },

  // Base API calling helper
  async apiCall(url, delay = 0, onRateLimit = null, retryCount = 0, options = {}) {
    return enqueueRequest(() => this.apiRequest(url, delay, onRateLimit, retryCount, options));
  },

  async apiRequest(url, delay = 0, onRateLimit = null, retryCount = 0, options = {}) {
    throwIfAborted(options.signal);

    if (delay > 0) {
      await wait(delay);
    }

    try {
      const token = authStorage.getItem(STORAGE_KEYS.accessToken);
      if (!token || !this.isLoggedIn()) {
        throw createSpotifyError('SPOTIFY_AUTH_EXPIRED');
      }

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        body: options.body,
        signal: options.signal,
      });

      if (response.ok) {
        return readSuccessfulResponseBody(response);
      }

      if (response.status === 401) {
        this.clearAuth();
        throw createSpotifyError('SPOTIFY_AUTH_EXPIRED', { status: response.status });
      }

      if (response.status === 429) {
        // Rate limiting hit
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
        if (retryCount >= MAX_RATE_LIMIT_RETRIES) {
          throw createSpotifyError('SPOTIFY_RATE_LIMIT_EXCEEDED', { retryCount });
        }
        if (onRateLimit) {
          onRateLimit(retryAfter);
        }
        console.warn(`Rate limit hit. Retrying in ${retryAfter}s...`);
        return await this.apiRequest(url, retryAfter * 1000, onRateLimit, retryCount + 1, options);
      }

      const payload = await readResponseBody(response);
      if (response.status === 403) {
        throw createSpotifyError('SPOTIFY_PERMISSION_DENIED', {
          status: response.status,
          statusText: response.statusText,
          payload,
        });
      }

      throw createSpotifyError('SPOTIFY_REQUEST_FAILED', {
        status: response.status,
        statusText: response.statusText,
        payload,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createSpotifyError('SPOTIFY_REQUEST_CANCELLED');
      }
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
    if (!user?.id) throw createSpotifyError('SPOTIFY_USER_PROFILE_UNAVAILABLE');

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

  async restorePlaylist(name, trackUris, onProgress = null, description = '') {
    const playlist = await this.createPlaylist(name, description);
    await this.addTracksToPlaylist(playlist.id, trackUris, onProgress);
    return playlist;
  },

  async searchTracks(query, { limit = 10, offset = 0, market = '' } = {}) {
    const params = new URLSearchParams({
      type: 'track',
      q: query,
      limit: String(limit),
      offset: String(offset),
    });
    if (market) params.set('market', market);

    const response = await this.apiCall(`https://api.spotify.com/v1/search?${params.toString()}`);
    return response?.tracks?.items || [];
  },

  async getNowPlaying(options = {}) {
    const response = await this.apiCall(
      'https://api.spotify.com/v1/me/player/currently-playing',
      0,
      null,
      0,
      options
    );
    const fetchedAt = new Date().toISOString();

    return normalizeSpotifyPlayback(response, fetchedAt);
  },

  async getPlaybackState(options = {}) {
    const response = await this.apiCall(
      'https://api.spotify.com/v1/me/player',
      0,
      null,
      0,
      options
    );
    const fetchedAt = new Date().toISOString();

    return normalizeSpotifyPlayback(response, fetchedAt, 'no_active_device');
  },

  async controlPlayback(command, payload = {}, options = {}) {
    const request = getPlaybackControlRequest(command, payload);

    return this.apiCall(request.url, 0, null, 0, {
      method: request.method,
      signal: options.signal,
    });
  },

  // Fetch all playlists (including the saved-tracks virtual playlist)
  async getPlaylists(onStatusChange = null) {
    if (onStatusChange) onStatusChange({ step: 'userProfile' }, 0);
    const user = await this.getUser();
    if (!user) throw createSpotifyError('SPOTIFY_USER_PROFILE_UNAVAILABLE');

    if (onStatusChange) onStatusChange({ step: 'likedSongsCount' }, 10);
    const libraryInfo = await this.apiCall("https://api.spotify.com/v1/me/tracks?offset=0&limit=1");
    
    const playlists = [];
    
    // 1. Inject saved tracks as a virtual playlist
    if (libraryInfo) {
      playlists.push({
        id: 'liked_songs',
        name: 'liked_songs',
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
    if (!response) throw createSpotifyError('SPOTIFY_PLAYLISTS_UNAVAILABLE');

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
  async getPlaylistTracks(playlist, onProgress = null, onRateLimit = null, options = {}) {
    const isLiked = playlist.id === 'liked_songs';
    const limit = isLiked ? 50 : 100; // Liked songs limit is max 50
    const total = playlist.tracks.total;
    
    if (total === 0) return [];

    const tracks = [];

    // Step 1: Fetch tracks in pages
    const pageCount = Math.ceil(total / limit);
    for (let i = 0; i < pageCount; i++) {
      throwIfAborted(options.signal);
      const offset = i * limit;
      if (onProgress) {
        onProgress(
          Math.round((i / pageCount) * 40), 
          { step: 'downloadTracks', offset, total }
        );
      }
      
      // Stagger requests slightly to avoid rate limit spikes
      const res = await this.apiCall(`${playlist.tracks.href}?offset=${offset}&limit=${limit}`, i * 50, onRateLimit, 0, options);
      if (res && res.items) {
        tracks.push(...res.items.map(item => mapPlaylistTrackItem(item, playlist)).filter(Boolean));
      }
    }

    const { artistIds, albumIds } = getUniqueMetadataIds(tracks);

    // Step 2: Fetch genres for artists (50 per request)
    if (onProgress) onProgress(45, { step: 'artistGenres' });
    const artistGenres = {};
    const artistChunks = chunkArray(artistIds, 50);

    const artistRequests = artistChunks.map((chunk, index) => 
      this.apiCall(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, index * 100, onRateLimit, 0, options)
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
      this.apiCall(`https://api.spotify.com/v1/albums?ids=${chunk.join(',')}`, index * 120, onRateLimit, 0, options)
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

  // Fetch a preview page of tracks for modal display
  async getPlaylistTracksPreview(playlist, offset = 0, limit = 50, options = {}) {
    const url = `${playlist.tracks.href}?offset=${offset}&limit=${limit}`;
    const res = await this.apiCall(url, 0, null, 0, options);
    if (!res || !res.items) {
      return { tracks: [], total: playlist.tracks?.total || 0, nextOffset: offset, hasMore: false };
    }
    
    const tracks = res.items.map(mapPreviewTrackItem).filter(Boolean);
    const total = res.total ?? playlist.tracks?.total ?? tracks.length;
    const nextOffset = offset + res.items.length;

    return {
      tracks,
      total,
      nextOffset,
      hasMore: Boolean(res.next) || nextOffset < total,
    };
  }
};
