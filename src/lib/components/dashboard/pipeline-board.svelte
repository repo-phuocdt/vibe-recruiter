<script lang="ts">
  import type { PipelineCandidate, PipelineStage } from '$lib/types';
  import { PIPELINE_STAGES } from '$lib/types';
  import { dndzone } from 'svelte-dnd-action';
  import CandidatePipelineCard from './candidate-pipeline-card.svelte';

  let {
    candidatesByStage,
    onmove,
  }: {
    candidatesByStage: Record<string, PipelineCandidate[]>;
    onmove: (applicationId: string, newStage: PipelineStage) => void;
  } = $props();

  const stageLabels: Record<string, string> = {
    new: 'New',
    screening: 'Screening',
    interview: 'Interview',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
  };

  const stageColors: Record<string, string> = {
    new: 'border-blue-500/30',
    screening: 'border-yellow-500/30',
    interview: 'border-purple-500/30',
    offer: 'border-cyan-500/30',
    hired: 'border-green-500/30',
    rejected: 'border-red-500/30',
  };

  // Local mutable copy for DnD — synced from prop
  type DndItem = PipelineCandidate & { id: string };
  let localColumns = $state<Record<string, DndItem[]>>({});

  $effect(() => {
    const next: Record<string, DndItem[]> = {};
    for (const stage of PIPELINE_STAGES) {
      next[stage] = (candidatesByStage[stage] ?? []).map((c) => ({
        ...c,
        id: c.application_id,
      }));
    }
    localColumns = next;
  });

  function handleDndConsider(stage: string, e: CustomEvent<{ items: DndItem[] }>) {
    localColumns[stage] = e.detail.items;
  }

  function handleDndFinalize(stage: string, e: CustomEvent<{ items: DndItem[] }>) {
    localColumns[stage] = e.detail.items;
    for (const item of e.detail.items) {
      if (item.stage !== stage) {
        onmove(item.application_id, stage as PipelineStage);
      }
    }
  }
</script>

<div class="flex gap-3 overflow-x-auto pb-2">
  {#each PIPELINE_STAGES as stage (stage)}
    {@const items = localColumns[stage] ?? []}
    <div class="flex w-52 shrink-0 flex-col rounded-lg border {stageColors[stage]} bg-zinc-900/50">
      <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-400">{stageLabels[stage]}</h3>
        <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {items.length}
        </span>
      </div>
      <div
        class="flex min-h-[120px] flex-1 flex-col gap-2 p-2"
        use:dndzone={{ items, type: 'candidate', dropTargetStyle: {} }}
        onconsider={(e) => handleDndConsider(stage, e)}
        onfinalize={(e) => handleDndFinalize(stage, e)}
      >
        {#each items as item (item.id)}
          <CandidatePipelineCard candidate={item} />
        {/each}
      </div>
    </div>
  {/each}
</div>
