# Code Review — Phase 5: Auth + Polish

**Date:** 2026-02-23
**Build status:** cargo check PASS | svelte-check 0 errors 0 warnings PASS

---

## Scope

| Layer | Files reviewed |
|---|---|
| Proxy (CF Workers / Hono) | `proxy/migrations/0002_update_users_auth.sql`, `proxy/src/routes/auth.ts`, `proxy/src/routes/usage.ts`, `proxy/src/auth-middleware.ts`, `proxy/src/rate-limiter.ts`, `proxy/src/index.ts` |
| Rust / Tauri | `src-tauri/src/commands/auth.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml` |
| Frontend | `src/lib/types.ts`, `src/lib/services/auth-client.ts`, `src/lib/services/ai-client.ts`, `src/lib/stores/auth-store.svelte.ts`, `src/routes/auth/login/+page.svelte`, `src/routes/auth/register/+page.svelte`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/settings/+page.svelte`, `src/lib/components/shared/offline-banner.svelte`, `src/lib/components/shared/error-boundary.svelte`, `src/lib/components/settings/usage-display.svelte` |

---

## Overall Assessment

Solid Phase 5 delivery. The security foundations — PBKDF2 hashing, constant-time comparison, JWT rotation, KV-backed refresh token revocation, timing-safe API key comparison — are all well-implemented. The Svelte 5 runes pattern is correct throughout. No critical bugs. Issues below are medium/low except for two high-priority items.

---

## Critical Issues

None.

---

## High Priority

### H1 — `jwtSecret` falls back to `PROXY_API_KEY` when `JWT_SECRET` is unset

**Files:** `proxy/src/routes/auth.ts:68`, `proxy/src/auth-middleware.ts:8`

```ts
return new TextEncoder().encode(env.JWT_SECRET ?? env.PROXY_API_KEY);
```

If `JWT_SECRET` is not set in production, JWTs are signed with `PROXY_API_KEY`. This allows anyone who knows the API key (e.g. internal dev tooling, env dumps) to forge JWTs. These are two distinct credentials serving different trust models.

**Fix:** Fail loudly if `JWT_SECRET` is absent rather than silently falling back.

```ts
// auth.ts / auth-middleware.ts
function jwtSecret(env: Env): Uint8Array {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(env.JWT_SECRET);
}
```

Return 500 at the route level if this throws. The fallback should not exist in the production path.

---

### H2 — `/usage` route missing rate limiter middleware

**File:** `proxy/src/index.ts:52-53`

```ts
app.use('/usage', authMiddleware);   // auth applied
app.route('/usage', usageRouter);    // rate limiter NOT applied
```

`/v1/*` routes get both `authMiddleware` + `rateLimiter`. `/usage` only gets `authMiddleware`. A valid JWT can hammer `GET /usage` (which hits D1 + two KV reads per request) at unlimited frequency.

**Fix:**
```ts
app.use('/usage', authMiddleware);
app.use('/usage', rateLimiter);   // add this line
app.route('/usage', usageRouter);
```

---

## Medium Priority

### M1 — Race condition in rate-limiter KV counter

**File:** `proxy/src/rate-limiter.ts:21-32`

```ts
const raw = await kv.get(kvKey);
const count = raw ? parseInt(raw, 10) : 0;
if (count >= RATE_LIMIT_PER_MIN) { ... }
await kv.put(kvKey, String(count + 1), ...);
```

Read-increment-write is not atomic in KV. Under concurrent requests (CF Workers runs per-isolate but the same user can have multiple in-flight), two requests can both read `count=59`, both pass the check, and both write `60` — effectively skipping enforcement at the boundary. For a 60 req/min limit this is a minor gap; accepted as a known KV limitation. Flag for documentation or future Durable Object migration if stricter enforcement is needed.

---

### M2 — Monthly usage counter has same non-atomic race

**File:** `proxy/src/rate-limiter.ts:44-46`

```ts
const prevRaw = await kv.get(usageKey);
const prev = prevRaw ? parseInt(prevRaw, 10) : 0;
await kv.put(usageKey, String(prev + 1), ...);
```

Monthly token/request counters will under-count under burst concurrency. Acceptable for soft limits/analytics, but should be documented as approximate.

---

### M3 — `$effect` in `+layout.svelte` can call `initAuth` multiple times

**File:** `src/routes/+layout.svelte:11-15`

```ts
$effect(() => {
  if (settingsStore.proxy_url) {
    initAuth(settingsStore.proxy_url).catch(() => {});
  }
});
```

`$effect` re-runs whenever `settingsStore.proxy_url` changes. If the user edits the proxy URL in settings and saves, `initAuth` fires again — this triggers another `refreshToken` call with the stored refresh token. The second call will succeed and overwrite `accessToken` in state (harmless), but if the user changed the URL to a different server, the new server won't recognise the token and the error is silently swallowed. Edge case, but can leave the app in a confusing logged-in-but-wrong-server state.

**Fix:** Run `initAuth` once on mount only, or gate on a `mounted` boolean.

```ts
let mounted = false;
$effect(() => {
  if (!mounted && settingsStore.proxy_url) {
    mounted = true;
    initAuth(settingsStore.proxy_url).catch(() => {});
  }
});
```

---

### M4 — `error-boundary.svelte` catches all unhandled rejections globally

**File:** `src/lib/components/shared/error-boundary.svelte:9-12`

```ts
function onUnhandledRejection(e: PromiseRejectionEvent) {
  caught = e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Unknown error');
  e.preventDefault();
}
```

This modal intercepts every unhandled promise rejection in the app — including internal Tauri IPC errors, network failures during AI streaming, etc. `e.preventDefault()` suppresses the browser console warning. For auth errors that are intentionally silenced (e.g., `initAuth` failure), those are already `catch`-guarded, so they won't surface here. But any future unguarded async code will show a full-screen modal, which is overly disruptive. Consider filtering by error type or limiting the modal to fatal/unknown errors.

---

### M5 — `password_hash` column nullable in migration, no server-side guard for legacy rows

**File:** `proxy/migrations/0002_update_users_auth.sql:2`

```sql
ALTER TABLE users ADD COLUMN password_hash TEXT;
```

Column is nullable (no `NOT NULL`). The login route handles this via:
```ts
if (!user || !user.password_hash || !(await verifyPassword(...)))
```

This is correct. However, a user created via the legacy `api_key`-only path (pre-Phase 5) has `password_hash = NULL` and can never log in via JWT auth. They also have no migration path to set a password. Documenting or enforcing this would be helpful. Low risk since this appears to be a single-developer app without existing user base.

---

## Low Priority

### L1 — `register` route uses the UUID as `api_key`

**File:** `proxy/src/routes/auth.ts:89`

```ts
.bind(id, email, id, passwordHash, 'free', now)
//           ^^^ api_key = user id
```

`api_key` is set to the user's UUID. This field appears to be the legacy pre-JWT identifier. With JWT auth the `api_key` column is no longer meaningful, but its value (same as `id`) is technically guessable since UUIDs are non-secret identifiers. If `api_key` is used anywhere for auth purposes in the remaining codebase, this is a concern. Confirmed `api_key` is not exposed in any auth response — low risk.

---

### L2 — `jwtSecret` function duplicated across two files

**Files:** `proxy/src/routes/auth.ts:67-69`, `proxy/src/auth-middleware.ts:7-9`

Same function body copy-pasted. Move to a shared `proxy/src/utils/jwt.ts` when the H1 fix is applied (the fix needs to go in both places currently).

---

### L3 — `getUsage` in `auth-client.ts` does not handle non-JSON error bodies

**File:** `src/lib/services/auth-client.ts:31-35`

```ts
const res = await fetch(`${proxyUrl}/usage`, { ... });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return res.json() as Promise<UsageStats>;
```

Error is thrown before `res.json()` on non-OK, which is correct. But `res.json()` on a successful response can still throw if the proxy returns malformed JSON (network cut mid-stream, CF error page, etc.). The settings page silently catches this with `usage = null`, so UX impact is minimal.

---

### L4 — `Settings` type still carries `proxy_api_key` field

**File:** `src/lib/types.ts:29-35`

```ts
export interface Settings {
  ...
  proxy_api_key: string;
}
```

The API key fallback path is still supported (dev/offline mode), so this field is intentional. However, the settings page renders it as a visible `type="password"` input. A user with JWT auth may inadvertently clear or overwrite this key. Consider hiding/disabling the field when `authStore.isAuthenticated` is true.

---

## Edge Cases Found by Scout

- **Refresh token reuse after server URL change** — covered in M3 above.
- **KV `get` returning stale data** — CF KV has eventual consistency; a just-written rate counter may not be immediately visible. Impact: same as M1, minor over-allowance at window boundaries.
- **`initAuth` called while `isLoading` is false but concurrently with a `loginUser` call** — both write to the same `$state` vars. Unlikely in practice (layout effect runs at mount, login is user-triggered), but no mutex/guard exists. Benign outcome: whichever resolves last wins.
- **`error-boundary` reset-on-dismiss does NOT re-render children** — the modal is dismissed (`caught = null`) but the component that threw still has broken state. The "Reload app" button is the correct recovery path; "Dismiss" is misleading for fatal errors.

---

## Positive Observations

- PBKDF2 with 100,000 iterations + 16-byte random salt is appropriate for CF Workers constraints. Constant-time comparison for both hash (`diff |= ...`) and API key (`timingSafeEqual`) is correctly implemented.
- Refresh token revocation via KV delete on logout is a good pattern — tokens cannot be reused after logout.
- User enumeration protection on login (same error message for bad email vs bad password).
- Rust auth commands are minimal and correct — store, get, clear, all with save-on-write.
- Svelte 5 runes usage is correct: `.svelte.ts` extension, module-level `$state`, exported getter object, no runes in plain `.ts` files.
- `offline-banner.svelte` properly cleans up event listeners in `$effect` return callback.
- `usage-display.svelte` uses `Math.max(limit, 1)` to guard division-by-zero.
- `ai-client.ts` accessToken priority over `proxy_api_key` is clean and correct.

---

## Recommended Actions

1. **[H1] Fix `jwtSecret` fallback** — throw if `JWT_SECRET` unset; do not use `PROXY_API_KEY` as signing key. Apply fix in both `auth.ts` and `auth-middleware.ts` (also resolves L2 if extracted to shared util).
2. **[H2] Add `rateLimiter` to `/usage` route** — one line in `proxy/src/index.ts`.
3. **[M3] Gate `initAuth` to run once in layout** — prevent re-run on proxy URL change.
4. **[M4] Scope error-boundary** — consider filtering or limiting to unknown/fatal errors rather than all unhandled rejections.
5. **[L2] Extract `jwtSecret` to shared util** — DRY, combined with H1 fix.

---

## Metrics

- Type coverage: 100% (svelte-check 0 errors)
- Linting issues: 0
- Build errors: 0 (cargo check clean, svelte-check clean)
- Security posture: Good — two issues (H1, H2) lower the posture from "good" to "acceptable" until fixed

---

## Unresolved Questions

- Is `password_hash` column intentionally nullable long-term, or should a follow-up migration add `NOT NULL DEFAULT ''` with a guard?
- Is there any plan to gate features by `plan` (free vs pro) beyond usage limits? If so, the JWT `plan` claim needs to be treated as advisory-only and always re-validated from DB (which the `/usage` endpoint already does correctly via DB lookup, but the middleware does not).
- Token refresh happens on every cold start via `initAuth`. If the app is offline at start (no proxy), the refresh fails silently and the user is not logged in despite having valid stored tokens. Is this the intended UX for the offline-first case?
