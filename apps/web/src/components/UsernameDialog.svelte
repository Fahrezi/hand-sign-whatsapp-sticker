<script lang="ts">
  import { onMount } from 'svelte'
  import { USERNAME_PATTERN } from '@hand-sign/shared'
  import { setUsername } from '../lib/auth.svelte'

  let dialog: HTMLDialogElement
  let value = $state('')
  let error = $state('')
  let saving = $state(false)

  const normalized = $derived(value.trim().toLowerCase())
  const valid = $derived(USERNAME_PATTERN.test(normalized))

  onMount(() => dialog.showModal())

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!valid || saving) return
    saving = true
    error = ''
    try {
      await setUsername(normalized)
      dialog.close()
    } catch (err) {
      error = (err as Error).message
    } finally {
      saving = false
    }
  }
</script>

<!-- required step: Escape must not dismiss it -->
<dialog bind:this={dialog} oncancel={(e) => e.preventDefault()} class="pixel-card">
  <form onsubmit={submit}>
    <h2>Pilih Username</h2>
    <p>Username ini unik dan akan tampil di gestur kamu.</p>
    <div class="field">
      <span>@</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value
        autofocus
        maxlength="20"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="username_kamu"
        aria-label="Username"
      />
    </div>
    <p class="hint" class:bad={value && !valid}>3–20 karakter: huruf kecil, angka, atau _</p>
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" disabled={!valid || saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
  </form>
</dialog>

<style>
  dialog { max-width: 360px; margin: auto; }
  dialog::backdrop { background: rgba(0, 0, 0, 0.7); }
  h2 { font-size: 1.2rem; margin: 0 0 6px; }
  p { margin: 0 0 10px; font-size: 0.95rem; }
  .field { display: flex; align-items: center; border: 3px solid #000; background: #fff; }
  .field span { padding: 0 4px 0 8px; font-size: 1.1rem; }
  input {
    flex: 1; min-width: 0; padding: 8px 8px 8px 0; font: inherit; font-size: 1.1rem;
    border: 0; outline: none; background: transparent;
  }
  .field:focus-within { box-shadow: 3px 3px 0 #000; }
  .hint { margin-top: 6px; color: #555; font-size: 0.85rem; }
  .hint.bad, .error { color: #c00; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
