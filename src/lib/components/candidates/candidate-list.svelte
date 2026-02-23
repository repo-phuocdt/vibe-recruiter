<script lang="ts">
  import {
    candidatesStore,
    loadCandidates,
    addCandidate,
    removeCandidate,
    selectCandidateById,
    clearSelection,
  } from '$lib/stores/candidates-store';
  import CandidateCard from './candidate-card.svelte';
  import CvUpload from './cv-upload.svelte';

  let searchQuery = $state('');
  let showAddForm = $state(false);
  let newName = $state('');
  let newEmail = $state('');
  let newPhone = $state('');

  $effect(() => {
    loadCandidates();
  });

  async function handleSearch() {
    await loadCandidates(searchQuery || undefined);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const c = await addCandidate(newName.trim(), newEmail || undefined, newPhone || undefined);
    if (c) {
      newName = '';
      newEmail = '';
      newPhone = '';
      showAddForm = false;
    }
  }

  function handleSelect(id: string) {
    selectCandidateById(id);
  }
</script>

<div class="flex h-full gap-4 p-4">
  <!-- Left: list -->
  <div class="flex w-1/2 flex-col gap-3">
    <div class="flex items-center gap-2">
      <h1 class="text-lg font-semibold">Candidates</h1>
      <button
        onclick={() => (showAddForm = !showAddForm)}
        class="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
      >
        {showAddForm ? 'Cancel' : '+ Add'}
      </button>
    </div>

    {#if showAddForm}
      <form onsubmit={(e) => { e.preventDefault(); handleAdd(); }} class="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-800 p-3">
        <input bind:value={newName} placeholder="Name *" class="rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500" />
        <input bind:value={newEmail} placeholder="Email" class="rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500" />
        <input bind:value={newPhone} placeholder="Phone" class="rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500" />
        <button type="submit" class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">Create</button>
      </form>
    {/if}

    <!-- Search -->
    <div class="flex gap-2">
      <input
        bind:value={searchQuery}
        oninput={handleSearch}
        placeholder="Search candidates..."
        class="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>

    <!-- Table -->
    {#if candidatesStore.loading}
      <p class="py-4 text-center text-sm text-zinc-500">Loading...</p>
    {:else if candidatesStore.candidates.length === 0}
      <p class="py-4 text-center text-sm text-zinc-500">No candidates yet</p>
    {:else}
      <div class="flex-1 overflow-y-auto">
        {#each candidatesStore.candidates as c (c.id)}
          <div
            role="button"
            tabindex="0"
            onclick={() => handleSelect(c.id)}
            onkeydown={(e) => { if (e.key === 'Enter') handleSelect(c.id); }}
            class="mb-1 flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-800
              {candidatesStore.selected?.id === c.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300'}"
          >
            <div>
              <p class="font-medium">{c.name}</p>
              {#if c.email}<p class="text-xs text-zinc-500">{c.email}</p>{/if}
            </div>
            <button
              onclick={(e) => { e.stopPropagation(); removeCandidate(c.id); }}
              class="rounded p-1 text-zinc-600 hover:text-red-400"
              aria-label="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Right: detail -->
  <div class="w-1/2">
    {#if candidatesStore.selected}
      <CandidateCard candidate={candidatesStore.selected} />
      <div class="mt-3">
        <CvUpload candidateId={candidatesStore.selected.id} onprocessed={() => selectCandidateById(candidatesStore.selected!.id)} />
      </div>
    {:else}
      <div class="flex h-full items-center justify-center text-sm text-zinc-500">
        Select a candidate to view details
      </div>
    {/if}
  </div>
</div>
