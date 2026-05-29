const STORAGE_NAMESPACE = 'spotti-spaghetti';

export const STORAGE_KEYS = {
  accessToken: `${STORAGE_NAMESPACE}:access-token`,
  accessTokenExpiresAt: `${STORAGE_NAMESPACE}:access-token-expires-at`,
  accessTokenScopes: `${STORAGE_NAMESPACE}:access-token-scopes`,
  refreshToken: `${STORAGE_NAMESPACE}:refresh-token`,
  // Legacy key kept for smooth migration from timestamp-based Spotify sessions.
  accessTokenTimestamp: `${STORAGE_NAMESPACE}:access-token-timestamp`,
  codeVerifier: `${STORAGE_NAMESPACE}:code-verifier`,
  language: `${STORAGE_NAMESPACE}:language`,
  oauthState: `${STORAGE_NAMESPACE}:oauth-state`,
  resumeBatch: `${STORAGE_NAMESPACE}:resume-batch`,
  theme: `${STORAGE_NAMESPACE}:theme`,
};
