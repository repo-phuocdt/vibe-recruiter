<script lang="ts">
  import { uploadCv, processCv } from '$lib/services/tauri-commands';
  import { settingsStore } from '$lib/stores/settings-store.svelte';

  let {
    candidateId,
    onprocessed,
  }: {
    candidateId: string;
    onprocessed?: () => void;
  } = $props();

  let status = $state<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  let errorMsg = $state('');

  async function handleUploadAndProcess() {
    status = 'uploading';
    errorMsg = '';

    try {
      // Open file dialog (uses Tauri dialog plugin from JS side)
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!filePath || typeof filePath !== 'string') {
        status = 'idle';
        return;
      }

      await uploadCv(candidateId, filePath);

      // Process CV (parse + embed)
      status = 'processing';
      await processCv(
        candidateId,
        settingsStore.proxy_url,
        settingsStore.settings.proxy_api_key
      );

      status = 'done';
      onprocessed?.();
    } catch (e) {
      status = 'error';
      errorMsg = e instanceof Error ? e.message : 'Upload failed';
    }
  }
</script>

<div>
  <button
    onclick={handleUploadAndProcess}
    disabled={status === 'uploading' || status === 'processing'}
    class="rounded-lg px-4 py-2 text-sm font-medium transition-colors
      {status === 'uploading' || status === 'processing'
        ? 'cursor-wait bg-zinc-700 text-zinc-400'
        : 'bg-blue-600 text-white hover:bg-blue-500'}"
  >
    {#if status === 'uploading'}
      Uploading...
    {:else if status === 'processing'}
      Processing CV...
    {:else if status === 'done'}
      Upload & Process CV
    {:else}
      Upload & Process CV
    {/if}
  </button>

  {#if status === 'done'}
    <p class="mt-1 text-xs text-green-400">CV processed successfully!</p>
  {/if}

  {#if status === 'error'}
    <p class="mt-1 text-xs text-red-400">{errorMsg}</p>
  {/if}
</div>
