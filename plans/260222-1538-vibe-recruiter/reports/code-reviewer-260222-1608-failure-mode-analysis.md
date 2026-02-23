# Failure Mode Analysis - Vibe Recruiter Plan

**Analyst:** code-reviewer (Failure Mode Analyst)
**Date:** 2026-02-22
**Scope:** All 5 phases of the Vibe Recruiter implementation plan
**Verdict:** 7 findings -- 2 Critical, 3 High, 2 Medium

---

## Finding 1: Auth bootstrapped last -- entire app runs unauthenticated through Phases 1-4

- **Severity:** Critical
- **Location:** Phase 5, Step 2-3 ("Proxy Auth Endpoints", "Frontend Auth Flow"); Phase 1, Step 5 ("CF Workers Proxy Server")
- **Flaw:** Auth (JWT, login/register, Stronghold) is deferred to Phase 5. Phases 1-4 build the proxy, chat, RAG, agent tools, and dashboard with zero authentication. The Phase 1 proxy uses a placeholder `apiKey: 'session-token'` (Phase 1 Step 4 code snippet). This means the LLM proxy, embedding endpoint, and web search endpoint are all publicly accessible for 10+ weeks of development.
- **Failure scenario:** (1) During dev, the CF Workers proxy is deployed (Phase 1 Step 5.4: `pnpm wrangler deploy`) with `cors('*')` and no auth middleware. Anyone who discovers the URL can make unlimited LLM API calls billed to the developer's OpenAI/Anthropic keys. (2) When auth is finally bolted on in Phase 5, every existing frontend service (`ai-client.ts`, `rag.ts`, `agent.ts`, embedding calls in Rust) must be retrofitted to attach JWT tokens. This is a cross-cutting change touching nearly every file -- high risk of breaking working features. (3) No migration path described for existing data (conversations, candidates) that were created without user association.
- **Evidence:** Phase 1 Step 5 code: `app.use('*', cors());` with no auth. Phase 1 Step 4: `apiKey: 'session-token'` hardcoded. Phase 5 Step 3: "auto-attach token to LLM requests" -- implies rewriting all existing callers.
- **Suggested fix:** Implement auth skeleton in Phase 1 alongside the proxy. At minimum: (a) deploy proxy behind a static API key from day 1 stored in CF secrets, (b) design all data models with a `user_id` column from Phase 2 onward, (c) add auth middleware to proxy in Phase 1 even if login UI comes later (use dev tokens). This avoids the costly retrofit and prevents key exposure.

---

## Finding 2: No data migration strategy -- schema changes across phases will destroy existing data

- **Severity:** Critical
- **Location:** Phase 2, Step 1 ("Extend SQLite Schema"); Phase 1, Step 2 ("DB + Commands")
- **Flaw:** Phase 1 creates `conversations`, `messages`, `settings` tables. Phase 2 adds `candidates`, `jobs`, `applications`, `vec_embeddings`. Phase 3 adds a `tool_calls` column to `messages`. Phase 5 adds SQLite indexes. The plan mentions `PRAGMA user_version` for migration versioning (Phase 2 Step 1.2) but provides zero detail on the migration system itself -- no up/down scripts, no migration runner, no handling of destructive schema changes.
- **Failure scenario:** Developer tests Phase 1 with real conversations. Phase 2 deployment runs `CREATE TABLE IF NOT EXISTS` which is fine for new tables, but Phase 3's `tool_calls` column addition to existing `messages` table requires `ALTER TABLE`. If the migration system is not built properly in Phase 1, Phase 3 either (a) fails silently because `ALTER TABLE` is never run, (b) drops and recreates the table losing all message history, or (c) requires manual intervention. There is no rollback mechanism if a migration corrupts data.
- **Evidence:** Phase 2 Step 1.2: "Add migration versioning: check `PRAGMA user_version` truoc khi run migration moi" -- single line, no implementation detail. Phase 3 todo: "Add tool_calls column to messages table" -- ALTER TABLE on populated table with no migration code shown.
- **Suggested fix:** Phase 1 must include a concrete migration framework: (a) numbered migration files (001_init.sql, 002_candidates.sql, etc.), (b) migration runner that applies pending migrations in order within a transaction, (c) backup before migration, (d) `ALTER TABLE` statements for column additions. Define this in Phase 1 Step 2 before any tables are created.

---

## Finding 3: `generateText` used instead of `streamText` -- agent mode has no streaming, UX will feel broken

- **Severity:** High
- **Location:** Phase 3, Step 2 ("Agent Orchestrator"); Phase 1, Step 4 (uses `useChat` with streaming)
- **Flaw:** Phase 1 builds chat with `useChat` which streams tokens. Phase 3 switches to `generateText()` for agent mode which is a non-streaming, blocking call. The user sends a message and sees nothing until the entire multi-step agent loop completes (potentially 10 tool calls, each taking seconds). The `onStepFinish` callback only fires between steps, not during text generation. The risk assessment acknowledges this: "generateText ko support streaming giua tool calls."
- **Failure scenario:** User asks "find top 5 React developers and draft outreach emails." The agent executes: search_candidates -> rank_candidates -> draft_email (x5). With 10 LLM calls at ~3-5s each plus tool execution, the user stares at a blank screen for 30-50 seconds. The `onTextChunk` callback in the code only fires on `onStepFinish`, not incrementally. Users will assume the app is frozen and kill it. This is especially bad because Phase 1 already trained them to expect streaming.
- **Evidence:** Phase 3 Step 2 code: `const { text, toolCalls, toolResults } = await generateText({...})` -- this is a promise that resolves only after ALL steps complete. `onStepFinish` fires per-step, not per-token.
- **Suggested fix:** Use `streamText()` instead of `generateText()`. Vercel AI SDK v4+ supports `streamText` with tool calling and `maxSteps`. This gives per-token streaming between tool calls. The `onStepFinish` still fires for tool boundaries. If `streamText` with tools is not yet stable, at minimum implement a loading skeleton that shows which step/tool is currently executing (more than just a spinner -- show "Searching candidates... found 12 results" progress).

---

## Finding 4: Candidate ranking done in Rust without LLM -- will produce garbage results

- **Severity:** High
- **Location:** Phase 3, Step 4 ("Rust Support Commands"); Phase 3, Step 1 tool table
- **Flaw:** The `rank_candidates` tool calls `invoke('rank_candidates')` which is a Rust command that "loads job requirements + candidate parsed_data, return `Vec<RankedCandidate>` cho LLM compare." The Rust command returns data for the LLM to compare, but the tool's `execute` function directly returns the Rust result. There is no LLM reasoning step inside the tool -- the LLM only sees the raw data after the tool returns.
- **Failure scenario:** The ranking Rust command does a naive comparison (keyword matching? field overlap?) between `parsed_data` JSON and job requirements. Without semantic understanding, a candidate with "React Native" experience won't match a "React" requirement. The tool returns `Vec<RankedCandidate>` with scores, but those scores are meaningless without LLM evaluation. The agent then presents these bad rankings to the user as authoritative. Worse, the plan says "cho LLM compare" but the implementation shows the Rust command returning directly -- there is a design ambiguity that will lead to a half-baked implementation.
- **Evidence:** Phase 3 Step 4.1: "load job requirements + candidate parsed_data, return `Vec<RankedCandidate>` cho LLM compare." The tool definition in Step 1 table: `rank_candidates -> invoke('rank_candidates')` with no intermediate LLM call.
- **Suggested fix:** Clarify the design: either (a) the Rust command returns raw data and the tool's `execute` function calls the LLM to score/rank (making it a two-step tool: fetch data + LLM evaluate), or (b) the Rust command just fetches candidate data and the agent's natural multi-step reasoning handles comparison (remove ranking from Rust, let the LLM do it as a reasoning step). Option (b) is simpler and more accurate.

---

## Finding 5: sqlite-vec cross-platform build is hand-waved -- no concrete build/bundle strategy

- **Severity:** High
- **Location:** Phase 2, Step 1 (schema uses `vec0`); Plan overview ("Key Dependencies")
- **Flaw:** sqlite-vec is a SQLite extension that requires a native shared library (`.dylib`/`.dll`/`.so`) loaded at runtime. The plan uses `CREATE VIRTUAL TABLE ... USING vec0(...)` but never describes how sqlite-vec gets built, bundled with the Tauri app, or loaded into the rusqlite connection. The risk assessment says "Pre-build binaries, test on all 3 OS. Fallback: bundle as Tauri resource" but this is not an implementation plan.
- **Failure scenario:** Developer gets it working on macOS during development. The CI/CD pipeline (not described in any phase) attempts to build for Windows and Linux. sqlite-vec fails to compile or the extension is not found at runtime because (a) the load path differs per OS, (b) the extension binary is not included in the Tauri bundle resources, (c) rusqlite's `load_extension` is disabled by default for security. The app ships, users on Windows get a crash on first CV upload because vec_embeddings table does not exist.
- **Evidence:** Phase 2 Step 1 SQL: `CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(...)` -- requires extension loaded first. No code or step anywhere in Phase 1 or 2 showing `conn.load_extension()` or Cargo feature flags for sqlite-vec. Risk table: "Pre-build binaries" -- no build script, no CI config, no resource bundling step.
- **Suggested fix:** Add a dedicated step in Phase 2 (before schema creation) for sqlite-vec integration: (a) document how to build sqlite-vec for each target, (b) add `build.rs` script or Tauri resource bundling for the extension binary, (c) implement `conn.load_extension("sqlite-vec")` with error handling and a fallback message, (d) add this to Phase 5's CI/CD build matrix. Alternatively, evaluate `sqlite-vss` as a Rust-native alternative that compiles with rusqlite.

---

## Finding 6: No offline/degraded mode for LLM-dependent features -- app becomes useless without internet

- **Severity:** Medium
- **Location:** Phase 5, Step 6 ("Error Handling & Offline"); Phase 2 (CV parsing uses LLM); Phase 3 (all agent tools need LLM)
- **Flaw:** Phase 5 adds an `offline-banner.svelte` that shows "Offline - data management only." But the plan never defines what "data management only" means or how LLM-dependent features degrade. CV parsing (Phase 2 Step 4) requires LLM for structured extraction. Embedding generation requires the proxy. Agent tools all require LLM calls. RAG search requires embedding the query. Even viewing existing candidates works, but the core value proposition (AI chat) is completely broken offline.
- **Failure scenario:** Recruiter is at a career fair with spotty WiFi. They upload a CV -- the PDF text extraction works (local Rust), but the LLM structured extraction fails silently or throws an unhandled error. The candidate is created with null `parsed_data`. No embeddings are generated. Later when back online, there is no retry queue -- the CV must be manually re-processed. The user has a candidate with no parsed skills, no embeddings, invisible to RAG search.
- **Evidence:** Phase 5 Step 6.2: "show 'Offline - data management only'" -- no definition of graceful degradation per feature. Phase 2 Step 4 pipeline: "upload -> extract text -> LLM parse -> save" -- no fallback if LLM parse fails. No retry/queue mechanism for failed operations anywhere in the plan.
- **Suggested fix:** (a) Define per-feature degradation: CV upload should save raw text even if LLM parsing fails, with a "pending parse" flag and background retry queue. (b) Add an operation queue (`pending_operations` table) that stores failed LLM-dependent operations and retries when connectivity returns. (c) For search, fall back to SQLite FTS on raw text when embeddings are unavailable.

---

## Finding 7: Chat state architecture switches mid-project -- `useChat` (Phase 1) vs `runAgent` (Phase 3) with no unified model

- **Severity:** Medium
- **Location:** Phase 3, Step 6.4 ("chat-panel switch giua useChat va runAgent"); Phase 1, Step 4 (useChat integration)
- **Flaw:** Phase 1 builds the entire chat around Vercel AI SDK's `useChat` hook which manages its own message state, streaming, and API calls. Phase 3 introduces `runAgent()` using `generateText` with a completely different state management pattern (manual callbacks, no built-in streaming). Phase 3 Step 6.4 says "switch giua useChat (simple) va runAgent (agent mode)" but does not describe (a) how the user switches modes, (b) how message state is shared between the two code paths, (c) how conversation history loaded from SQLite feeds into both, (d) how tool call messages from agent mode render in a conversation that also has simple chat messages.
- **Failure scenario:** Developer implements Phase 1's chat with `useChat` managing state via its internal `messages` array. Phase 3 adds `runAgent` which returns `{ text, toolCalls, toolResults }` -- a different shape. The `chat-panel.svelte` now has two code paths for sending messages, two ways messages get added to the store, and two rendering flows. Bugs emerge: (a) switching from agent response back to simple chat loses context, (b) reloading a conversation with mixed simple + tool-call messages breaks because `useChat` does not understand the tool_calls JSON stored in SQLite, (c) the message store has dual-write conflicts.
- **Evidence:** Phase 1 Step 4: `const { messages, input, handleSubmit } = useChat({...})` -- useChat owns message state. Phase 3 Step 7.1: "add user msg -> runAgent() -> add assistant response -> save_message" -- manual state management, bypassing useChat. Phase 3 Step 6.4: "switch giua useChat va runAgent" -- no unified state model described.
- **Suggested fix:** Unify from Phase 1: do not use `useChat` at all. Build a custom chat state manager that wraps both simple LLM calls and agent calls. Use `streamText` with `tools: {}` (empty) for simple mode and `tools: allTools` for agent mode -- same API, same state shape, same rendering pipeline. This eliminates the mode-switch problem entirely.

---

## Unresolved Questions

1. The brainstorm report referenced in `plan.md` (`../reports/brainstorm-260222-1538-vibe-recruiter-architecture.md`) does not exist. Were architectural decisions made without documentation, or is this report pending?
2. No CI/CD pipeline is described in any phase. How are cross-platform builds triggered? Who runs tests? Phase 5 mentions "Test build on macOS/Windows/Linux via CI" but no CI configuration exists in the plan.
3. No backup/export strategy for user data (SQLite DB). If the app auto-updates and a migration goes wrong, user loses all candidate data with no recovery path.
4. The proxy uses both CF KV (rate limiting, usage) and D1 (user records). No schema or setup steps for D1 are described in any phase.
5. `svelte-dnd-action` Svelte 5 compatibility is flagged as a risk but no verification step exists in Phase 4's todo list. The fallback (HTML5 DnD API) would require significant rework.
