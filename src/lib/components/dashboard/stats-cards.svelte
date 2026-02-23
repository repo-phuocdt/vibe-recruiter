<script lang="ts">
  import type { DashboardStats } from '$lib/types';
  import { Users, Briefcase, GitPullRequest, UserCheck } from 'lucide-svelte';

  let { stats }: { stats: DashboardStats | null } = $props();

  const cards = $derived.by(() => {
    if (!stats) return [];
    return [
      { label: 'Total Candidates', value: stats.total_candidates, icon: Users, color: 'text-blue-400' },
      { label: 'Active Jobs', value: stats.active_jobs, icon: Briefcase, color: 'text-green-400' },
      { label: 'In Pipeline', value: stats.total_applications, icon: GitPullRequest, color: 'text-yellow-400' },
      { label: 'Hired', value: stats.hired_count, icon: UserCheck, color: 'text-emerald-400' },
    ];
  });
</script>

<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
  {#each cards as card (card.label)}
    <div class="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-zinc-900 p-2 {card.color}">
          <card.icon size={20} strokeWidth={1.5} />
        </div>
        <div>
          <p class="text-2xl font-bold text-zinc-100">{card.value}</p>
          <p class="text-xs text-zinc-400">{card.label}</p>
        </div>
      </div>
    </div>
  {/each}
</div>
