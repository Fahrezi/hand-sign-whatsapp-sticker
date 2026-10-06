<script lang="ts">
  import { onMount } from 'svelte'
  import type { MySignsResponse, UserSignSummary } from '@hand-sign/shared'
  import { api } from '../lib/api'
  import { auth, logout } from '../lib/auth.svelte'
  import { navigate } from '../lib/router.svelte'
  import UsernameDialog from '../components/UsernameDialog.svelte'
  import Starfield from '../components/Starfield.svelte'
  import ConfirmDialog from '../components/ConfirmDialog.svelte'
  import EditSignDialog from '../components/EditSignDialog.svelte'

  // RequireAuth only renders this page once a user is loaded
  const user = $derived(auth.user!)

  let mine = $state<MySignsResponse | null>(null)
  let error = $state('')
  // sign awaiting delete confirmation
  let pendingDelete = $state<UserSignSummary | null>(null)
  let deleting = $state(false)
  let deleteError = $state('')
  // sign open in the edit dialog
  let editing = $state<UserSignSummary | null>(null)

  const full = $derived(mine ? mine.signs.length >= mine.limit : true)

  onMount(async () => {
    try {
      mine = await api<MySignsResponse>('/signs/mine')
    } catch (err) {
      error = (err as Error).message
    }
  })

  function askDelete(sign: UserSignSummary) {
    pendingDelete = sign
    deleteError = ''
  }

  async function confirmDelete() {
    if (!mine || !pendingDelete) return
    const { id } = pendingDelete
    deleting = true
    deleteError = ''
    try {
      await api<void>(`/signs/${id}`, { method: 'DELETE' })
      mine.signs = mine.signs.filter((s) => s.id !== id)
      pendingDelete = null
    } catch (err) {
      deleteError = 'Gagal menghapus: ' + (err as Error).message
    } finally {
      deleting = false
    }
  }

  function onSaved(updated: UserSignSummary) {
    if (mine) mine.signs = mine.signs.map((s) => (s.id === updated.id ? updated : s))
    editing = null
  }

  async function onLogout() {
    await logout()
    navigate('/', { replace: true })
  }
</script>

<Starfield />

{#if !user.username}
  <UsernameDialog />
{:else}
  <div class="page">
    <div class="pixel-card">
      <h1>
        <a href="/" onclick={(e) => { e.preventDefault(); navigate('/') }}>Hand Gesture Sticker</a>
      </h1>
    </div>

    <div class="pixel-card account">
      {#if user.picture}
        <img class="avatar" src={user.picture} alt="" referrerpolicy="no-referrer" />
      {:else}
        <div class="avatar placeholder">{user.username[0].toUpperCase()}</div>
      {/if}
      <div class="who">
        <div class="username">@{user.username}</div>
        <div class="email">{user.email}</div>
      </div>
      <button class="small" onclick={onLogout}>Logout</button>
    </div>

    <div class="pixel-card">
      <div class="list-head">
        <h2>Gestur Kamu</h2>
        {#if mine}<span class="count">{mine.signs.length}/{mine.limit}</span>{/if}
      </div>

      {#if error}
        <p class="error">{error}</p>
      {:else if !mine}
        <p class="muted">Memuat...</p>
      {:else}
        <div class="grid">
          {#each mine.signs as sign (sign.id)}
            <div class="tile">
              <img src={sign.stickerUrl} alt="" />
              <span class="name">{sign.name}</span>
              <button
                class="edit"
                onclick={() => (editing = sign)}
                aria-label={`Edit ${sign.name}`}
                title="Edit"
              >✎</button>
              <button
                class="delete"
                onclick={() => askDelete(sign)}
                aria-label={`Hapus ${sign.name}`}
                title="Hapus"
              >✕</button>
            </div>
          {/each}
          <button
            class="tile add"
            onclick={() => navigate('/custom-hand-sign/new')}
            disabled={full}
            aria-label="Buat gestur baru"
            title={full ? `Maksimal ${mine.limit} gestur` : 'Buat gestur baru'}
          >
            <span class="plus">+</span>
            <span class="name">{full ? 'Penuh' : 'Buat Baru'}</span>
          </button>
        </div>
      {/if}
    </div>

    <button onclick={() => navigate('/')}>Kembali</button>
  </div>

  <ConfirmDialog
    open={pendingDelete !== null}
    title="Hapus Gestur"
    message={`Hapus gestur "${pendingDelete?.name ?? ''}"? Tindakan ini tidak bisa dibatalkan.`}
    busy={deleting}
    error={deleteError}
    onconfirm={confirmDelete}
    oncancel={() => (pendingDelete = null)}
  />

  <EditSignDialog sign={editing} onsaved={onSaved} oncancel={() => (editing = null)} />
{/if}

<style>
  /* body doesn't scroll (camera page), so this page scrolls itself */
  .page { flex: 1; overflow-y: auto; padding: 8px 8px 24px; }

  /* gold frame + hard black drop shadow, same as the Home cards */
  .pixel-card {
    border: 4px solid #ffd700; outline: none;
    box-shadow: inset 0 0 0 2px #b8860b, 8px 8px 0 #000;
  }

  h1 { font-size: 1.4rem; letter-spacing: 1px; margin: 0; }
  h1 a { color: inherit; text-decoration: none; }
  h1 a:hover { text-decoration: underline; }

  .account { display: flex; align-items: center; gap: 12px; text-align: left; }
  .avatar { width: 48px; height: 48px; border: 3px solid #000; image-rendering: pixelated; flex-shrink: 0; }
  .placeholder { display: grid; place-items: center; background: #222; color: #fff; font-size: 1.4rem; }
  .who { flex: 1; min-width: 0; }
  .username { font-size: 1.2rem; }
  .email { font-size: 0.85rem; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.small { margin: 0; padding: 4px 10px; font-size: 0.9rem; width: auto; }

  .list-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  h2 { font-size: 1.1rem; margin: 0; }
  .count { font-size: 0.9rem; color: #555; }
  .muted { color: #555; }
  .error { color: #c00; }

  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .tile {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    aspect-ratio: 1; padding: 8px; margin: 0; width: auto;
    background: #222; color: #eee; border: 3px solid #000; box-shadow: 4px 4px 0 #000;
  }
  .tile { position: relative; }
  .delete, .edit {
    position: absolute; top: 4px; right: 4px; margin: 0; padding: 0; width: 28px; height: 28px;
    display: grid; place-items: center; font-size: 0.9rem; line-height: 1;
    background: #e03; color: #fff; border: 2px solid #000; box-shadow: 2px 2px 0 #000;
  }
  .edit { left: 4px; right: auto; background: #ffd700; color: #000; }
  .delete:active, .edit:active { box-shadow: 1px 1px 0 #000; transform: translate(1px, 1px); }
  .tile img { max-width: 80%; max-height: 70%; object-fit: contain; image-rendering: pixelated; }
  .name { font-size: 0.95rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .add { background: #fff; color: #000; border-style: dashed; cursor: pointer; }
  .add:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; transform: none; }
  .plus { font-size: 3rem; line-height: 1; }
</style>
