<script lang="ts">
  import AppLayout from '$lib/components/layout/app-layout.svelte';
  import { page } from '$app/state';
  import { getJob, getJobApplications, updateJob } from '$lib/services/tauri-commands';
  import type { Job, PipelineCandidate } from '$lib/types';
  import { ArrowLeft } from 'lucide-svelte';

  let job = $state<Job | null>(null);
  let applications = $state<PipelineCandidate[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const jobId = $derived(page.params.id ?? '');

  $effect(() => {
    if (jobId) loadJob(jobId);
  });

  async function loadJob(id: string) {
    loading = true;
    error = null;
    try {
      [job, applications] = await Promise.all([
        getJob(id),
        getJobApplications(id),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load job';
    } finally {
      loading = false;
    }
  }

  async function toggleStatus() {
    if (!job) return;
    const newStatus = job.status === 'open' ? 'closed' : 'open';
    try {
      await updateJob(job.id, undefined, undefined, undefined, newStatus);
      job = { ...job, status: newStatus };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
    }
  }

  const stageColors: Record<string, string> = {
    new: 'bg-blue-600/20 text-blue-300',
    screening: 'bg-yellow-600/20 text-yellow-300',
    interview: 'bg-purple-600/20 text-purple-300',
    offer: 'bg-cyan-600/20 text-cyan-300',
    hired: 'bg-green-600/20 text-green-300',
    rejected: 'bg-red-600/20 text-red-300',
  };
</script>

<AppLayout>
  <div class="flex h-full flex-col overflow-y-auto p-6">
    <a href="/jobs" class="mb-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
      <ArrowLeft size={16} />
      Back to Jobs
    </a>

    {#if loading}
      <p class="py-8 text-center text-sm text-zinc-500">Loading...</p>
    {:else if error}
      <p class="py-8 text-center text-sm text-red-400">{error}</p>
    {:else if job}
      <!-- Header -->
      <div class="mb-6 flex items-start justify-between">
        <div>
          <h1 class="text-xl font-bold text-zinc-100">{job.title}</h1>
          <p class="mt-1 text-sm text-zinc-400">Created {job.created_at}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="rounded-full px-3 py-1 text-xs font-medium {job.status === 'open' ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}">
            {job.status}
          </span>
          <button
            onclick={toggleStatus}
            class="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          >
            {job.status === 'open' ? 'Close Job' : 'Reopen Job'}
          </button>
        </div>
      </div>

      <!-- Details -->
      <div class="mb-6 grid grid-cols-2 gap-6">
        {#if job.description}
          <div class="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</h3>
            <p class="whitespace-pre-wrap text-sm text-zinc-300">{job.description}</p>
          </div>
        {/if}
        {#if job.requirements}
          <div class="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Requirements</h3>
            <p class="whitespace-pre-wrap text-sm text-zinc-300">{job.requirements}</p>
          </div>
        {/if}
      </div>

      <!-- Applications -->
      <div>
        <h2 class="mb-3 text-sm font-semibold text-zinc-300">
          Applications ({applications.length})
        </h2>
        {#if applications.length === 0}
          <p class="py-4 text-center text-sm text-zinc-500">No applications yet</p>
        {:else}
          <div class="space-y-2">
            {#each applications as app (app.application_id)}
              <a
                href="/candidates/{app.candidate_id}"
                class="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 p-3 transition-colors hover:border-zinc-600"
              >
                <div>
                  <p class="text-sm font-medium text-zinc-100">{app.candidate_name}</p>
                  {#if app.candidate_email}
                    <p class="text-xs text-zinc-500">{app.candidate_email}</p>
                  {/if}
                </div>
                <span class="rounded-full px-2 py-0.5 text-xs {stageColors[app.stage] ?? 'bg-zinc-700 text-zinc-300'}">
                  {app.stage}
                </span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</AppLayout>
