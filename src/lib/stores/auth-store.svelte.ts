import type { AuthUser } from '$lib/types';
import { login, register, logout, refreshToken } from '$lib/services/auth-client';
import { storeAuthToken, getAuthToken, clearAuthToken } from '$lib/services/tauri-commands';

// --- State ---

let isAuthenticated = $state(false);
let currentUser = $state<AuthUser | null>(null);
let accessToken = $state<string | null>(null);
let isLoading = $state(false);
let error = $state<string | null>(null);

// --- Exported store ---

export const authStore = {
  get isAuthenticated() { return isAuthenticated; },
  get currentUser() { return currentUser; },
  get accessToken() { return accessToken; },
  get isLoading() { return isLoading; },
  get error() { return error; },
};

// --- Actions ---

/**
 * Called on app mount. Reads persisted tokens and attempts a refresh.
 * Fails silently — the user simply remains unauthenticated.
 */
export async function initAuth(proxyUrl: string): Promise<void> {
  try {
    const stored = await getAuthToken();
    if (!stored) return;

    const result = await refreshToken(stored.refresh_token, proxyUrl);
    accessToken = result.accessToken;
    currentUser = result.user;
    isAuthenticated = true;

    // Persist the new access token (refresh token stays the same)
    await storeAuthToken(result.accessToken, stored.refresh_token);
  } catch {
    // Stored token expired or proxy unavailable — clear and stay logged out
    await clearAuthToken().catch(() => {});
    accessToken = null;
    currentUser = null;
    isAuthenticated = false;
  }
}

export async function loginUser(email: string, password: string, proxyUrl: string): Promise<void> {
  isLoading = true;
  error = null;
  try {
    const tokens = await login(email, password, proxyUrl);
    await storeAuthToken(tokens.accessToken, tokens.refreshToken);
    accessToken = tokens.accessToken;
    currentUser = tokens.user;
    isAuthenticated = true;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Login failed';
    throw e;
  } finally {
    isLoading = false;
  }
}

export async function registerUser(email: string, password: string, proxyUrl: string): Promise<void> {
  isLoading = true;
  error = null;
  try {
    const tokens = await register(email, password, proxyUrl);
    await storeAuthToken(tokens.accessToken, tokens.refreshToken);
    accessToken = tokens.accessToken;
    currentUser = tokens.user;
    isAuthenticated = true;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Registration failed';
    throw e;
  } finally {
    isLoading = false;
  }
}

export async function logoutUser(proxyUrl: string): Promise<void> {
  if (accessToken) await logout(accessToken, proxyUrl).catch(() => {});
  await clearAuthToken().catch(() => {});
  accessToken = null;
  currentUser = null;
  isAuthenticated = false;
}

export function clearAuthError(): void {
  error = null;
}
