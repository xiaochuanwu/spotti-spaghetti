import { spotifyProvider, SPOTIFY_PROVIDER_ID } from './spotifyProvider.js';

export const DEFAULT_PROVIDER_ID = SPOTIFY_PROVIDER_ID;

const providers = new Map([
  [spotifyProvider.id, spotifyProvider],
]);

export const getMusicProvider = (providerId = DEFAULT_PROVIDER_ID) => {
  const provider = providers.get(providerId);
  if (!provider) {
    throw new Error(`Unknown music provider: ${providerId}`);
  }
  return provider;
};

export const listMusicProviders = () => Array.from(providers.values());
