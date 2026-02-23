# Code Review — Phase 2: Data Management & RAG

**Date:** 2026-02-23
**Reviewer:** code-reviewer agent
**Scope:** Phase 2 new/modified files — Rust backend services, CRUD commands, DB migrations, proxy embeddings route, frontend stores/services/components

---

## Scope

**Files reviewed (22):**
- `src-tauri/src/services/cv_parser.rs`
- `src-tauri/src/services/embedding.rs`
- `src-tauri/src/commands/candidates.rs`
- `src-tauri/src/commands/jobs.rs`
- `src-tauri/src/commands/embeddings.rs`
- `src-tauri/src/db/migrations.rs`
- `src-tauri/src/db/mod.rs`
- `src-tauri/src/models/{candidate,job,application}.rs`
- `src-tauri/src/error.rs`
- `src-tauri/src/lib.rs`
- `proxy/src/index.ts` (embeddings route addition)
- `src/lib/types.ts`
- `src/lib/services/tauri-commands.ts`
- `src/lib/services/rag.ts`
- `src/lib/services/chat-manager.ts`
- `src/lib/stores/candidates-store.ts`
- `src/lib/stores/jobs-store.ts`
- `src/lib/components/candidates/{candidate-list,candidate-card,cv-upload}.svelte`
- `src/lib/components/jobs/{job-list,job-form}.svelte`
- `src/routes/candidates/+page.svelte`, `src/routes/jobs/+page.svelte`

**LOC:** ~900 new lines across all files

---

## Overall Assessment

Solid MVP implementation. Architecture decisions (sqlite-vec virtual table separation, scoped mutex locks in async commands, dynamic RAG import, prompt injection wrapping) are sound. The code is readable, passes cargo check and pnpm check, and handles happy paths well. Issues are concentrated in security (path traversal, file validation, API key passing convention) and reliability (missing transactions, no HTTP timeouts, unsafe transmute comment).

---

## Critical Issues

### C1 — Path traversal in `upload_cv`: no extension/path validation
**File:** `src-tauri/src/commands/candidates.rs:140–162`

`file_path` comes from the frontend (Tauri IPC), and the only check is `source.exists()`. A crafted path like `../../etc/passwd` or a non-PDF file would pass this check. While the dialog plugin filters `.pdf` on the frontend, the backend must not trust that.

Fix:
```rust
// Validate file extension
let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("");
if ext.to_lowercase() != "pdf" {
    return Err(AppError::Parse("Only PDF files are accepted".into()));
}

// Validate file is within allowed locations (optional — dialog restricts this already,
// but defense in depth is warranted for a medical/personal-data app)
let canonical = source.canonicalize()
    .map_err(|_| AppError::Parse("Invalid file path".into()))?;
// Optionally: assert canonical starts_with known safe roots
```

---

## High Priority

### H1 — `store_embeddings` not wrapped in a transaction
**File:** `src-tauri/src/services/embedding.rs:85–106`

Each chunk inserts two rows (`embedding_chunks` + `vec_embeddings`) in separate `conn.execute` calls with no transaction. If the process crashes mid-way (e.g., after 50 of 100 chunks), the DB ends up in a split state: some chunks with embeddings, some without. `delete_embeddings` before a reprocess partially mitigates this for re-runs, but a fresh process crash leaves orphaned rows permanently.

Fix:
```rust
pub fn store_embeddings(...) -> Result<(), AppError> {
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        for (chunk, embedding) in chunks.iter().zip(embeddings.iter()) {
            // ... inserts ...
        }
        Ok::<(), AppError>(())
    })();
    match result {
        Ok(_) => { conn.execute_batch("COMMIT")?; Ok(()) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}
```

### H2 — `reqwest::Client::new()` created per call — no timeout
**Files:** `cv_parser.rs:19`, `embedding.rs:43`

A new HTTP client is constructed on every invocation. This skips connection pooling and — more importantly — sets no request timeout. A stalled upstream (OpenAI/proxy down) will hang the Tauri command indefinitely, blocking the Mutex and freezing the entire app.

Fix: use a module-level or passed-in client with a timeout:
```rust
let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .build()
    .map_err(|e| AppError::Request(e.to_string()))?;
```
Ideally share one client across calls via `lazy_static` or `once_cell`.

### H3 — `update_candidate` / `update_job`: each field is a separate UPDATE — N round-trips and no "nothing changed" signal
**Files:** `commands/candidates.rs:91–121`, `commands/jobs.rs:88–119`

If 3 fields are updated, 3 separate `UPDATE` statements fire. This is inefficient and non-atomic: a crash between statements leaves a partial update. It also silently succeeds and returns `Ok(())` when all fields are `None` (no-op call).

Fix: build a single parameterized UPDATE with only the provided fields, or at minimum wrap the three statements in a transaction.

### H4 — `chunk_text` with `overlap >= chunk_size` causes infinite loop
**File:** `src-tauri/src/services/embedding.rs:32`

```rust
start += chunk_size.saturating_sub(overlap);
```
When `overlap >= chunk_size`, `saturating_sub` returns 0, so `start` never advances — infinite loop. Currently called with `(200, 50)` so it is safe today, but the function is public with no guard.

Fix:
```rust
let step = chunk_size.saturating_sub(overlap).max(1);
start += step;
```

### H5 — `unsafe transmute` for sqlite-vec extension load lacks comment on correctness
**File:** `src-tauri/src/db/mod.rs:46–50`

```rust
unsafe {
    rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
        sqlite_vec::sqlite3_vec_init as *const (),
    )));
}
```

The transmute from `*const ()` to the `sqlite3_entrypoint` function pointer type is technically sound for this specific FFI pattern (and is the documented approach for sqlite-vec), but there is no `// SAFETY:` comment explaining why. This is a maintenance hazard — future contributors may not know it is intentional.

Fix: add a `// SAFETY: sqlite_vec::sqlite3_vec_init matches the sqlite3_entrypoint ABI` comment.

---

## Medium Priority

### M1 — API key passed through Tauri IPC on every embedding/CV call
**Files:** `commands/candidates.rs:168`, `commands/jobs.rs:131`, `commands/embeddings.rs:8`

`proxy_url` and `api_key` are passed as plain IPC arguments from the frontend on every `process_cv`, `embed_job`, and `search_similar` call. This means:
- The key is visible in Tauri's IPC event log in dev tools
- It is unnecessarily duplicated (the backend could fetch from `settings` table directly)

The key already lives in the DB (`settings` table). Fetching it server-side would be both cleaner and marginally more secure.

### M2 — No index on `embedding_chunks(source_type, source_id)`
**File:** `src-tauri/src/db/migrations.rs`

`delete_embeddings` and `search_similar` both query `embedding_chunks` by `(source_type, source_id)` or by `id`. With hundreds of candidates and thousands of chunks this will become a full table scan. Add to migration v2:

```sql
CREATE INDEX IF NOT EXISTS idx_embedding_chunks_source
    ON embedding_chunks(source_type, source_id);
```

### M3 — `delete_embeddings` silently swallows vec-table errors
**File:** `src-tauri/src/services/embedding.rs:124`

```rust
let _ = conn.execute("DELETE FROM vec_embeddings WHERE rowid = ?1", params![id]);
```

If vec_embeddings is unavailable, this is fine. But this also hides genuine errors (disk full, corruption). `delete_embeddings` itself propagates the metadata delete error but not the vec delete error — asymmetric error handling. Log the error at minimum.

### M4 — `process_cv` does not re-embed after re-upload; embedding uses original text
**File:** `src-tauri/src/commands/candidates.rs:165–208`

`process_cv` reads `resume_path` from the DB, parses it, then embeds the raw text. This is correct. However, if a user calls `upload_cv` again (re-uploading a different PDF), the stored `resume_path` is updated but `process_cv` must be called again manually. There is no UI affordance for this on the `CvUpload` component — `onprocessed` fires once and the button label stays "Upload & Process CV" in `done` state. A second upload would still show the stale "done" label from the first run.

Fix: reset `status` to `'idle'` when a new file is about to be selected, so the user can trigger re-processing.

### M5 — `settingsStore` exposes `proxy_api_key` only via `.settings.proxy_api_key` — inconsistent accessor
**Files:** `src/lib/stores/settings-store.ts`, `src/lib/services/rag.ts:10`, `src/lib/components/candidates/cv-upload.svelte:39`

`settingsStore` provides top-level getters for `model`, `theme`, `proxy_url`, `ollama_url` — but not `proxy_api_key`. Callers use `settingsStore.settings.proxy_api_key` directly, bypassing the abstraction layer. Add a `get proxy_api_key()` getter for consistency and to avoid callers importing the raw settings object shape.

### M6 — `job-list.svelte`: `$effect` fires on every `statusFilter` change AND `filterByStatus` also calls `loadJobs` directly — double load
**File:** `src/lib/components/jobs/job-list.svelte:8–20`

```svelte
$effect(() => { loadJobs(statusFilter); });    // reactive load on change
function filterByStatus(status?) {
    statusFilter = status;
    loadJobs(status);     // also immediately calls loadJobs
}
```

When a filter button is clicked, `loadJobs` is called twice: once directly in `filterByStatus` and once by the `$effect` reacting to `statusFilter` change. Remove the direct `loadJobs` call in `filterByStatus`.

### M7 — Migration is non-transactional for multi-statement batches
**File:** `src-tauri/src/db/migrations.rs:73–83`

`execute_batch` runs each statement in the batch but the version pragma update is outside the batch. If `execute_batch` partially succeeds (e.g., one table creates, then an error on the next), `user_version` will not be updated and the migration will re-run — but now `CREATE TABLE IF NOT EXISTS` prevents data loss. Still, wrapping each migration in a transaction is best practice.

---

## Low Priority

### L1 — `update_candidate` returns `Ok(())` even when candidate ID does not exist
**Files:** `commands/candidates.rs:92–121`

SQLite `UPDATE` with no matching rows succeeds silently. Consider checking `conn.changes() == 0` and returning a `NotFound` error variant.

### L2 — `cv-upload.svelte` button shows "Upload & Process CV" in both `idle` and `done` state — no feedback distinction
**File:** `src/lib/components/candidates/cv-upload.svelte:64–67`

```svelte
{:else if status === 'done'}
    Upload & Process CV   ← same text as idle
```
After a successful process the button is identical to the initial state. The success message below helps, but the button should read "Re-upload CV" in `done` state.

### L3 — `proxy/index.ts` embeddings route passes body payload to OpenAI without field restriction
**File:** `proxy/src/index.ts:56–68`

The entire client request body is forwarded verbatim to OpenAI. The `model` field could be changed by a misbehaving client to `text-embedding-3-large` (3x more expensive). Consider restricting the `model` field to the allowed embedding model.

### L4 — `Application` model has `#[allow(dead_code)]` — not wired up yet
**File:** `src-tauri/src/models/application.rs:3`

The `applications` table is created in the migration but there are no CRUD commands. The `#[allow(dead_code)]` makes this placeholder explicit. Fine for Phase 2, but track it for Phase 3.

### L5 — `embed_job` only embeds description, ignores requirements field
**File:** `src-tauri/src/commands/jobs.rs:137–153`

Job search will miss candidates whose skills match requirements but not the description. Consider concatenating `description` and `requirements` before chunking.

---

## Edge Cases Found by Scout

1. **`chunk_size=0` passed to `chunk_text`**: `words.len() <= 0` is always false for non-empty text, enters loop, `end = min(0, len) = 0`, `chunks.push(words[0..0].join(" "))` pushes an empty string, `start += 0.saturating_sub(overlap)` = 0 — infinite loop. Guard: `if chunk_size == 0 { return vec![]; }`.

2. **Concurrent `process_cv` calls for same candidate**: Two async tasks could race past the "delete old embeddings" checkpoint and both insert embeddings, resulting in duplicate rows. The `Mutex<Connection>` serializes DB writes, but the delete and insert are not atomic across the async boundary (HTTP calls happen between lock acquisitions). Mitigating with a transaction-per-store (H1) partially helps; for full safety, an in-flight guard per `candidate_id` would be needed.

3. **`search_similar` with empty vec_embeddings table**: The `Err(_) => Ok(vec![])` fallback in `search_similar` is too broad — it catches all errors from `prepare()`, including genuine SQL syntax errors. Only catch the specific `SqliteFailure` indicating the extension is unavailable.

4. **LLM returns non-JSON despite `response_format: json_object`**: `extract_structured_data` validates the JSON after extraction. However, if the LLM wraps the JSON in markdown fences (```json ... ```), `serde_json::from_str` will fail and the entire `process_cv` aborts with no partial save. Consider stripping markdown fences before validation.

5. **`upload_cv` with a `candidate_id` that contains path separators**: e.g. `candidate_id = "../../etc/shadow"` would produce `cvs_dir.join("../../etc/shadow.pdf")` — escaping the intended directory. UUIDs from the frontend are trusted but not validated server-side.

---

## Positive Observations

- Lock scoping in async commands (`process_cv`, `embed_job`) is correctly done: mutex is released before HTTP calls, preventing lock hold across await. This is the right pattern.
- Prompt injection mitigation in `rag.ts` using `<context>` delimiter tags + explicit instruction is a pragmatic and well-placed defense.
- `$effect` + Svelte 5 runes usage is idiomatic; stores are module-level `$state` with clean getters.
- `embedding_model` column in `embedding_chunks` allows future model rotation without schema change.
- `vec_available.is_ok()` guard before creating virtual table gracefully degrades when sqlite-vec is unavailable.
- Foreign key cascade deletes are set up correctly in migrations.
- `delete_candidate` cleans up embeddings before deleting the candidate row — correct ordering.
- Dynamic import of `rag.ts` in `chat-manager.ts` with a `try/catch` fallback is clean and doesn't hard-block chat if RAG errors.

---

## Recommended Actions (prioritized)

1. **[C1]** Add server-side file extension + (optionally) UUID-format validation in `upload_cv`
2. **[H1]** Wrap `store_embeddings` in an explicit SQLite transaction
3. **[H2]** Add `timeout(30s)` to reqwest clients; reuse via `once_cell` or pass as parameter
4. **[H4]** Fix infinite loop: add `.max(1)` to `chunk_text` step calculation
5. **[H3]** Consolidate multi-field updates into a single transaction (or single SQL statement)
6. **[M2]** Add `CREATE INDEX` on `embedding_chunks(source_type, source_id)` in migration v2
7. **[M6]** Remove redundant `loadJobs()` call in `filterByStatus` in `job-list.svelte`
8. **[M5]** Add `get proxy_api_key()` getter to `settingsStore`
9. **[H5]** Add `// SAFETY:` comment to `unsafe transmute` block
10. **[L5]** Concatenate `requirements` into job embedding text

---

## Metrics

- Type coverage: full — all models typed, all IPC commands typed end-to-end
- Test coverage: 0% (no unit tests for `chunk_text`, `store_embeddings`, `extract_structured_data`)
- Linting: passes `cargo check` and `pnpm check` clean
- Unsafe blocks: 1 (`load_sqlite_vec` transmute) — necessary, should be documented

---

## Unresolved Questions

1. Will `embed_job` be called automatically on job create/update, or manually triggered? Currently no UI affordance for it exists in `job-list.svelte`.
2. Is there a plan to validate candidate UUID format server-side, or is the trust boundary assumed to be the desktop app itself (Tauri IPC from same process)?
3. `text-embedding-3-small` dimension is hardcoded as 1536 in the vec0 table definition — if the model is changed in `embedding.rs`, the virtual table schema would be silently mismatched. Should this be a named constant shared between both?
