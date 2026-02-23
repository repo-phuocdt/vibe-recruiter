<script lang="ts">
  let {
    oncreate,
  }: {
    oncreate: (title: string, description?: string, requirements?: string) => void;
  } = $props();

  let title = $state('');
  let description = $state('');
  let requirements = $state('');

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;
    oncreate(title.trim(), description || undefined, requirements || undefined);
    title = '';
    description = '';
    requirements = '';
  }
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-800 p-3">
  <input
    bind:value={title}
    placeholder="Job title *"
    class="rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
  />
  <textarea
    bind:value={description}
    placeholder="Description"
    rows="3"
    class="rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
  ></textarea>
  <input
    bind:value={requirements}
    placeholder="Requirements (comma-separated)"
    class="rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
  />
  <button type="submit" class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
    Create Job
  </button>
</form>
