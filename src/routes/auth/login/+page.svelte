<script lang="ts">
  import { goto } from '$app/navigation';
  import { settingsStore } from '$lib/stores/settings-store.svelte';
  import { authStore, loginUser, clearAuthError } from '$lib/stores/auth-store.svelte';

  let email = $state('');
  let password = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    clearAuthError();
    try {
      await loginUser(email, password, settingsStore.proxy_url);
      goto('/');
    } catch {
      // error shown via authStore.error
    }
  }
</script>

<div class="flex h-screen items-center justify-center bg-zinc-900">
  <div class="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-800 p-8">
    <h1 class="mb-1 text-2xl font-bold text-zinc-100">Sign in</h1>
    <p class="mb-6 text-sm text-zinc-400">Vibe Recruiter</p>

    {#if authStore.error}
      <p class="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{authStore.error}</p>
    {/if}

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-zinc-300">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          class="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-zinc-300">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          class="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={authStore.isLoading}
        class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {authStore.isLoading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-zinc-400">
      No account?
      <a href="/auth/register" class="text-blue-400 hover:text-blue-300">Register</a>
    </p>
    <p class="mt-2 text-center text-sm text-zinc-500">
      <a href="/" class="hover:text-zinc-400">Continue without account →</a>
    </p>
  </div>
</div>
