<script lang="ts">
  import type { Candidate } from '$lib/types';

  let { candidate }: { candidate: Candidate } = $props();

  // Parse structured data from JSON string
  let parsedInfo = $derived.by(() => {
    if (!candidate.parsed_data) return null;
    try {
      return JSON.parse(candidate.parsed_data) as {
        name?: string;
        email?: string;
        phone?: string;
        skills?: string[];
        experience?: { title: string; company: string; duration: string }[];
      };
    } catch {
      return null;
    }
  });
</script>

<div class="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
  <h2 class="text-lg font-semibold">{candidate.name}</h2>

  <div class="mt-2 space-y-1 text-sm text-zinc-400">
    {#if candidate.email}<p>Email: {candidate.email}</p>{/if}
    {#if candidate.phone}<p>Phone: {candidate.phone}</p>{/if}
    {#if candidate.resume_path}
      <p class="text-xs text-green-400">CV uploaded</p>
    {:else}
      <p class="text-xs text-zinc-600">No CV uploaded</p>
    {/if}
  </div>

  {#if parsedInfo}
    <div class="mt-4 space-y-3">
      {#if parsedInfo.skills?.length}
        <div>
          <h3 class="text-xs font-medium uppercase tracking-wide text-zinc-500">Skills</h3>
          <div class="mt-1 flex flex-wrap gap-1">
            {#each parsedInfo.skills as skill}
              <span class="rounded-full bg-blue-600/20 px-2 py-0.5 text-xs text-blue-300">{skill}</span>
            {/each}
          </div>
        </div>
      {/if}

      {#if parsedInfo.experience?.length}
        <div>
          <h3 class="text-xs font-medium uppercase tracking-wide text-zinc-500">Experience</h3>
          <div class="mt-1 space-y-1">
            {#each parsedInfo.experience as exp}
              <div class="text-sm">
                <span class="text-zinc-200">{exp.title}</span>
                <span class="text-zinc-500"> at {exp.company}</span>
                {#if exp.duration}<span class="text-zinc-600"> ({exp.duration})</span>{/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else if candidate.resume_path}
    <p class="mt-3 text-xs text-zinc-500">CV uploaded but not yet processed.</p>
  {/if}
</div>
