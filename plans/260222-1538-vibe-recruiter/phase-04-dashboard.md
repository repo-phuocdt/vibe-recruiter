# Phase 4: Dashboard & Recruitment Management

## Context Links
- [Plan Overview](./plan.md)
- [Brainstorm](../reports/brainstorm-260222-1538-vibe-recruiter-architecture.md)
- Depends on: Phase 2 (SQLite data models), Phase 3 (agent tools for candidate data)
- shadcn-svelte Kanban ref: `svelte-dnd-action` package

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 2 weeks
- **Description:** Build recruitment dashboard gom stats overview, Kanban pipeline cho candidates, job management CRUD, candidate detail view, basic analytics. Navigation sidebar cho toaan app.

## Key Insights
- Kanban board dung `svelte-dnd-action` (mature, SSR-safe, Svelte 5 compatible) thay vi tu build DnD
- Stats cards query tu SQLite via Tauri commands - aggregate queries, cache ket qua
- Candidate detail view reuse parsed CV data tu Phase 2 (JSON stored in `candidates.parsed_data`)
- Pipeline stages la enum: `new | screening | interview | offer | hired | rejected`
- Navigation sidebar dung SvelteKit layout - render 1 lan, persist across routes

## Requirements

### Functional
- FR1: Dashboard main view hien thi stats cards (total candidates, active jobs, pipeline stage counts)
- FR2: Kanban board voi 6 columns, drag-drop candidate cards giua stages
- FR3: Job management page - list jobs, create/edit/delete, xem applications per job
- FR4: Candidate detail view - parsed CV, application history, AI notes, timeline
- FR5: Basic analytics - candidates per job chart, time-to-hire, source breakdown
- FR6: Sidebar navigation: Chat, Dashboard, Candidates, Jobs, Settings

### Non-Functional
- NFR1: Dashboard load < 500ms (SQLite aggregate queries)
- NFR2: Kanban drag-drop smooth 60fps
- NFR3: Responsive layout (min 1024px width cho desktop app)

## Related Code Files

### New Files
```
src/lib/components/dashboard/stats-cards.svelte          # Stats overview cards
src/lib/components/dashboard/pipeline-board.svelte        # Kanban board container
src/lib/components/dashboard/candidate-pipeline-card.svelte # Draggable card
src/lib/components/candidates/candidate-detail.svelte     # Full candidate view
src/lib/components/candidates/candidate-timeline.svelte   # Application history
src/lib/components/jobs/job-detail.svelte                 # Job detail + applications
src/lib/components/jobs/job-form.svelte                   # Create/edit job form
src/lib/components/layout/sidebar-nav.svelte              # App sidebar navigation
src/lib/components/analytics/simple-bar-chart.svelte      # Lightweight bar chart
src/lib/stores/dashboard.ts                               # Dashboard state + queries
src/routes/dashboard/+page.svelte                         # Dashboard page
src/routes/candidates/+page.svelte                        # Candidates list page
src/routes/candidates/[id]/+page.svelte                   # Candidate detail page
src/routes/jobs/+page.svelte                              # Jobs list page
src/routes/jobs/[id]/+page.svelte                         # Job detail page
src/routes/+layout.svelte                                 # Root layout with sidebar
src-tauri/src/commands/analytics.rs                       # Pipeline stats, counts
```

### Modified Files
```
src-tauri/src/commands/mod.rs                             # Register analytics commands
src-tauri/src/main.rs                                     # Register new commands
src/lib/stores/candidates.ts                              # Add pipeline stage mutations
src/lib/stores/jobs.ts                                    # Add CRUD operations
```

## Implementation Steps

### Step 1: Sidebar Navigation Layout
1. Install icon pack: `npm install lucide-svelte`
2. Create `sidebar-nav.svelte` - vertical nav with icons + labels
   - Routes: `/chat`, `/dashboard`, `/candidates`, `/jobs`, `/settings`
   - Active state highlight based on `$page.url.pathname`
   - Collapsible (icon-only mode) via toggle button
3. Update `src/routes/+layout.svelte` - 2-column layout: sidebar (w-16/w-56) + main content

### Step 2: Analytics Rust Commands
1. Create `src-tauri/src/commands/analytics.rs`:
```rust
#[tauri::command]
pub async fn get_dashboard_stats(db: State<'_, DbPool>) -> Result<DashboardStats, String> {
    // Returns: total_candidates, active_jobs, pipeline_counts per stage,
    //          new_this_week, interviews_scheduled
}

#[tauri::command]
pub async fn get_pipeline_candidates(stage: Option<String>, db: State<'_, DbPool>) -> Result<Vec<PipelineCandidate>, String> {
    // Returns candidates grouped by application status
    // JOIN candidates + applications, order by updated_at
}

<!-- Red Team: Validate pipeline stage enum server-side — 2026-02-22 -->
#[tauri::command]
pub async fn update_candidate_stage(application_id: i64, new_stage: String, db: State<'_, DbPool>) -> Result<(), String> {
    // Validate enum BEFORE update
    let valid = ["new","screening","interview","offer","hired","rejected"];
    if !valid.contains(&new_stage.as_str()) { return Err("Invalid stage".into()); }
    // UPDATE applications SET status = ? WHERE id = ?
}

#[tauri::command]
pub async fn get_analytics_data(db: State<'_, DbPool>) -> Result<AnalyticsData, String> {
    // candidates_per_job, avg_time_to_hire, source_counts
}
```
2. Register commands in `mod.rs` and `main.rs`

### Step 3: Dashboard Store
1. Create `src/lib/stores/dashboard.ts`:
```typescript
import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export const dashboardStats = writable<DashboardStats | null>(null);
export const pipelineCandidates = writable<Record<string, PipelineCandidate[]>>({});

export async function loadDashboardStats() {
  const stats = await invoke('get_dashboard_stats');
  dashboardStats.set(stats);
}

export async function moveCandidateStage(applicationId: number, newStage: string) {
  await invoke('update_candidate_stage', { applicationId, newStage });
  await loadPipelineCandidates(); // refresh
}
```

### Step 4: Stats Cards Component
1. Create `stats-cards.svelte` - grid 4 columns
   - Each card: icon + label + count + trend indicator (optional)
   - Cards: Total Candidates, Active Jobs, In Pipeline, Hired This Month
   - Dung shadcn-svelte `Card` component

### Step 5: Kanban Pipeline Board
1. Install: `npm install svelte-dnd-action`
2. Create `pipeline-board.svelte`:
   - 6 columns: New, Screening, Interview, Offer, Hired, Rejected
   - Each column = `<div use:dndzone={{ items, type: 'candidate' }}>`
   - On drop: call `moveCandidateStage(appId, newStage)`
   - Column header shows count badge
3. Create `candidate-pipeline-card.svelte`:
   - Avatar/initials + name + current job title
   - Applied job name + days in stage
   - Click navigates to `/candidates/[id]`

### Step 6: Candidate & Job Pages
1. `candidates/+page.svelte` - searchable table with filters (stage, job, date)
   - Dung shadcn-svelte `Table` + `Input` for search
   - Bulk actions: move stage, export
2. `candidates/[id]/+page.svelte` - full detail view using `candidate-detail.svelte`
   - Tabs: Overview (parsed CV), Applications, AI Notes, Timeline
   - `candidate-timeline.svelte` - chronological events (applied, screened, interviewed...)
3. `jobs/+page.svelte` - job listings with status badges
   - Create job button opens `job-form.svelte` dialog
4. `jobs/[id]/+page.svelte` - job detail + application list
   - Job description, requirements, applicant count
   - Embedded mini-pipeline for this job's candidates

### Step 7: Basic Analytics
1. Create `simple-bar-chart.svelte` - pure SVG bar chart (no charting library, KISS)
   - Input: `{ label: string, value: number }[]`
   - Horizontal bars with labels + values
2. Dashboard analytics section:
   - Candidates per job (bar chart)
   - Time-to-hire average (stat card)
   - Source breakdown (bar chart)

## Todo List
- [ ] Install deps: `lucide-svelte`, `svelte-dnd-action`
- [ ] Create sidebar navigation layout
- [ ] Implement analytics Rust commands
- [ ] Create dashboard store
- [ ] Build stats cards component
- [ ] Build Kanban pipeline board with DnD
- [ ] Build candidate pipeline card
- [ ] Create dashboard page composing stats + Kanban + analytics
- [ ] Create candidates list page with search/filter
- [ ] Create candidate detail page (tabs: overview, applications, notes)
- [ ] Create candidate timeline component
- [ ] Create job list page
- [ ] Create job form (create/edit dialog)
- [ ] Create job detail page with mini-pipeline
- [ ] Build simple SVG bar chart component
- [ ] Wire analytics data to charts
- [ ] Test DnD across all pipeline stages
- [ ] Test navigation between all routes

## Success Criteria
- Dashboard loads stats + pipeline trong < 500ms
- Drag-drop candidate giua stages update DB + UI instantly
- Job CRUD hoat dong full (create, read, update, delete)
- Candidate detail hien thi parsed CV data + application history
- Sidebar navigation works across all routes, active state correct
- Analytics charts render correct data from DB

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `svelte-dnd-action` Svelte 5 compat | Kanban broken | Pin version, test early. Fallback: HTML5 DnD API |
| Large candidate lists slow render | Bad UX | Virtual scrolling (`svelte-virtual-list`) if > 200 items |
| Complex SQL aggregate queries | Slow dashboard | Add SQLite indexes on `applications.status`, `applications.job_id` |
| Pipeline state desync | Wrong stage shown | Optimistic UI update + DB refresh on focus |
