<script lang="ts">
  import { router } from './lib/router.svelte'
  import CustomHandSign from './routes/CustomHandSign.svelte'
  import Home from './routes/Home.svelte'
  import Login from './routes/Login.svelte'
  import NewHandSign from './routes/NewHandSign.svelte'
  import RequireAuth from './routes/RequireAuth.svelte'
</script>

{#if router.path === '/login'}
  <Login />
{:else if router.path === '/custom-hand-sign'}
  <RequireAuth><CustomHandSign /></RequireAuth>
{:else if router.path === '/custom-hand-sign/new'}
  <RequireAuth><NewHandSign /></RequireAuth>
{:else}
  <Home />
{/if}
