# Deployment Guide - Vibe Recruiter

## Overview

Vibe Recruiter is deployed across three layers: desktop app (Tauri + SvelteKit), proxy service (CloudFlare Workers), and supporting databases. This guide covers Phase 5 deployment with authentication.

## Desktop App Deployment (Tauri)

### Prerequisites
- Node.js 20+
- Rust 1.70+
- pnpm package manager
- Tauri v2 CLI

### Build Steps

1. Install dependencies:
```bash
pnpm install
```

2. Verify TypeScript:
```bash
pnpm check
```

3. Build the desktop app:
```bash
pnpm tauri build
```

The compiled binary will be in `src-tauri/target/release/`.

### Configuration Files

**tauri.conf.json** - Desktop app configuration:
- Window dimensions: 1280x800px
- Minimum window size: 1024x700px
- Bundle identifier: `com.vibe-recruiter.app`

**src-tauri/Cargo.toml** - Rust dependencies:
- `tauri` - Desktop framework
- `rusqlite` - SQLite driver
- `serde_json` - JSON serialization
- `tauri-plugin-store` - Encrypted token storage

### Plugin Registration

Ensure `src-tauri/src/main.rs` registers the store plugin:
```rust
.plugin(tauri_plugin_store::Builder::default().build())
```

## Frontend (SvelteKit) Configuration

### Build Optimization

Tauri automatically builds the SvelteKit frontend. Ensure `svelte.config.js` specifies Tauri adapter:
```javascript
import adapter from '@sveltejs/adapter-tauri';
```

### Environment Variables (Frontend)

Create `.env.local` for development (NOT committed to repo):
```
VITE_PROXY_URL=http://localhost:8787
```

For production, set via Tauri environment or CI/CD secrets.

## Proxy Service Deployment (CloudFlare Workers)

### Prerequisites
- Wrangler CLI (CloudFlare)
- CloudFlare account with Workers enabled
- D1 database (SQLite) for users table
- KV namespace for rate limiting & token storage

### Setup Steps

1. Authenticate with CloudFlare:
```bash
wrangler login
```

2. Create D1 database:
```bash
wrangler d1 create vibe-recruiter
```

3. Create KV namespace:
```bash
wrangler kv:namespace create RATE_LIMIT
```

4. Update `wrangler.toml`:
```toml
[env.production]
d1_databases = [
  { binding = "DB", database_id = "YOUR_DATABASE_ID" }
]
kv_namespaces = [
  { binding = "RATE_LIMIT", id = "YOUR_KV_ID" }
]
```

### Required Environment Variables

Set these in CloudFlare Workers secrets (do NOT commit):

```bash
wrangler secret put JWT_SECRET
wrangler secret put PROXY_API_KEY
wrangler secret put SERPER_API_KEY
```

**JWT_SECRET** (Phase 5):
- Used for signing & verifying JWT tokens
- Must be a strong random string (32+ characters recommended)
- Example: `openssl rand -base64 32`
- **CRITICAL:** Different from PROXY_API_KEY; never reuse

**PROXY_API_KEY**:
- Legacy API key for backward compatibility
- Still accepted by auth middleware
- Phase 5: JWT is preferred, but PROXY_API_KEY still works

**SERPER_API_KEY**:
- API key from Serper.dev for web search
- Required only if using search tool

### Database Schema

Create users table in D1:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  api_key TEXT,
  plan TEXT DEFAULT 'free',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
```

### Deploy Proxy

1. Build and publish:
```bash
wrangler publish
```

2. Verify deployment:
```bash
curl https://your-worker-domain.dev/health
```

Response should show environment status.

## Authentication Flow (Phase 5)

### User Registration
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (201):
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "uuid", "email": "user@example.com", "plan": "free" }
}
```

### User Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "uuid", "email": "user@example.com", "plan": "pro" }
}
```

### Token Refresh
```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}

Response (200):
{
  "accessToken": "eyJ...",
  "user": { "id": "uuid", "email": "user@example.com", "plan": "free" }
}
```

### Protected Endpoints
Include JWT token in Authorization header:
```
Authorization: Bearer {accessToken}
```

Accepted by all `/v1/*` and `/usage` endpoints.

## Backward Compatibility

Phase 5 maintains backward compatibility with Phase 1-4 deployments:

1. **JWT OR PROXY_API_KEY**: Auth middleware accepts both
2. **New Users**: Register via `/auth/register` or use PROXY_API_KEY directly
3. **Legacy Integration**: Old clients using PROXY_API_KEY continue to work
4. **No Breaking Changes**: Existing chat/search endpoints unchanged

## Usage Tracking (Phase 5)

### Plan Limits
- **Free**: 1,000 requests/month, 500K tokens/month
- **Pro**: 10,000 requests/month, 5M tokens/month

### Monthly Reset
- Counters reset on the 1st of each month (UTC)
- Tracked per user in KV cache: `usage:{userId}:{YYYY-MM}:{req|tok}`

### Rate Limiting
Enforced when user exceeds monthly limit:
```
HTTP 429 Too Many Requests
Content-Type: application/json

{
  "error": "Monthly limit exceeded",
  "limit": 1000,
  "current": 1005,
  "resetDate": "2026-03-01T00:00:00Z"
}
```

## Security Checklist

### Before Production
- [ ] JWT_SECRET set to strong random value (32+ chars)
- [ ] PROXY_API_KEY configured (for backward compat)
- [ ] SERPER_API_KEY set if using web search
- [ ] D1 database has users table with password_hash
- [ ] KV namespace created for RATE_LIMIT
- [ ] CORS configured for your app origin only
- [ ] HTTPS enforced on all endpoints
- [ ] Database backups configured

### Token Security
- Access tokens: 1 hour expiration
- Refresh tokens: 7 day expiration
- Refresh tokens stored in KV (revocable)
- Passwords: PBKDF2 SHA-256 (100K iterations)
- Constant-time comparison for auth checks

### Frontend Security
- Tokens stored in Tauri Plugin Store (encrypted)
- initAuth() on app mount (silent failure if offline)
- Error boundary catches unhandled rejections
- Offline banner shows when disconnected

## Monitoring & Debugging

### Check Worker Logs
```bash
wrangler tail
```

### Test Auth Endpoint
```bash
curl -X POST https://your-worker.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test"}'
```

### Verify JWT_SECRET
```bash
wrangler secret list
# Should show JWT_SECRET in the list
```

### Check D1 Schema
```bash
wrangler d1 execute vibe-recruiter --remote --sql "SELECT * FROM users LIMIT 1;"
```

## Rollback Strategy

If Phase 5 deployment has issues:

1. **Frontend**: Rebuild desktop app with previous version
2. **Proxy**: Rollback worker with `wrangler rollback`
3. **Database**: D1 backups available via CloudFlare dashboard
4. **Tokens**: Clear `.auth.dat` on client devices if token issues

## Next Steps

After Phase 5 deployment:
1. Test registration/login flow end-to-end
2. Verify usage tracking increments monthly
3. Monitor worker logs for errors
4. Load test with concurrent users
5. Document any custom integrations

## Support & Troubleshooting

### User Can't Login
- Check email exists in users table: `SELECT email FROM users;`
- Verify password hash stored: `SELECT password_hash FROM users WHERE email = ?;`
- Check JWT_SECRET configured: `wrangler secret list`

### Tokens Not Stored
- Verify Tauri Plugin Store registered in main.rs
- Check `.auth.dat` permissions in app data directory
- Ensure encryption supported on target platform

### Usage Not Tracking
- Verify KV namespace bound in wrangler.toml
- Check userId extracted correctly from JWT
- Verify monthly keys format: `usage:{userId}:{YYYY-MM}:req`

### Rate Limit Not Working
- Ensure RATE_LIMIT KV namespace configured
- Check monthly reset date calculation
- Verify counters incrementing on each request
