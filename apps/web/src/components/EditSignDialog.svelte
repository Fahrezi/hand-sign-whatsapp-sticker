<script lang="ts">
  import {
    CUSTOM_SIGN_NAME_MAX,
    STICKER_MAX_BYTES,
    STICKER_TYPES,
    type UpdateSignRequest,
    type UserSignSummary,
  } from '@hand-sign/shared'
  import { api } from '../lib/api'

  interface Props {
    // dialog is open while this is set
    sign: UserSignSummary | null
    onsaved: (sign: UserSignSummary) => void
    oncancel: () => void
  }

  let { sign, onsaved, oncancel }: Props = $props()

  let dialog: HTMLDialogElement
  let fileInput = $state<HTMLInputElement>()
  let name = $state('')
  let confetti = $state('')
  let stickerFile = $state<File | null>(null)
  let stickerPreview = $state('')
  let stickerError = $state('')
  let saving = $state(false)
  let error = $state('')

  const canSave = $derived(!!name.trim() && !!confetti.trim() && !stickerError && !saving)

  // reset the form each time a sign is opened
  $effect(() => {
    if (sign && !dialog.open) {
      name = sign.name
      confetti = sign.confetti
      clearSticker()
      error = ''
      dialog.showModal()
    } else if (!sign && dialog.open) {
      dialog.close()
    }
  })

  function clearSticker() {
    if (stickerPreview) URL.revokeObjectURL(stickerPreview)
    stickerPreview = ''
    stickerFile = null
    stickerError = ''
    if (fileInput) fileInput.value = ''
  }

  function onStickerChange(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null
    if (stickerPreview) URL.revokeObjectURL(stickerPreview)
    stickerPreview = ''
    stickerFile = null
    stickerError = ''
    if (!file) return
    if (!(STICKER_TYPES as readonly string[]).includes(file.type)) {
      stickerError = 'Harus PNG, JPG, WEBP, atau GIF'
    } else if (file.size > STICKER_MAX_BYTES) {
      stickerError = `Maksimal ${STICKER_MAX_BYTES / 1024 / 1024}MB`
    } else {
      stickerFile = file
      stickerPreview = URL.createObjectURL(file)
    }
  }

  function cancel(e?: Event) {
    // Escape fires `cancel`; keep the dialog up while saving
    e?.preventDefault()
    if (!saving) {
      clearSticker()
      oncancel()
    }
  }

  async function save(e: SubmitEvent) {
    e.preventDefault()
    if (!sign || !canSave) return
    saving = true
    error = ''
    try {
      const body: UpdateSignRequest = { name: name.trim(), confetti: confetti.trim() }
      const form = new FormData()
      form.append('data', JSON.stringify(body))
      if (stickerFile) form.append('sticker', stickerFile)
      const updated = await api<UserSignSummary>(`/signs/${sign.id}`, { method: 'PATCH', body: form })
      clearSticker()
      onsaved(updated)
    } catch (err) {
      error = 'Gagal menyimpan: ' + (err as Error).message
    } finally {
      saving = false
    }
  }
</script>

<dialog bind:this={dialog} oncancel={cancel} class="pixel-card">
  <form onsubmit={save}>
    <h2>Edit Gestur</h2>

    <label class="field">
      <span>Nama gestur</span>
      <input bind:value={name} maxlength={CUSTOM_SIGN_NAME_MAX} required />
    </label>

    <label class="field">
      <span>Confetti</span>
      <input bind:value={confetti} maxlength="16" class="confetti" required />
    </label>

    <div class="field">
      <span>Sticker</span>
      <img class="preview" src={stickerPreview || sign?.stickerUrl} alt="Preview sticker" />
      <input bind:this={fileInput} type="file" accept={STICKER_TYPES.join(',')} onchange={onStickerChange} />
      {#if stickerError}<p class="error">{stickerError}</p>{/if}
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    <div class="actions">
      <button type="button" onclick={() => cancel()} disabled={saving}>Batal</button>
      <button type="submit" class="primary" disabled={!canSave}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
    </div>
  </form>
</dialog>

<style>
  dialog { max-width: 360px; width: calc(100% - 32px); margin: auto; }
  dialog::backdrop { background: rgba(0, 0, 0, 0.7); }
  form { display: flex; flex-direction: column; gap: 10px; text-align: left; }
  h2 { font-size: 1.2rem; margin: 0; }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .field > span { font-size: 0.95rem; }
  input:not([type='file']) {
    font: inherit; font-size: 1rem; padding: 6px 8px; border: 3px solid #000; background: #fff; min-width: 0;
  }
  input[type='file'] { font-size: 0.85rem; min-width: 0; }
  .confetti { width: 100px; }
  .preview {
    align-self: flex-start; max-height: 80px; max-width: 160px;
    background: #222; border: 3px solid #000; padding: 4px; image-rendering: pixelated;
  }
  .error { color: #c00; margin: 0; font-size: 0.9rem; overflow-wrap: anywhere; }
  .actions { display: flex; gap: 10px; justify-content: flex-end; }
  .actions button { flex: 1; margin: 0; }
  .primary { background: #00e436; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
