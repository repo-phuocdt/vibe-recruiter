<script lang="ts">
  import AppLayout from '$lib/components/layout/app-layout.svelte';
  import UsageDisplay from '$lib/components/settings/usage-display.svelte';
  import { settingsStore, updateSettings, resetSettings } from '$lib/stores/settings-store.svelte';
  import { authStore, logoutUser } from '$lib/stores/auth-store.svelte';
  import { getUsage } from '$lib/services/auth-client';
  import type { UsageStats } from '$lib/types';

  let model = $state(settingsStore.model);
  let theme = $state(settingsStore.theme);
  let proxyUrl = $state(settingsStore.proxy_url);
  let proxyApiKey = $state(settingsStore.settings.proxy_api_key);
  let ollamaUrl = $state(settingsStore.ollama_url);
  let saved = $state(false);
  let usage = $state<UsageStats | null>(null);
  let usageLoading = $state(false);

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

  async function handleLogout() {
    await logoutUser(settingsStore.proxy_url);
    usage = null;
  }

  async function loadUsage() {
    if (!authStore.isAuthenticated || !authStore.accessToken || !settingsStore.proxy_url) return;
    usageLoading = true;
    try {
      usage = await getUsage(authStore.accessToken, settingsStore.proxy_url);
    } catch {
      usage = null;
    } finally {
      usageLoading = false;
    }
  }

  $effect(() => {
    loadUsage();
  });
</script>

<AppLayout>
  <div class="mx-auto max-w-2xl p-8">
    <h1 class="mb-8 text-2xl font-bold text-zinc-100">Settings</h1>

    <div class="space-y-6">
      <!-- LLM Config -->
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

      <!-- Account -->
      <div class="border-t border-zinc-700 pt-6">
        <h2 class="mb-4 text-base font-semibold text-zinc-200">Account</h2>
        {#if authStore.isAuthenticated && authStore.currentUser}
          <div class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-zinc-200">{authStore.currentUser.email}</p>
                <p class="mt-0.5 text-xs capitalize text-zinc-500">
                  {authStore.currentUser.plan} plan
                </p>
              </div>
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
                  {authStore.currentUser.plan === 'pro'
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-zinc-700 text-zinc-300'}"
              >
                {authStore.currentUser.plan}
              </span>
            </div>
            <button
              onclick={handleLogout}
              class="w-full rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-400 hover:border-red-500/50 hover:text-red-400"
            >
              Sign out
            </button>
          </div>
        {:else}
          <div class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-center">
            <p class="mb-3 text-sm text-zinc-400">Sign in for usage tracking and higher limits.</p>
            <div class="flex justify-center gap-3">
              <a
                href="/auth/login"
                class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in
              </a>
              <a
                href="/auth/register"
                class="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500"
              >
                Register
              </a>
            </div>
          </div>
        {/if}
      </div>

      <!-- Usage -->
      {#if authStore.isAuthenticated}
        <div class="border-t border-zinc-700 pt-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-base font-semibold text-zinc-200">Usage</h2>
            <button
              onclick={loadUsage}
              disabled={usageLoading}
              class="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
            >
              {usageLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          <div class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <UsageDisplay {usage} />
          </div>
        </div>
      {/if}
    </div>
  </div>
</AppLayout>
