<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let caught = $state<string | null>(null);

  $effect(() => {
    function onUnhandledRejection(e: PromiseRejectionEvent) {
      caught = e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Unknown error');
      e.preventDefault();
    }

    function onError(e: ErrorEvent) {
      caught = e.message ?? 'Unknown error';
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  });

  function dismiss() {
    caught = null;
  }
</script>

{#if caught}
  <div
    role="alert"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
  >
    <div class="w-full max-w-md rounded-xl border border-red-800 bg-zinc-900 p-6 shadow-xl">
      <h2 class="mb-2 text-base font-semibold text-red-400">Something went wrong</h2>
      <p class="mb-4 break-words text-sm text-zinc-400">{caught}</p>
      <div class="flex gap-3">
        <button
          onclick={dismiss}
          class="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
        >
          Dismiss
        </button>
        <button
          onclick={() => location.reload()}
          class="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Reload app
        </button>
      </div>
    </div>
  </div>
{/if}

{@render children()}
