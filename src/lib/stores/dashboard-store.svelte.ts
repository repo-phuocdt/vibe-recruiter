import type { DashboardStats, PipelineCandidate, AnalyticsData, PipelineStage } from '$lib/types';
import { PIPELINE_STAGES } from '$lib/types';
import * as cmd from '$lib/services/tauri-commands';

let stats = $state<DashboardStats | null>(null);
let pipelineCandidates = $state<PipelineCandidate[]>([]);
let analyticsData = $state<AnalyticsData | null>(null);
let loading = $state(false);
let storeError = $state<string | null>(null);

// Group candidates by stage for Kanban columns
let candidatesByStage = $derived.by(() => {
  const grouped: Record<string, PipelineCandidate[]> = {};
  for (const stage of PIPELINE_STAGES) {
    grouped[stage] = [];
  }
  for (const c of pipelineCandidates) {
    const stage = c.stage as PipelineStage;
    if (grouped[stage]) {
      grouped[stage].push(c);
    }
  }
  return grouped;
});

export async function loadDashboardStats(): Promise<void> {
  loading = true;
  storeError = null;
  try {
    stats = await cmd.getDashboardStats();
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to load dashboard stats';
  } finally {
    loading = false;
  }
}

export async function loadPipelineCandidates(): Promise<void> {
  try {
    pipelineCandidates = await cmd.getPipelineCandidates();
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to load pipeline';
  }
}

export async function moveCandidateStage(
  applicationId: string,
  newStage: PipelineStage,
): Promise<void> {
  // Optimistic update
  pipelineCandidates = pipelineCandidates.map((c) =>
    c.application_id === applicationId ? { ...c, stage: newStage } : c,
  );
  try {
    await cmd.updateCandidateStage(applicationId, newStage);
  } catch (e) {
    // Revert on failure
    storeError = e instanceof Error ? e.message : 'Failed to update stage';
    await loadPipelineCandidates();
  }
}

export async function loadAnalytics(): Promise<void> {
  try {
    analyticsData = await cmd.getAnalyticsData();
  } catch (e) {
    storeError = e instanceof Error ? e.message : 'Failed to load analytics';
  }
}

export async function loadAll(): Promise<void> {
  loading = true;
  storeError = null;
  try {
    await Promise.all([loadDashboardStats(), loadPipelineCandidates(), loadAnalytics()]);
  } finally {
    loading = false;
  }
}

export const dashboardStore = {
  get stats() { return stats; },
  get pipelineCandidates() { return pipelineCandidates; },
  get candidatesByStage() { return candidatesByStage; },
  get analyticsData() { return analyticsData; },
  get loading() { return loading; },
  get error() { return storeError; },
};
