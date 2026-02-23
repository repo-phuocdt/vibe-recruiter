<script lang="ts">
  import type { PipelineCandidate } from '$lib/types';

  let { candidate }: { candidate: PipelineCandidate } = $props();

  const initials = $derived(
    (candidate.candidate_name || '?')
      .split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );

  const daysInStage = $derived.by(() => {
    const created = new Date(candidate.created_at).getTime();
    const now = Date.now();
    return Math.floor((now - created) / 86_400_000);
  });
</script>

<a
  href="/candidates/{candidate.candidate_id}"
  class="block rounded-lg border border-zinc-700 bg-zinc-800/80 p-3 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
>
  <div class="flex items-center gap-2">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-medium text-blue-300">
      {initials}
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-zinc-100">{candidate.candidate_name}</p>
      <p class="truncate text-xs text-zinc-500">{candidate.job_title}</p>
    </div>
  </div>
  <div class="mt-2 flex items-center justify-between text-xs text-zinc-500">
    {#if candidate.candidate_email}
      <span class="truncate">{candidate.candidate_email}</span>
    {:else}
      <span>No email</span>
    {/if}
    <span class="shrink-0">{daysInStage}d</span>
  </div>
</a>
