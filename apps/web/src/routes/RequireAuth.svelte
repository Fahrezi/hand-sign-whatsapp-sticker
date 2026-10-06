<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { auth, loadSession } from '../lib/auth.svelte'
  import { navigate, router } from '../lib/router.svelte'

  let { children }: { children: Snippet } = $props()
  let error = $state('')

  onMount(async () => {
    try {
      if (!(await loadSession())) {
        navigate('/login?next=' + encodeURIComponent(router.path), { replace: true })
      }
    } catch (err) {
      error = (err as Error).message
    }
  })
</script>

{#if auth.user}
  {@render children()}
{:else if error}
  <p class="error">{error}</p>
{/if}

<style>
  .error { color: #f66; margin: auto; }
</style>
