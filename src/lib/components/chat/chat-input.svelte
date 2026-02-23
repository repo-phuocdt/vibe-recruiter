<script lang="ts">
  let { onsend, disabled = false }: { onsend: (input: string) => void; disabled?: boolean } = $props();

  let value = $state('');
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 200) + 'px';
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onsend(trimmed);
    value = '';
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div class="border-t border-zinc-800 bg-zinc-900 px-4 py-3">
  <div class="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 focus-within:border-zinc-500">
    <textarea
      bind:this={textareaEl}
      bind:value
      oninput={autoResize}
      onkeydown={handleKeydown}
      {disabled}
      placeholder="Message..."
      rows={1}
      class="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none disabled:opacity-50"
      style="max-height: 200px; overflow-y: auto;"
    ></textarea>
    <button
      onclick={handleSend}
      disabled={disabled || !value.trim()}
      class="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-opacity hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Send message"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
      </svg>
    </button>
  </div>
  <p class="mt-1.5 text-center text-xs text-zinc-600">Enter to send · Shift+Enter for newline</p>
</div>
