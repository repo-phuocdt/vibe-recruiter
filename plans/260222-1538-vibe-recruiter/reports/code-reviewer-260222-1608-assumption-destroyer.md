# Assumption Destroyer Report: Vibe Recruiter Plan

**Date:** 2026-02-22
**Scope:** All 5 phases of `plans/260222-1538-vibe-recruiter/`
**Verdict:** 8 findings -- 2 Critical, 3 High, 3 Medium

---

## Finding 1: Vercel AI SDK `generateText` cannot run client-side against a remote proxy

- **Severity:** Critical
- **Location:** Phase 3, Step 2 "Agent Orchestrator"; Phase 1, Step 4 "Vercel AI SDK Integration"
- **Flaw:** The plan runs `generateText()` from `@ai-sdk/svelte` in the SvelteKit SPA (browser/webview) and points it at the CF Workers proxy. The Vercel AI SDK's `generateText` and `streamText` are **server-side functions** designed for Node.js / Edge runtimes. They use `fetch` internally but also depend on Node/Edge APIs for streaming and tool execution loops. In a Tauri webview (browser context), `generateText` will either fail to import or lose its multi-step tool-call loop capability. The plan explicitly chose "Agent loop in frontend (TS)" (brainstorm decision #4) and `useChat` for streaming, but `useChat` is a client hook that calls a **server route** -- which does not exist in SPA mode (adapter-static). The plan acknowledges this risk for `useChat` (Phase 1 risk table: "bypass SvelteKit server") but does NOT address the deeper issue for `generateText` which has no equivalent bypass.
- **Failure scenario:** Phase 3 implementation begins. Developer imports `generateText` from `ai` in a `.svelte` or `.ts` file bundled for the browser. Either: (a) build fails because `ai` core module references Node APIs (crypto, streams), or (b) it builds but the multi-step tool loop hangs because streaming primitives behave differently in a webview. The entire agent architecture (Phase 3) is blocked. This cascades to Phase 4 (dashboard relies on agent-populated data) and Phase 5 (auth wraps LLM calls).
- **Evidence:** Phase 3 Step 2: `import { generateText } from 'ai';` inside `agent.ts` which is client-side. Brainstorm decision #4: "Frontend (TS)... Vercel AI SDK chay duoc o client". The Vercel AI SDK docs state `generateText` is for "server-side text generation".
- **Suggested fix:** Either (1) add a SvelteKit server route (`+server.ts`) that runs `generateText` on a local dev server and bundle a Node sidecar for production, or (2) replace `generateText` with direct `fetch` calls to the CF Workers proxy implementing the agent loop server-side (proxy receives messages + tool definitions, runs the loop, streams results back), or (3) use the `@ai-sdk/svelte` `useChat` hook with a custom `fetch` pointing at the proxy and implement the tool execution loop manually in the client by intercepting tool call responses and re-submitting.

---

## Finding 2: sqlite-vec cross-compilation is unaddressed for the build matrix

- **Severity:** Critical
- **Location:** Phase 2, Step 1 "vec_embeddings USING vec0"; Plan, Key Dependencies "sqlite-vec extension (cross-platform builds)"
- **Flaw:** sqlite-vec is a C extension that must be compiled or loaded as a shared library per target OS and architecture. The plan uses it as a SQLite virtual table (`CREATE VIRTUAL TABLE ... USING vec0(...)`) which requires the extension to be loaded into the rusqlite connection at runtime. The plan mentions "Pre-build binaries, test on all 3 OS. Fallback: bundle as Tauri resource" in the risk table but provides zero implementation detail. There is no step in any phase that actually builds, bundles, or loads the sqlite-vec shared library. rusqlite's `bundled` feature compiles SQLite from source but does NOT include sqlite-vec. The extension must be separately compiled and loaded via `Connection::load_extension()` or statically linked.
- **Failure scenario:** Phase 2 Step 1 runs fine on the developer's macOS (manually installed sqlite-vec). CI/CD pipeline fails for Windows and Linux targets because the sqlite-vec `.dll`/`.so` is not bundled. Even if manually included, Tauri's resource bundling path differs per platform, and `load_extension` requires `unsafe` and may be blocked by rusqlite's default compile flags (extensions disabled by default).
- **Evidence:** Phase 2 Step 1 schema: `CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(...)`. No step in any phase covers: compiling sqlite-vec, bundling it as a Tauri resource, loading it at runtime in Rust, or enabling the `loadable_extension` feature in rusqlite.
- **Suggested fix:** Add a dedicated implementation step in Phase 2 (before Step 1) that: (a) adds `rusqlite = { features = ["bundled", "loadable_extension"] }`, (b) sets up a build script that compiles sqlite-vec from source for the target triple, (c) copies the resulting `.dylib`/`.dll`/`.so` into `src-tauri/resources/`, (d) adds `load_extension()` call in `db/mod.rs` on init. Alternatively, evaluate `sqlite-vss` or a pure-Rust vector search crate (e.g., `hora`, `usearch`) to avoid the native extension problem entirely.

---

## Finding 3: Embedding dimension hardcoded to 1536 without model-switching strategy

- **Severity:** High
- **Location:** Phase 2, Step 1 schema: `embedding float[1536]`
- **Flaw:** The schema hardcodes `float[1536]` which is the OpenAI `text-embedding-ada-002` / `text-embedding-3-small` default dimension. The plan supports multi-provider LLMs (OpenAI, Claude, Ollama). If the user switches to a different embedding model (e.g., Anthropic's future embeddings, Ollama's `nomic-embed-text` at 768d, or `text-embedding-3-large` at 3072d), all existing embeddings become incompatible. The schema provides no `model` or `dimensions` metadata column. There is no re-embedding migration path.
- **Failure scenario:** User indexes 500 CVs with `text-embedding-3-small` (1536d). Later switches to Ollama for cost savings. Ollama embeddings are 768d. Insert fails (`vec0` expects 1536 floats). User cannot use RAG until they re-index everything, but there is no re-index command in the plan. Alternatively, the plan launches with only OpenAI embeddings, then Anthropic releases an embeddings API -- adding it requires schema migration and full re-index.
- **Evidence:** Phase 2 Step 1: `embedding float[1536]`. No `embedding_model` column. No re-index command in any phase's todo list.
- **Suggested fix:** Add an `embedding_model TEXT` column to `vec_embeddings`. Store the model name with each embedding. On model change, either: (a) prompt user to re-index (add a "Re-index all" command), or (b) maintain separate vec tables per model, or (c) use `text-embedding-3-small` with `dimensions` parameter set to a fixed lower value (e.g., 512) that all providers can match via truncation. Document the chosen strategy.

---

## Finding 4: Auth is deferred to Phase 5 but proxy is deployed public in Phase 1

- **Severity:** High
- **Location:** Phase 1, Step 5 "CF Workers Proxy Server" vs Phase 5 "Auth"
- **Flaw:** Phase 1 deploys the CF Workers proxy with `cors('*')` and a placeholder `authMiddleware` that validates "session token". But the actual auth system (JWT, user registration, Stronghold storage) is not built until Phase 5. For weeks 1-10 (Phases 1-4), the proxy is either: (a) deployed with no real auth (anyone can use your OpenAI API key), or (b) blocked behind a hardcoded token which breaks multi-user plans. The Phase 1 code shows `apiKey: 'session-token'` as a literal string, confirming auth is a stub.
- **Failure scenario:** Developer deploys proxy to CF Workers in Phase 1 to test streaming. The proxy forwards all requests to OpenAI with the developer's API key. A port scanner or leaked URL leads to API key abuse. The developer racks up hundreds of dollars in OpenAI charges before Phase 5 auth is implemented. Alternatively, the developer never deploys the proxy until Phase 5, making Phases 1-3 untestable end-to-end.
- **Evidence:** Phase 1 Step 5 code: `cors()` with no origin restriction. `apiKey: 'session-token'` literal. Phase 5 Step 2: "Create proxy auth routes" -- first time real auth appears.
- **Suggested fix:** Move basic auth to Phase 1. At minimum: (a) restrict CORS to `tauri://localhost` origin, (b) use a shared secret (env var) as bearer token for development, (c) add IP allowlist or Cloudflare Access in front of the worker. Or restructure: build auth in Phase 1 Step 5 instead of generic proxy, then layer LLM routing on top.

---

## Finding 5: No data migration strategy between schema versions

- **Severity:** High
- **Location:** Phase 2, Step 1 "Add migration versioning: check PRAGMA user_version"
- **Flaw:** The plan mentions `PRAGMA user_version` for migration versioning (one sentence) but provides no implementation detail. Phase 1 creates tables (`conversations`, `messages`, `settings`). Phase 2 adds tables (`candidates`, `jobs`, `applications`, `vec_embeddings`). Phase 3 adds a column (`tool_calls` to `messages`). Phase 5 may add more. The plan has no migration runner, no rollback strategy, no handling of failed migrations. `PRAGMA user_version` is a single integer -- it cannot track which migrations ran. If a user upgrades from Phase 1 build to Phase 3 build, all intermediate migrations must run in order, but there is no mechanism for this.
- **Failure scenario:** Beta testers install Phase 1 build. Weeks later they update to Phase 3 build. The app starts, checks `user_version = 1`, needs to run migrations 2 and 3. But migration code assumes tables exist in a specific state. If Phase 2 migration partially fails (e.g., `vec_embeddings` CREATE fails because sqlite-vec not loaded), `user_version` may or may not be updated, leaving the DB in an inconsistent state. User's conversation data from Phase 1 is at risk.
- **Evidence:** Phase 2 Step 1: "Add migration versioning: check PRAGMA user_version truoc khi run migration moi" -- one line, no implementation step. Phase 3 todo: "Add tool_calls column to messages table" -- no migration step defined.
- **Suggested fix:** Add a proper migration system as Step 0 of Phase 1. Options: (a) use `refinery` crate for Rust SQL migrations with numbered `.sql` files, (b) build a simple migration runner that stores applied migrations in a `_migrations` table, runs them in order, wraps each in a transaction. Define the migration file convention and test upgrade path explicitly.

---

## Finding 6: Agent `generateText` is non-streaming; users see no output during multi-step chains

- **Severity:** Medium
- **Location:** Phase 3, Step 2 "Agent Orchestrator"; Risk table "generateText ko support streaming giua tool calls"
- **Flaw:** The plan uses `generateText` (not `streamText`) for the agent loop. `generateText` returns only after ALL steps complete. For a multi-step chain like "find top 5 candidates -> rank them -> draft emails", the user sees nothing for 15-30+ seconds (multiple LLM calls + tool executions). The plan's `onStepFinish` callback fires BETWEEN steps but the initial LLM thinking time within each step produces no output. The risk table acknowledges this but proposes "Future: switch to streamText" -- deferring a core UX problem for a recruiter-facing product.
- **Failure scenario:** User asks "Find and rank the best 5 frontend developers and draft outreach emails." The agent needs 4-5 steps. Each step takes 3-8 seconds. User stares at a spinner for 20-40 seconds with zero feedback. They think the app is frozen. They close and reopen. For a "startup product quality UX" (brainstorm NFR), this is unacceptable at launch.
- **Evidence:** Phase 3 Step 2: `await generateText({...})` -- this is a blocking call. Risk table: "Dung onStepFinish callback de update UI after each step. Future: switch to streamText khi AI SDK ho tro". Brainstorm NFR: "Startup product quality UX".
- **Suggested fix:** Use `streamText` from the start, which already supports `maxSteps` and streaming between tool calls as of AI SDK v4. If client-side constraints block `streamText` (see Finding 1), implement a server-side streaming endpoint in the proxy that runs the agent loop and streams SSE events (text chunks + tool call indicators) back to the client.

---

## Finding 7: `rank_candidates` tool has no ranking algorithm -- it just loads data for the LLM

- **Severity:** Medium
- **Location:** Phase 3, Step 4 "Rust Support Commands"; Tool table
- **Flaw:** The plan describes `rank_candidates` as a Rust command that "load job requirements + candidate parsed_data, return Vec<RankedCandidate> cho LLM compare". This means the Rust command does NOT rank -- it fetches data and returns it for the LLM to compare in the next step. For a job with 100+ candidates, this means sending all 100 candidates' parsed data as tool results back to the LLM context window. At ~500 tokens per candidate, that is 50K tokens in a single tool result -- exceeding most models' practical context limits and costing $0.50+ per query with GPT-4o.
- **Failure scenario:** Recruiter has 200 candidates for a "Senior React Developer" role. Agent calls `rank_candidates(jobId, candidateIds)`. Rust loads all 200 candidates' parsed data. Returns it as tool result. LLM receives 100K+ tokens of candidate data. Either: (a) exceeds context window and errors, (b) model truncates and misses candidates, or (c) response costs $2+ and takes 30+ seconds.
- **Evidence:** Phase 3 Step 4: "load job requirements + candidate parsed_data, return Vec<RankedCandidate> cho LLM compare". No filtering, no pre-scoring, no pagination.
- **Suggested fix:** Implement actual ranking in Rust: (a) use embedding cosine similarity between job requirements and candidate parsed_data to pre-score, (b) return only top-K (e.g., 10) candidates to the LLM with scores, (c) LLM refines ranking with qualitative assessment. This keeps context window small and cost low.

---

## Finding 8: No offline behavior specification despite "offline-capable" requirement

- **Severity:** Medium
- **Location:** Phase 5, Step 6 "Error Handling & Offline"; Brainstorm NFR "Offline-capable cho data management"
- **Flaw:** The brainstorm states "Offline-capable cho data management (khong cho AI chat)" as a non-functional requirement. Phase 5 adds an "offline banner" component that shows "Offline - data management only". But no phase defines what "data management" works offline. The plan makes critical operations depend on the proxy even for non-AI tasks: CV parsing calls the proxy for LLM structured extraction (Phase 2 Step 4), embeddings require the proxy (Phase 2 Step 5), ranking loads data for LLM comparison (Phase 3). The only truly offline operations are SQLite CRUD -- but even creating a candidate requires CV parsing which requires the proxy. There is no queue/retry mechanism for operations started offline.
- **Failure scenario:** Recruiter is at a job fair with spotty wifi. They try to add a candidate by uploading a CV. The upload succeeds (local file copy) but parsing fails (no proxy connection for LLM extraction). The candidate is created with empty `parsed_data`. No embeddings are generated. The candidate is invisible to RAG search. The recruiter does not realize the data is incomplete until they are back online and try to search. There is no "pending parse" queue or indicator.
- **Evidence:** Phase 2 Step 4: `extract_structured_data(raw_text, proxy_url)` -- requires proxy. Phase 5 Step 6: `offline-banner.svelte: "Offline - data management only"` -- no definition of what management works. Brainstorm: "Offline-capable cho data management".
- **Suggested fix:** Define explicitly which operations work offline and which are degraded. Add a "pending operations" queue: CV uploads are saved locally, parsed when connectivity returns. Show clear status per candidate: "Parsed" vs "Pending parse". Add an `onReconnect` handler that processes the queue. Alternatively, drop the "offline-capable" claim from requirements if not delivering it.

---

## Unresolved Questions

1. Has the team verified that Vercel AI SDK v4+ `generateText`/`streamText` can execute in a Tauri webview (Chromium/WebKit) context without Node.js APIs? This is the single biggest technical risk in the plan.
2. What is the sqlite-vec build/bundle strategy for CI? Is there a pre-built binary source or does it need compilation per target?
3. Who manages the CF Workers proxy API keys during development? Is there a shared dev environment or does each developer deploy their own worker?
4. What happens to user data if they downgrade app versions? The migration strategy only covers upgrades.
5. What is the Ollama integration path? The brainstorm mentions it ("Ollama chay local, khong qua proxy") but no phase implements direct Ollama connection logic -- all LLM calls go through the proxy.
