<script lang="ts">
  let online = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);

  $effect(() => {
    function setOnline() { online = true; }
    function setOffline() { online = false; }

    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  });
</script>

{#if !online}
  <div
    role="alert"
    class="flex items-center justify-center gap-2 bg-amber-600 px-4 py-1.5 text-xs font-medium text-white"
  >
    <span class="inline-block h-2 w-2 rounded-full bg-amber-300"></span>
    Offline — data management only. Chat and AI features unavailable.
  </div>
{/if}
