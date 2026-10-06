<script lang="ts">
  import { onMount } from 'svelte'
  import { loadSession, loginWithGoogle } from '../lib/auth.svelte'
  import { loadGoogleIdentity } from '../lib/google'
  import { navigate, router, safeNext } from '../lib/router.svelte'

  const next = safeNext(router.searchParams.get('next'))

  let buttonEl: HTMLDivElement
  let error = $state('')
  let busy = $state(false)

  onMount(async () => {
    try {
      if (await loadSession()) return navigate(next, { replace: true })

      const google = await loadGoogleIdentity()
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          busy = true
          error = ''
          try {
            await loginWithGoogle(credential)
            navigate(next, { replace: true })
          } catch (err) {
            error = 'Login gagal: ' + (err as Error).message
          } finally {
            busy = false
          }
        },
      })
      // locale "id" renders the label as "Login dengan Google"
      google.accounts.id.renderButton(buttonEl, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'id',
      })
    } catch (err) {
      error = (err as Error).message
    }
  })
</script>

<div class="pixel-card login">
  <h1>Login</h1>
  <p>Login dulu untuk membuat gestur kamu sendiri.</p>
  <div class="google-btn" bind:this={buttonEl} class:busy></div>
  {#if error}<p class="error">{error}</p>{/if}
  <button onclick={() => navigate('/')}>Kembali</button>
</div>

<style>
  .login { margin-top: auto; margin-bottom: auto; }
  h1 { font-size: 1.4rem; letter-spacing: 1px; margin: 0 0 8px; }
  p { margin: 0 0 12px; }
  .google-btn { display: flex; justify-content: center; min-height: 44px; }
  .busy { opacity: 0.5; pointer-events: none; }
  .error { color: #c00; margin-top: 8px; }
</style>
