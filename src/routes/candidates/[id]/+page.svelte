<script lang="ts">
  import AppLayout from '$lib/components/layout/app-layout.svelte';
  import CandidateCard from '$lib/components/candidates/candidate-card.svelte';
  import CvUpload from '$lib/components/candidates/cv-upload.svelte';
  import { page } from '$app/state';
  import { getCandidate, getPipelineCandidates } from '$lib/services/tauri-commands';
  import type { Candidate, PipelineCandidate } from '$lib/types';
  import { ArrowLeft } from 'lucide-svelte';

  let candidate = $state<Candidate | null>(null);
  let applications = $state<PipelineCandidate[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeTab = $state<'overview' | 'applications'>('overview');

  const candidateId = $derived(page.params.id ?? '');

  $effect(() => {
    if (candidateId) {
      loadCandidate(candidateId);
      loadApplications(candidateId);
    }
  });

  async function loadCandidate(id: string) {
    loading = true;
    error = null;
    try {
      candidate = await getCandidate(id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load candidate';
    } finally {
      loading = false;
    }
  }

  async function loadApplications(candId: string) {
    try {
      const all = await getPipelineCandidates();
      applications = all.filter((a) => a.candidate_id === candId);
    } catch {
      applications = [];
    }
  }
</script>

<AppLayout>
  <div class="flex h-full flex-col overflow-y-auto p-6">
    <!-- Back link -->
    <a href="/candidates" class="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
      <ArrowLeft size={16} />
      Back to Candidates
    </a>

    {#if loading}
      <p class="py-8 text-center text-sm text-zinc-500">Loading...</p>
    {:else if error}
      <p class="py-8 text-center text-sm text-red-400">{error}</p>
    {:else if candidate}
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-bold text-zinc-100">{candidate.name}</h1>
        <div class="mt-1 flex gap-4 text-sm text-zinc-400">
          {#if candidate.email}<span>{candidate.email}</span>{/if}
          {#if candidate.phone}<span>{candidate.phone}</span>{/if}
        </div>
      </div>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 border-b border-zinc-800">
        <button
          onclick={() => (activeTab = 'overview')}
          class="px-4 py-2 text-sm font-medium transition-colors
            {activeTab === 'overview' ? 'border-b-2 border-blue-500 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
        >Overview</button>
        <button
          onclick={() => (activeTab = 'applications')}
          class="px-4 py-2 text-sm font-medium transition-colors
            {activeTab === 'applications' ? 'border-b-2 border-blue-500 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}"
        >Applications</button>
      </div>

      <!-- Tab content -->
      {#if activeTab === 'overview'}
        <div class="grid grid-cols-2 gap-6">
          <CandidateCard {candidate} />
          <div>
            <h3 class="mb-3 text-sm font-medium text-zinc-300">CV Upload</h3>
            <CvUpload candidateId={candidate.id} onprocessed={() => loadCandidate(candidateId)} />
          </div>
        </div>
      {:else}
        {#if applications.length === 0}
          <p class="py-8 text-center text-sm text-zinc-500">No applications yet</p>
        {:else}
          <div class="space-y-2">
            {#each applications as app (app.application_id)}
              <div class="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                <div>
                  <p class="text-sm font-medium text-zinc-100">{app.job_title}</p>
                  <p class="text-xs text-zinc-500">Applied {app.created_at}</p>
                </div>
                <span class="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{app.stage}</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</AppLayout>
