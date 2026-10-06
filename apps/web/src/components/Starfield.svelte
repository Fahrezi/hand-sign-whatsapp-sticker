<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { Starfield } from '../lib/effects/starfield'

  // fades the stars out, e.g. while a sign's gradient background is showing
  let { hidden = false }: { hidden?: boolean } = $props()

  let canvas: HTMLCanvasElement
  let starfield: Starfield | null = null

  onMount(() => {
    starfield = new Starfield(canvas)
  })
  onDestroy(() => starfield?.destroy())
</script>

<canvas class:hidden bind:this={canvas}></canvas>

<style>
  /* space background behind everything (other background layers sit at z-index -1) */
  canvas {
    position: fixed; inset: 0; width: 100%; height: 100%; z-index: -2; pointer-events: none;
    transition: opacity 0.5s ease;
  }
  canvas.hidden { opacity: 0; }
</style>
