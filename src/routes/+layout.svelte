<script lang="ts">
  import '../app.css';
  import ErrorBoundary from '$lib/components/shared/error-boundary.svelte';
  import OfflineBanner from '$lib/components/shared/offline-banner.svelte';
  import { settingsStore } from '$lib/stores/settings-store.svelte';
  import { initAuth } from '$lib/stores/auth-store.svelte';

  let { children } = $props();

  // Attempt silent token refresh on startup; fails gracefully if unavailable
  $effect(() => {
    if (settingsStore.proxy_url) {
      initAuth(settingsStore.proxy_url).catch(() => {});
    }
  });
</script>

<ErrorBoundary>
  <OfflineBanner />
  {@render children()}
</ErrorBoundary>
