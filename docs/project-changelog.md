# Project Changelog - Vibe Recruiter

## Phase 5: Polish & Launch (Completed - Feb 23, 2026)

### New Features
- **Authentication System**
  - User registration & login via proxy endpoints with PBKDF2 password hashing
  - JWT auth tokens with refresh mechanism
  - Token storage in Tauri Store (encrypted)

- **Authorization & Rate Limiting**
  - Proxy JWT middleware for `/llm/*` and `/usage` endpoints
  - Per-user monthly usage tracking via CloudFlare KV
  - Rate limit enforcement: Free (1K requests, 500K tokens/mo), Pro (10K requests, 5M tokens/mo)

- **Settings & User Management**
  - Account section in settings page
  - Usage statistics display with token & request counters
  - Monthly usage reset tracking

- **Error Handling & Offline Support**
  - Global error boundary component with retry mechanism
  - Offline detection banner with status indicator
  - Automatic detection of network status changes
  - Read-only mode when offline (data browsing enabled, chat disabled)

- **Performance & Window Management**
  - Window sizing: 1280×800px with 1024×700px minimum
  - Release profile optimizations: LTO, strip binary, single codegen unit
  - Startup performance target met

### Backend Changes
- **New File:** `proxy/src/routes/auth.ts`
  - `POST /auth/register` - User registration with PBKDF2 hashing
  - `POST /auth/login` - JWT token issuance with refresh tokens
  - `POST /auth/refresh` - Token refresh endpoint
  - `POST /auth/logout` - Token invalidation

- **New File:** `proxy/src/routes/usage.ts`
  - `GET /usage` - Monthly usage stats per user
  - Integration with CloudFlare KV for tracking

- **New File:** `proxy/src/jwt-secret.ts`
  - Shared JWT secret management
  - Validation that JWT_SECRET is configured

- **Updated Files:**
  - `proxy/src/auth-middleware.ts` - Extended to accept JWT OR PROXY_API_KEY (backward-compatible)
  - `proxy/src/rate-limiter.ts` - Monthly usage tracking in KV
  - `proxy/src/index.ts` - Auth & usage routes mounted
  - `src-tauri/Cargo.toml` - Added `tauri-plugin-store` dependency
  - `src-tauri/tauri.conf.json` - Window config with dimensions & minimum size
  - `src-tauri/src/main.rs` - Plugin registration

- **Migration:** `src-tauri/migrations/0002_update_users_auth.sql`
  - Added `password_hash` column to users table
  - Added `plan` column for subscription tiers

### Frontend Changes
- **New Files:**
  - `src/lib/types.ts` - AuthUser, AuthTokens, UsageStats types
  - `src/lib/services/auth-client.ts` - Login/register/refresh/logout/getUsage API client
  - `src/lib/stores/auth-store.svelte.ts` - Auth state management with Svelte 5 runes
  - `src/routes/auth/login/+page.svelte` - Login form
  - `src/routes/auth/register/+page.svelte` - Registration form
  - `src/lib/components/shared/error-boundary.svelte` - Error catch & recovery UI
  - `src/lib/components/shared/offline-banner.svelte` - Network status indicator
  - `src/lib/components/settings/usage-display.svelte` - Usage stats visualization

- **Updated Files:**
  - `src/lib/services/ai-client.ts` - JWT token parameter for authenticated requests
  - `src/routes/+layout.svelte` - ErrorBoundary + OfflineBanner + auth initialization
  - `src/routes/+page.svelte` - JWT token passed to chat provider
  - `src/routes/settings/+page.svelte` - Account & Usage sections

### Type System Changes
- `AuthUser` - User record with email, plan tier
- `AuthTokens` - Access & refresh token pair
- `UsageStats` - Monthly usage metrics

### Performance Improvements
- Rust release profile: `lto = true`, `strip = true`, `codegen-units = 1`
- Reduced binary size & startup time
- Window pre-sized for optimal desktop use

### Security Enhancements
- Passwords hashed with PBKDF2 (non-plaintext storage)
- JWT tokens with expiry (1h access, 7d refresh)
- Encrypted token storage via Tauri Store
- Auth middleware validates JWT on protected routes
- CORS configured for app origin only

### Testing Considerations
- Auth flow: register → login → JWT received → token stored → refresh works
- Offline: network disconnect → banner shows → chat disabled, data browsable
- Error boundary catches unhandled rejections & displays retry UI
- Usage tracking: monthly counters accurate per user & plan tier
- Rate limiting returns 429 when monthly limits exceeded

---

## Phase 4: Dashboard & Recruitment Management (Completed - Feb 23, 2025)

### New Features
- **Recruitment Dashboard** (`/dashboard` route)
  - Real-time metrics: total candidates, active jobs, total applications, hired count
  - Pipeline stage distribution chart with visual breakdown
  - One-click navigation to detailed views

- **Kanban Pipeline Board**
  - 6 stages: new, screening, interview, offer, hired, rejected
  - Drag-and-drop candidate movement with `svelte-dnd-action`
  - Optimistic UI updates via `dashboard-store.svelte.ts`
  - Individual candidate cards with name, email, job title, creation date

- **Candidate & Job Detail Pages**
  - `/candidates/[id]` - Detailed candidate profile with action buttons
  - `/jobs/[id]` - Job details with associated candidates
  - Links from dashboard cards to detail views

- **Analytics Module**
  - Candidates per job bar chart (top 10 jobs)
  - Pipeline stage distribution visualization
  - `simple-bar-chart.svelte` reusable chart component

- **Layout Improvements**
  - New `sidebar-nav.svelte` top navigation bar with route links
  - Consistent navigation across all pages
  - Chat list confined to chat page only (reduces sidebar clutter)

### Backend Changes
- **New File:** `src-tauri/src/commands/analytics.rs` (260 lines)
  - `get_dashboard_stats()` - Returns DashboardStats struct with all metrics
  - `get_pipeline_candidates(stage?)` - List all or filtered pipeline candidates
  - `update_candidate_stage(application_id, new_stage)` - Move candidate through pipeline with validation
  - `get_analytics_data()` - Aggregated metrics for charts
  - `create_application(candidate_id, job_id)` - Create new application record
  - `get_job_applications(job_id)` - List all candidates applied to a job

- **Database Migration 4:** `src-tauri/src/db/migrations.rs`
  - `CREATE INDEX idx_applications_status` - Optimize stage filtering queries
  - `CREATE INDEX idx_applications_job_id` - Optimize job filtering
  - `CREATE INDEX idx_applications_candidate_id` - Optimize candidate filtering

### Frontend Changes
- **New Store:** `src/lib/stores/dashboard-store.svelte.ts`
  - Manages dashboard UI state (selected stage filter, drag-drop updates)
  - Optimistic updates for stage changes

- **New Components:**
  - `src/lib/components/dashboard/stats-cards.svelte` - Displays 4 key metrics
  - `src/lib/components/dashboard/pipeline-board.svelte` - Kanban board with drag-drop (svelte-dnd-action)
  - `src/lib/components/dashboard/candidate-pipeline-card.svelte` - Card component for each candidate
  - `src/lib/components/analytics/simple-bar-chart.svelte` - Bar chart visualization
  - `src/lib/components/layout/sidebar-nav.svelte` - Top navigation bar

- **New Routes:**
  - `src/routes/dashboard/+page.svelte` - Dashboard entry point
  - `src/routes/candidates/[id]/+page.svelte` - Candidate detail page
  - `src/routes/jobs/[id]/+page.svelte` - Job detail page

- **Layout Refactoring:**
  - `src/routes/+layout.svelte` - Updated to include sidebar-nav globally
  - `src/lib/components/layout/app-layout.svelte` - Updated with new layout structure
  - `src/lib/components/chat/` - Chat list now only on chat page (`src/routes/+page.svelte`)

### Dependencies Added
- `lucide-svelte@^0.x` - Icon library for UI elements
- `svelte-dnd-action@^0.x` - Drag-and-drop functionality for pipeline board

### Type System Changes
- New Rust types in `analytics.rs`:
  - `DashboardStats` - Aggregated recruitment metrics
  - `StageCount` - Pipeline stage distribution
  - `PipelineCandidate` - Full candidate record with job context
  - `AnalyticsData` - Chart data structure
  - `JobCandidateCount` - Candidates per job count

### Data Model Enhancements
- No schema changes (uses existing applications table structure)
- Indexes improve query performance for dashboard-heavy workflows
- Applications table now optimized for filtering by status, job, and candidate

### Performance Improvements
- Migration 4 indexes reduce O(n) queries to O(log n) for large pipelines
- Dashboard queries return paginated/limited results
- Sidebar-nav reduces layout re-renders by separating nav from chat state

### Testing Considerations
- All 6 analytics commands return properly typed Rust structs
- Stage validation enforces 6 valid stages (prevents invalid state transitions)
- Drag-drop updates persist via `update_candidate_stage` command
- Chart data endpoints aggregate from large applications tables efficiently

---

## Phase 3: AI Agent Tools & Tool Calling (Completed - Feb 23, 2025)

### New Features
- Agentic tool system with 6 tools:
  - `searchCandidates` - Vector similarity search
  - `rankCandidates` - Job relevance ranking
  - `parseCV` - PDF CV extraction
  - `draftEmail` - Professional email composition
  - `searchWeb` - Web search via Serper.dev
  - `generateReport` - Pipeline statistics & summaries

- Multi-step agent loops (up to 10 steps per request)
- Tool execution indicators in chat UI
- Expandable tool result display
- Message persistence includes tool_calls JSON

### Backend Changes
- `commands/candidates.rs` - Candidate ranking by job relevance
- `commands/jobs.rs` - Job reports & pipeline analytics
- `commands/embeddings.rs` - Vector similarity search operations
- Migration 3: Added `tool_calls TEXT` column to messages table

### Frontend Changes
- `agent.ts` - Agent orchestrator with streamText + tool calling
- `tools/` directory with 6 tool definitions (Zod schemas)
- `chat-manager.ts` - Streaming chat with tool support
- `tool-indicator.svelte` - Tool execution status badge
- `tool-result.svelte` - Expandable tool result display
- `rag.ts` - RAG context generation for agent

### Dependencies Added
- `ai` v6+ - Vercel AI SDK with tool calling
- `zod` v4 - Schema validation for tool inputs

---

## Phase 2: RAG & Vector Embeddings (Completed - Feb 23, 2025)

### New Features
- Candidate & job data ingestion
- PDF CV parsing
- Vector embeddings for semantic search
- Embedding chunks table for RAG retrieval

### Backend Changes
- Migration 2: Added candidates, jobs, applications, embedding_chunks tables
- Commands: candidates.rs, jobs.rs, embeddings.rs

### Frontend Changes
- `rag.ts` - Context generation for embeddings
- `candidates-store.ts`, `jobs-store.ts` - Data management

---

## Phase 1: Core Chat & Conversation Persistence (Completed - Feb 23, 2025)

### Initial Features
- Claude-style chat UI with Svelte 5 runes
- Multi-provider LLM support (OpenAI, Claude, Ollama)
- SQLite conversation & message persistence
- Settings page with model/provider configuration
- CloudFlare Workers proxy with auth & rate limiting

### Backend Changes
- Migration 1: conversations, messages, settings tables
- `commands/conversations.rs` - CRUD operations

### Frontend Changes
- `chat-store.svelte.ts`, `settings-store.svelte.ts` - Reactive state
- Chat UI components with markdown rendering
- Dark theme support

---

## Version History

| Version | Phase | Date | Status |
|---------|-------|------|--------|
| v0.5.0 | Phase 5 | Feb 23, 2026 | Complete |
| v0.4.0 | Phase 4 | Feb 23, 2025 | Complete |
| v0.3.0 | Phase 3 | Feb 23, 2025 | Complete |
| v0.2.0 | Phase 2 | Feb 23, 2025 | Complete |
| v0.1.0 | Phase 1 | Feb 23, 2025 | Complete |
