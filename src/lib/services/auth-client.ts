import type { AuthTokens, AuthUser, UsageStats } from '$lib/types';

async function post<T>(url: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = (await res.json()) as { error?: string } & T;

  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function login(email: string, password: string, proxyUrl: string): Promise<AuthTokens> {
  return post<AuthTokens>(`${proxyUrl}/auth/login`, { email, password });
}

export async function register(email: string, password: string, proxyUrl: string): Promise<AuthTokens> {
  return post<AuthTokens>(`${proxyUrl}/auth/register`, { email, password });
}

export async function refreshToken(refreshTok: string, proxyUrl: string): Promise<{ accessToken: string; user: AuthUser }> {
  return post(`${proxyUrl}/auth/refresh`, { refreshToken: refreshTok });
}

export async function logout(accessToken: string, proxyUrl: string): Promise<void> {
  await post(`${proxyUrl}/auth/logout`, {}, accessToken).catch(() => {/* best-effort */});
}

export async function getUsage(accessToken: string, proxyUrl: string): Promise<UsageStats> {
  const res = await fetch(`${proxyUrl}/usage`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<UsageStats>;
}
