<script lang="ts">
  import AppLayout from '$lib/components/layout/app-layout.svelte';
  import StatsCards from '$lib/components/dashboard/stats-cards.svelte';
  import PipelineBoard from '$lib/components/dashboard/pipeline-board.svelte';
  import SimpleBarChart from '$lib/components/analytics/simple-bar-chart.svelte';
  import {
    dashboardStore,
    loadAll,
    moveCandidateStage,
  } from '$lib/stores/dashboard-store.svelte';
  import type { PipelineStage } from '$lib/types';
  import { RefreshCw } from 'lucide-svelte';

  let refreshing = $state(false);

  $effect(() => {
    loadAll();
  });

  async function handleRefresh() {
    refreshing = true;
    await loadAll();
    refreshing = false;
  }

  function handleMove(applicationId: string, newStage: PipelineStage) {
    moveCandidateStage(applicationId, newStage);
  }

  const jobChartData = $derived(
    (dashboardStore.analyticsData?.candidates_per_job ?? []).map((d) => ({
      label: d.job_title,
      value: d.count,
    }))
  );

  const stageChartData = $derived(
    (dashboardStore.analyticsData?.stage_distribution ?? []).map((d) => ({
      label: d.stage,
      value: d.count,
    }))
  );
</script>

<AppLayout>
  <div class="flex h-full flex-col gap-6 overflow-y-auto p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-zinc-100">Dashboard</h1>
      <button
        onclick={handleRefresh}
        disabled={refreshing}
        class="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        <RefreshCw size={14} class={refreshing ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>

    {#if dashboardStore.loading}
      <p class="py-8 text-center text-sm text-zinc-500">Loading dashboard...</p>
    {:else if dashboardStore.error}
      <p class="py-8 text-center text-sm text-red-400">{dashboardStore.error}</p>
    {:else}
      <!-- Stats -->
      <StatsCards stats={dashboardStore.stats} />

      <!-- Pipeline Kanban -->
      <div>
        <h2 class="mb-3 text-sm font-semibold text-zinc-300">Recruitment Pipeline</h2>
        <PipelineBoard candidatesByStage={dashboardStore.candidatesByStage} onmove={handleMove} />
      </div>

      <!-- Analytics Charts -->
      <div class="grid grid-cols-2 gap-4">
        <SimpleBarChart data={jobChartData} title="Candidates per Job" />
        <SimpleBarChart data={stageChartData} title="Stage Distribution" />
      </div>
    {/if}
  </div>
</AppLayout>
