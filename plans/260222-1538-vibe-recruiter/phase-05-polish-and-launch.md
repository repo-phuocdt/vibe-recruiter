# Phase 5: Polish & Launch

## Context Links
- [Plan Overview](./plan.md) | [Brainstorm](../reports/brainstorm-260222-1538-vibe-recruiter-architecture.md)
- Depends on: Phase 1-4 (all features implemented)
- Refs: `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-stronghold`, https://v2.tauri.app/distribute/

## Overview
- **Priority:** P1 | **Status:** Complete | **Effort:** 2 weeks
- Settings page (LLM config, theme), auth flow (JWT in Stronghold), proxy auth middleware + usage tracking, billing prep, auto-update, app packaging, error handling, perf optimization.

## Requirements
- FR1: Settings - LLM provider/model select, proxy URL, theme toggle (light/dark)
- FR2: Login/register via proxy, JWT stored in Tauri Stronghold (encrypted)
- FR3: Proxy auth middleware - verify JWT on `/llm/*` requests
- FR4: Usage tracking - tokens/requests per user per month, display in settings
- FR5: Billing prep - Stripe checkout link, plan display, usage limits
- FR6: Auto-update on startup via Tauri updater plugin
- FR7: Packaging: DMG (macOS), NSIS (Windows), DEB + AppImage (Linux)
- FR8: Global error boundary, offline banner, retry logic with backoff
- NFR: Startup < 3s, bundle < 30MB, encrypted token storage, update check < 2s

## Related Code Files

### New Files
```
src/routes/auth/login/+page.svelte               # Login form
src/routes/auth/register/+page.svelte             # Register form
src/lib/stores/auth.ts                            # Auth state + JWT management
src/lib/services/auth-client.ts                   # Login/register/refresh API
src/lib/components/settings/llm-config.svelte     # Provider + model selector
src/lib/components/settings/theme-toggle.svelte   # Light/dark toggle
src/lib/components/settings/usage-display.svelte  # Token usage progress bars
src/lib/components/shared/error-boundary.svelte   # Global error catch
src/lib/components/shared/offline-banner.svelte   # Offline detection
src-tauri/src/commands/auth.rs                    # Stronghold read/write JWT
proxy/src/middleware/auth.ts                       # JWT verify middleware
proxy/src/middleware/rate-limit.ts                 # Per-user rate limiting
proxy/src/routes/auth.ts                          # Login/register/refresh endpoints
proxy/src/routes/usage.ts                         # Usage stats endpoint
```
### Modified Files
```
src/routes/settings/+page.svelte                  # All settings sections
src/routes/+layout.svelte                         # Error boundary + auth guard
src-tauri/tauri.conf.json                         # Updater, window, bundle config
src-tauri/Cargo.toml                              # Add stronghold, updater plugins
src-tauri/src/main.rs                             # Register auth commands + plugins
proxy/src/index.ts                                # Mount auth + usage routes
proxy/wrangler.toml                               # KV/D1 bindings for usage
```

## Implementation Steps

### Step 1: Rust Secure Store + Auth Commands
1. Add to `Cargo.toml`: `tauri-plugin-stronghold = "2"`, `tauri-plugin-updater = "2"`
2. Register both plugins in `main.rs` builder chain
3. Create `auth.rs` with 3 commands: `store_auth_token`, `get_auth_token`, `clear_auth_token` - all use Stronghold vault for encrypted JWT storage

### Step 2: Proxy Auth Endpoints
1. Create `proxy/src/routes/auth.ts` - 3 endpoints:
   - `POST /auth/register` - hash password (bcrypt cost 12), store in D1, return JWT
   - `POST /auth/login` - verify password, return JWT + refresh token
   - `POST /auth/refresh` - validate refresh token, issue new JWT
   - JWT payload: `{ sub: userId, email, plan: 'free'|'pro', exp }`
2. Create `proxy/src/middleware/auth.ts` - verify JWT via `jose` lib on every `/llm/*` route, extract userId, reject expired with 401
3. Proxy deps: `hono`, `jose`, `bcryptjs`

### Step 3: Frontend Auth Flow
1. `auth-client.ts`: `login()`, `register()`, `logout()`, `refreshToken()` - call proxy, store JWT via Tauri invoke, auto-attach token to LLM requests
2. `auth.ts` store: `isAuthenticated`, `currentUser` writables, `initAuth()` checks Stronghold on mount
3. Login/register pages: simple forms with shadcn `Input` + `Button`, error display
4. Auth guard in `+layout.svelte`: redirect to `/auth/login` if unauthenticated, skip for `/auth/*` routes

### Step 4: Usage Tracking + Rate Limit
1. `proxy/src/routes/usage.ts`: `GET /usage` returns `{ tokensUsed, requestCount, limit, resetDate }`
2. Proxy LLM middleware increments CF KV counters: key `usage:${userId}:${YYYY-MM}`
3. `rate-limit.ts`: Free = 1K req + 500K tokens/mo, Pro = 10K req + 5M tokens/mo, return 429 when exceeded
4. `usage-display.svelte`: progress bars for tokens + requests vs plan limits

### Step 5: Settings Page
1. Expand `settings/+page.svelte` with tab sections: Account, LLM Config, Appearance, Usage, About
2. `llm-config.svelte`: provider dropdown -> dynamic model list, Ollama custom URL input, save to SQLite `settings` table
3. `theme-toggle.svelte`: toggle `dark` class on `<html>`, persist in settings, Tailwind `darkMode: 'class'`

### Step 6: Error Handling & Offline Degradation
<!-- Red Team: No offline degradation model — 2026-02-22 -->
1. `error-boundary.svelte`: catch `unhandledrejection` + `error` events, render error card with retry
2. `offline-banner.svelte`: listen `navigator.onLine` + events, show "Offline - data management only"
3. Retry logic in `auth-client.ts`: 3 retries, exponential backoff (1s/2s/4s), skip on 4xx
4. **Offline degradation model**:
   - CV upload: save raw text locally even if LLM parse fails, queue for re-processing when online
   - Add `pending_operations` table: queue failed embedding/parsing ops, retry on reconnect
   - Candidate CRUD, job management, pipeline drag-drop all work offline (local SQLite)
   - Chat disabled offline with clear message, data browsing enabled

### Step 7: Auto-Update + Packaging
1. Configure `tauri.conf.json` updater: GitHub Releases endpoint + public key
2. Generate signing keys: `tauri signer generate -w ~/.tauri/vibe-recruiter.key`
3. On app mount: `check()` from `@tauri-apps/plugin-updater`, show dialog if update available
4. Generate icons: `npm run tauri icon src-tauri/icons/app-icon.png`
5. Bundle config: targets `["dmg","nsis","deb","appimage"]`, identifier `com.viberecruiter.app`, window 1280x800 min 1024x700

### Step 8: Performance
1. SQLite indexes: `applications(status)`, `applications(job_id)`, `candidates(name)`, `messages(conversation_id)`
2. Rust release profile: `strip = true`, `lto = true`, `codegen-units = 1`
3. Bundle audit: `npx vite-bundle-visualizer`, tree-shake unused shadcn components

## Todo List
- [ ] Add stronghold + updater plugins to Cargo.toml, register in main.rs
- [ ] Implement Rust auth commands (store/get/clear token via Stronghold)
- [ ] Create proxy auth routes (register, login, refresh) + D1 user table
- [ ] Create proxy auth middleware (JWT verify with `jose`)
- [ ] Create `auth-client.ts` + `auth.ts` store
- [ ] Build login + register pages
- [ ] Add auth guard to root layout
- [ ] Create proxy usage tracking (KV counters) + rate-limit middleware
- [ ] Build usage-display component
- [ ] Expand settings page (account, LLM config, theme, usage, about)
- [ ] Build llm-config + theme-toggle components
- [ ] Create error-boundary + offline-banner components
- [ ] Add retry logic to API calls
- [ ] Configure Tauri updater + signing keys
- [ ] Generate app icons + configure bundle targets in tauri.conf.json
- [ ] Add SQLite indexes + optimize Rust release profile
- [ ] Test build on macOS (DMG), Windows (NSIS via CI), Linux (DEB/AppImage via CI)

## Success Criteria
- Login/register e2e: app -> proxy -> D1 -> JWT -> Stronghold -> authenticated requests
- Proxy rejects invalid/expired JWT with 401
- Settings saves/loads LLM config, theme persists across restart
- Usage stats accurate, rate limit returns 429 khi exceed
- Auto-update detects new version, installs successfully
- `tauri build` produces working installers per platform
- Startup < 3s, bundle < 30MB
- Error boundary catches unhandled errors, offline banner shows khi mat mang

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stronghold plugin compat issues | Auth broken | Fallback to `tauri-plugin-store` (less secure) |
| JWT refresh race condition | User logged out | Queue requests, single inflight refresh |
| CF Workers D1 cold start | Slow auth | KV for hot data, D1 for user records |
| macOS code signing | Gatekeeper rejection | Apple Dev account ($99/yr) |
| NSIS antivirus false positive | Install blocked | EV cert + SmartScreen submission |
| Bundle > 30MB | Slow download | `vite-bundle-visualizer`, remove unused deps |

## Security Considerations
- Passwords: bcrypt cost 12, never stored plain
- JWT: access 1h, refresh 7d expiry
- Stronghold: encrypted vault with device-derived key
- CORS: proxy allows app origin only
- No API keys on client - all LLM calls proxied through auth'd server
