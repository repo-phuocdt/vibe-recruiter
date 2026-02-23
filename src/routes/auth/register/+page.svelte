<script lang="ts">
  import { goto } from '$app/navigation';
  import { settingsStore } from '$lib/stores/settings-store.svelte';
  import { authStore, registerUser, clearAuthError } from '$lib/stores/auth-store.svelte';

  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let mismatch = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    mismatch = false;
    clearAuthError();
    if (password !== confirm) {
      mismatch = true;
      return;
    }
    try {
      await registerUser(email, password, settingsStore.proxy_url);
      goto('/');
    } catch {
      // error shown via authStore.error
    }
  }
</script>

<div class="flex h-screen items-center justify-center bg-zinc-900">
  <div class="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-800 p-8">
    <h1 class="mb-1 text-2xl font-bold text-zinc-100">Create account</h1>
    <p class="mb-6 text-sm text-zinc-400">Vibe Recruiter</p>

    {#if authStore.error}
      <p class="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{authStore.error}</p>
    {/if}
    {#if mismatch}
      <p class="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">Passwords do not match</p>
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
          minlength={8}
          autocomplete="new-password"
          class="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="Min. 8 characters"
        />
      </div>

      <div>
        <label for="confirm" class="mb-1 block text-sm font-medium text-zinc-300">Confirm password</label>
        <input
          id="confirm"
          type="password"
          bind:value={confirm}
          required
          autocomplete="new-password"
          class="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={authStore.isLoading}
        class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {authStore.isLoading ? 'Creating account…' : 'Create account'}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-zinc-400">
      Already have an account?
      <a href="/auth/login" class="text-blue-400 hover:text-blue-300">Sign in</a>
    </p>
  </div>
</div>
