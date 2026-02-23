import type { Env } from './index';

/**
 * Returns the JWT signing secret.
 * Throws if JWT_SECRET is not configured — never falls back to PROXY_API_KEY
 * so the two secrets remain strictly separated.
 */
export function getJwtSecret(env: Env): Uint8Array {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return new TextEncoder().encode(env.JWT_SECRET);
}
