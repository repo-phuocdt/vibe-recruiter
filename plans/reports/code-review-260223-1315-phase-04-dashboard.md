# Code Review: Phase 4 -- Dashboard & Recruitment Management

## Scope
- **Files**: 10 new, 10 modified
- **LOC**: ~700 new/changed
- **Focus**: Analytics Rust commands, dashboard store, Kanban DnD, detail pages, nav refactor
- **Build**: Rust `cargo check` PASS, `svelte-check` 0 errors 0 warnings

## Overall Assessment

Solid Phase 4 implementation. Clean separation: Rust analytics commands, Svelte store with optimistic updates, reusable components. The Kanban DnD integration, sidebar nav extraction, and detail pages are well-structured. A few issues around DnD prop mutation, silent error swallowing, and missing constraints need attention.

---

## Critical Issues

### 1. DnD handler mutates derived prop directly
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/lib/components/dashboard/pipeline-board.svelte` (lines 44, 48)

```ts
candidatesByStage[stage] = e.detail.items;
```

`candidatesByStage` is passed as a prop from `dashboardStore.candidatesByStage`, which is `$derived.by(...)`. Mutating a derived value's object directly is unreliable -- Svelte 5 derived values are recalculated from source state; direct mutation may be overwritten on next derivation or cause reactivity issues.

**Fix**: The DnD handlers should call a store function that updates `pipelineCandidates` (the source `$state`), not mutate the derived grouping. Add a `reorderInStage` function to the store, or have `handleDndConsider` / `handleDndFinalize` work through `moveCandidateStage` which already updates the source state.

Alternatively, maintain local DnD state in the board component with `$state` cloned from the prop, sync on finalize only.

### 2. `update_candidate_stage` silently succeeds on non-existent application_id
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src-tauri/src/commands/analytics.rs` (lines 147-169)

`conn.execute(UPDATE ... WHERE id = ?2)` returns `Ok(0)` when no rows match. The command returns `Ok(())` even if the application doesn't exist, so the frontend thinks the update succeeded.

**Fix**:
```rust
let rows_affected = conn.execute(
    "UPDATE applications SET status = ?1 WHERE id = ?2",
    [&new_stage, &application_id],
).map_err(|e| e.to_string())?;

if rows_affected == 0 {
    return Err(format!("Application '{}' not found", application_id));
}
```

---

## High Priority

### 3. `filter_map(|r| r.ok())` silently swallows row-level errors (5 instances)
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src-tauri/src/commands/analytics.rs` (lines 85, 128, 193, 207, 251)

If a row fails to deserialize (e.g., NULL in a NOT NULL column after data corruption), those rows vanish silently. Counts displayed on dashboard would be inaccurate.

**Fix**: Use `.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?` to propagate errors.

### 4. No UNIQUE constraint on (candidate_id, job_id) in applications table
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src-tauri/src/db/migrations.rs`

`create_application` can create duplicate applications for the same candidate+job pair. No check in Rust code or DB schema.

**Fix**: Add migration 5 with:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_candidate_job
  ON applications(candidate_id, job_id);
```

### 5. `loadApplications()` in candidate detail page is a no-op
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/routes/candidates/[id]/+page.svelte` (lines 34-38)

```ts
async function loadApplications() {
    applications = [];
}
```

The "Applications" tab always shows "No applications yet". The `getJobApplications` command is imported but unused for this purpose (it filters by job_id, not candidate_id). Need a `get_candidate_applications` Rust command.

**Fix**: Add a `get_candidate_applications` command in `analytics.rs`:
```rust
#[tauri::command]
pub async fn get_candidate_applications(
    candidate_id: String,
    db: State<'_, DbState>,
) -> Result<Vec<PipelineCandidate>, String> {
    // SELECT ... WHERE a.candidate_id = ?1
}
```

---

## Medium Priority

### 6. `daysInStage` label is misleading
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/lib/components/dashboard/candidate-pipeline-card.svelte` (lines 15-19)

Uses `created_at` (application creation date), not when the candidate entered the current stage. After a stage move, the counter still shows days since application creation.

**Fix**: Either rename to "Days in pipeline" or add a `stage_updated_at` column to track stage transition timestamps.

### 7. `loadDashboardStats` sets `loading` but `loadPipelineCandidates` / `loadAnalytics` do not
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/lib/stores/dashboard-store.svelte.ts`

Only `loadDashboardStats` (line 27) and `loadAll` (line 72) set `loading = true`. If `loadPipelineCandidates` or `loadAnalytics` are called standalone, no loading indicator appears.

**Fix**: Minor -- either always use `loadAll()`, or add `loading` to each function.

### 8. `loadAll` error handling overlaps with inner functions
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/lib/stores/dashboard-store.svelte.ts` (lines 71-79)

`Promise.all` calls 3 async functions that each catch their own errors. If one fails and sets `storeError`, the others continue. Since `Promise.all` won't reject (inner catches), the `finally` always runs. The last error to set `storeError` wins. Prior errors are overwritten.

**Fix**: Either collect all errors or fail-fast with `Promise.allSettled` and aggregate.

### 9. Stats cards grid is fixed `grid-cols-4` -- not responsive
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/lib/components/dashboard/stats-cards.svelte` (line 18)

```html
<div class="grid grid-cols-4 gap-4">
```

On narrow screens, cards will be squished.

**Fix**: `grid grid-cols-2 gap-4 lg:grid-cols-4`

---

## Low Priority

### 10. Unused import in candidate detail page
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/routes/candidates/[id]/+page.svelte` (line 6)

`getJobApplications` is imported but never used.

### 11. `stageColors` duplicated between pipeline-board.svelte and jobs/[id]/+page.svelte
Could extract to a shared `STAGE_COLORS` constant in `types.ts` or a separate config file.

### 12. `isActive` in sidebar-nav.svelte is reactive but not marked as such
**File**: `/Users/er_macbook_306/Workspaces/tauri-app/src/lib/components/layout/sidebar-nav.svelte` (line 15)

`isActive` is a regular function reading `page.url.pathname`. In Svelte 5, this works because the function is called inside the template (reactive context), but worth noting for clarity.

---

## Edge Cases Found by Scout

1. **Empty candidate_name**: `candidate_pipeline_card.svelte` line 8 -- `.split(' ').map(w => w[0])` -- if `candidate_name` is empty string, `w[0]` is `undefined`, resulting in `initials = "UNDEFINED"`. Add guard: `candidate.candidate_name || '?'`.

2. **Race condition on rapid stage moves**: User drags card to stage A, then quickly to stage B before first API call completes. Optimistic update fires twice, then first revert refetches stale data. The second move may be lost.

3. **Dashboard `$effect` re-runs on navigation**: SvelteKit keeps components alive during client-side navigation. The `$effect(() => { loadAll(); })` will re-fire each time the dashboard page mounts, which is desired. But if the user navigates away mid-load, the store state updates target a potentially unmounted page (no abort controller).

4. **`created_at` format from SQLite**: `new Date(candidate.created_at)` in pipeline card -- SQLite stores `datetime('now')` as `YYYY-MM-DD HH:MM:SS` without timezone. `new Date()` interprets this as local time in some browsers, UTC in others.

---

## Positive Observations

- Stage validation with `VALID_STAGES` constant in Rust -- good allowlist approach
- Parameterized SQL queries throughout -- no injection risks
- Optimistic UI update with revert on failure in `moveCandidateStage`
- Clean store pattern: module-level `$state` + exported getter object
- `AppLayout` refactored to make all props optional with defaults -- smooth progressive enhancement
- Sidebar nav extraction is clean, uses keyed `{#each}` correctly
- Migration 4 adds proper indexes on frequently queried columns
- Empty state handling present in all list views
- `map_pipeline_row` extracted as reusable row mapper

## Recommended Actions (Priority Order)

1. Fix DnD prop mutation -- use local `$state` or store function (Critical)
2. Add `rows_affected == 0` check in `update_candidate_stage` (Critical)
3. Replace `filter_map(|r| r.ok())` with proper error propagation (High)
4. Add unique constraint on `(candidate_id, job_id)` (High)
5. Implement `get_candidate_applications` command (High)
6. Guard empty `candidate_name` in initials derivation (Medium)
7. Make stats cards responsive (Medium)
8. Fix `daysInStage` label accuracy or rename (Medium)

## Metrics
- **Type Coverage**: 100% (svelte-check passes, all props typed)
- **Test Coverage**: N/A (no tests in scope)
- **Linting Issues**: 0 errors, 0 warnings
- **Build**: Rust + Svelte both compile cleanly

## Unresolved Questions

1. Should `rejected` stage be part of the main pipeline Kanban, or separated into its own section? Dragging to "rejected" is a destructive action with no confirmation.
2. Is there a plan to add pagination to pipeline candidates? Currently fetches all applications in one query -- may not scale.
3. Should `update_candidate_stage` also record an audit trail / timestamp of stage transitions?
