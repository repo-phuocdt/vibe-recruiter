<script lang="ts">
  import { jobsStore, loadJobs, addJob, removeJob } from '$lib/stores/jobs-store.svelte';
  import JobForm from './job-form.svelte';

  let showForm = $state(false);
  let statusFilter = $state<string | undefined>(undefined);

  $effect(() => {
    loadJobs(statusFilter);
  });

  async function handleCreate(title: string, description?: string, requirements?: string) {
    const j = await addJob(title, description, requirements);
    if (j) showForm = false;
  }

  function filterByStatus(status?: string) {
    statusFilter = status;
    loadJobs(status);
  }
</script>

<div class="flex h-full flex-col gap-4 p-4">
  <div class="flex items-center gap-2">
    <h1 class="text-lg font-semibold">Jobs</h1>
    <button
      onclick={() => (showForm = !showForm)}
      class="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
    >
      {showForm ? 'Cancel' : '+ Add Job'}
    </button>
  </div>

  {#if showForm}
    <JobForm oncreate={handleCreate} />
  {/if}

  <!-- Status filter -->
  <div class="flex gap-2">
    <button
      onclick={() => filterByStatus(undefined)}
      class="rounded-full px-3 py-1 text-xs transition-colors {!statusFilter ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
    >All</button>
    <button
      onclick={() => filterByStatus('open')}
      class="rounded-full px-3 py-1 text-xs transition-colors {statusFilter === 'open' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
    >Open</button>
    <button
      onclick={() => filterByStatus('closed')}
      class="rounded-full px-3 py-1 text-xs transition-colors {statusFilter === 'closed' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
    >Closed</button>
  </div>

  <!-- Job cards -->
  {#if jobsStore.loading}
    <p class="py-4 text-center text-sm text-zinc-500">Loading...</p>
  {:else if jobsStore.jobs.length === 0}
    <p class="py-4 text-center text-sm text-zinc-500">No jobs yet</p>
  {:else}
    <div class="grid flex-1 gap-3 overflow-y-auto sm:grid-cols-2">
      {#each jobsStore.jobs as job (job.id)}
        <div class="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
          <div class="flex items-start justify-between">
            <h3 class="font-medium text-zinc-100">{job.title}</h3>
            <span class="rounded-full px-2 py-0.5 text-xs {job.status === 'open' ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}">
              {job.status}
            </span>
          </div>
          {#if job.description}
            <p class="mt-2 line-clamp-3 text-sm text-zinc-400">{job.description}</p>
          {/if}
          {#if job.requirements}
            <p class="mt-1 text-xs text-zinc-500">Requirements: {job.requirements}</p>
          {/if}
          <div class="mt-3 flex gap-2">
            <button
              onclick={() => removeJob(job.id)}
              class="rounded px-2 py-1 text-xs text-zinc-500 hover:text-red-400"
            >Delete</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
