<script lang="ts">
  import { page } from '$app/state';
  import {
    MessageSquare, LayoutDashboard, Users, Briefcase, Settings,
  } from 'lucide-svelte';

  const navItems = [
    { href: '/', label: 'Chat', icon: MessageSquare },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/candidates', label: 'Candidates', icon: Users },
    { href: '/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }
</script>

<nav class="flex flex-col gap-1 p-2">
  {#each navItems as item (item.href)}
    <a
      href={item.href}
      class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {isActive(item.href)
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'}"
    >
      <item.icon size={18} strokeWidth={1.5} />
      <span>{item.label}</span>
    </a>
  {/each}
</nav>
