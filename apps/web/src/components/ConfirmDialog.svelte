<script lang="ts">
  interface Props {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    // while true the buttons are disabled and the dialog can't be dismissed
    busy?: boolean
    error?: string
    onconfirm: () => void
    oncancel: () => void
  }

  let {
    open,
    title,
    message,
    confirmLabel = 'Hapus',
    busy = false,
    error = '',
    onconfirm,
    oncancel,
  }: Props = $props()

  let dialog: HTMLDialogElement

  $effect(() => {
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })

  function cancel(e?: Event) {
    // Escape fires `cancel`; keep the dialog up while the action is running
    e?.preventDefault()
    if (!busy) oncancel()
  }
</script>

<dialog bind:this={dialog} oncancel={cancel} class="pixel-card">
  <h2>{title}</h2>
  <p>{message}</p>
  {#if error}<p class="error">{error}</p>{/if}
  <div class="actions">
    <button onclick={() => cancel()} disabled={busy}>Batal</button>
    <!-- svelte-ignore a11y_autofocus -->
    <button class="danger" onclick={onconfirm} disabled={busy} autofocus>
      {busy ? 'Menghapus...' : confirmLabel}
    </button>
  </div>
</dialog>

<style>
  dialog { max-width: 360px; margin: auto; }
  dialog::backdrop { background: rgba(0, 0, 0, 0.7); }
  h2 { font-size: 1.2rem; margin: 0 0 6px; }
  p { margin: 0 0 10px; font-size: 0.95rem; overflow-wrap: anywhere; }
  .error { color: #c00; }
  .actions { display: flex; gap: 10px; justify-content: flex-end; }
  .actions button { flex: 1; }
  .danger { background: #e03; color: #fff; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
