<script lang="ts">
  import { settingsStore, updateSettings, resetSettings } from '$lib/stores/settings-store';

  let model = $state(settingsStore.model);
  let theme = $state(settingsStore.theme);
  let proxyUrl = $state(settingsStore.proxy_url);
  let proxyApiKey = $state(settingsStore.settings.proxy_api_key);
  let ollamaUrl = $state(settingsStore.ollama_url);
  let saved = $state(false);

  const models = [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'ollama:llama3.2', label: 'Ollama - Llama 3.2' },
    { value: 'ollama:mistral', label: 'Ollama - Mistral' },
  ];

  function handleSave() {
    updateSettings({ model, theme, proxy_url: proxyUrl, proxy_api_key: proxyApiKey, ollama_url: ollamaUrl });
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }

  function handleReset() {
    resetSettings();
    model = settingsStore.model;
    theme = settingsStore.theme;
    proxyUrl = settingsStore.proxy_url;
    proxyApiKey = settingsStore.settings.proxy_api_key;
    ollamaUrl = settingsStore.ollama_url;
  }
</script>

<div class="mx-auto max-w-2xl p-8">
  <div class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-bold text-zinc-100">Settings</h1>
    <a href="/" class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700">
      Back to Chat
    </a>
  </div>

  <div class="space-y-6">
    <!-- Model -->
    <div>
      <label for="model" class="mb-2 block text-sm font-medium text-zinc-300">AI Model</label>
      <select
        id="model"
        bind:value={model}
        class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none"
      >
        {#each models as m}
          <option value={m.value}>{m.label}</option>
        {/each}
      </select>
    </div>

    <!-- Theme -->
    <div>
      <label for="theme" class="mb-2 block text-sm font-medium text-zinc-300">Theme</label>
      <select
        id="theme"
        bind:value={theme}
        class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none"
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="system">System</option>
      </select>
    </div>

    <!-- Proxy URL -->
    <div>
      <label for="proxy" class="mb-2 block text-sm font-medium text-zinc-300">Proxy URL</label>
      <input
        id="proxy"
        type="url"
        bind:value={proxyUrl}
        class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
        placeholder="http://localhost:8787"
      />
    </div>

    <!-- Proxy API Key -->
    <div>
      <label for="apikey" class="mb-2 block text-sm font-medium text-zinc-300">Proxy API Key</label>
      <input
        id="apikey"
        type="password"
        bind:value={proxyApiKey}
        class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
        placeholder="Enter your proxy API key"
      />
    </div>

    <!-- Ollama URL -->
    <div>
      <label for="ollama" class="mb-2 block text-sm font-medium text-zinc-300">Ollama URL</label>
      <input
        id="ollama"
        type="url"
        bind:value={ollamaUrl}
        class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
        placeholder="http://localhost:11434"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-4 pt-4">
      <button
        onclick={handleSave}
        class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Save Settings
      </button>
      <button
        onclick={handleReset}
        class="rounded-lg bg-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-600"
      >
        Reset to Defaults
      </button>
      {#if saved}
        <span class="text-sm text-green-400">Saved!</span>
      {/if}
    </div>
  </div>
</div>
