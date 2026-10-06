<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { GestureRecognizer } from '@mediapipe/tasks-vision'
  import type { Sign } from '@hand-sign/shared'
  import { getRecognizer, detectSign, drawHands } from '../lib/recognition/recognizer'
  import type { CustomSignMatcher } from '../lib/recognition/customMatcher'
  import { startCamera, stopCamera } from '../lib/camera'
  import { SignFeedback } from '../lib/effects/feedback'
  import { DEFAULT_SIGNS, DEFAULT_STICKER, loadMyCustomSigns } from '../lib/signs'
  import { navigate } from '../lib/router.svelte'
  import Starfield from '../components/Starfield.svelte'

  // the user's own signs (when logged in) come first, then the defaults
  let signs = $state<Sign[]>(DEFAULT_SIGNS)
  let customMatcher: CustomSignMatcher | null = null

  let video: HTMLVideoElement
  let canvas: HTMLCanvasElement
  let container: HTMLDivElement
  let rippleLayer: HTMLDivElement
  let emojiLayer: HTMLDivElement
  let confettiLayer: HTMLDivElement

  let status = $state('Loading model...')
  let sticker = $state(DEFAULT_STICKER)
  let scoreText = $state('')
  let starting = $state(false)
  let started = $state(false)
  let matched = $state(false)

  let feedback: SignFeedback | null = null
  let rafId: number | null = null

  onMount(() => {
    feedback = new SignFeedback({
      ripple: rippleLayer,
      confetti: confettiLayer,
      emoji: emojiLayer,
      origin: container,
    })
    getRecognizer().then(
      () => {
        if (!started) status = 'Model ready. Click Start Camera.'
      },
      (err) => {
        status = 'Error: ' + err.message
      },
    )
    loadMyCustomSigns().then(
      (custom) => {
        signs = [...custom.data.map((d) => d.sign), ...DEFAULT_SIGNS]
        customMatcher = custom.matcher
      },
      (err) => console.error('Failed to load custom signs:', err),
    )
  })

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId)
    feedback?.destroy()
    stopCamera(video)
  })

  async function start() {
    starting = true
    try {
      const recognizer = await getRecognizer()
      await startCamera(video, canvas)
      started = true
      status = ''
      predictLoop(recognizer)
    } catch (err) {
      status = 'Error: ' + (err as Error).message
    } finally {
      starting = false
    }
  }

  function predictLoop(recognizer: GestureRecognizer) {
    try {
      const now = performance.now()
      const results = recognizer.recognizeForVideo(video, now)
      drawHands(canvas.getContext('2d')!, results)

      const detection = detectSign(results, signs, customMatcher)
      matched = detection.kind === 'match'
      if (detection.kind === 'match') {
        sticker = detection.sign.sticker
        scoreText = `${detection.sign.name} — ${(detection.score * 100).toFixed(1)}%`
        feedback?.update(detection.sign, now)
      } else {
        sticker = DEFAULT_STICKER
        scoreText = detection.kind === 'no-hand' ? 'No hand detected' : 'No sign match'
        feedback?.update(null, now)
      }
    } catch (err) {
      console.error('predictLoop error:', err)
    } finally {
      rafId = requestAnimationFrame(() => predictLoop(recognizer))
    }
  }
</script>

<Starfield hidden={matched} />
<div id="bgRipple" bind:this={rippleLayer}></div>
<div id="emojiFloatLayer" bind:this={emojiLayer}></div>
<div id="confettiLayer" bind:this={confettiLayer}></div>

<div class="pixel-card">
  <h1>Hand Sign Sticker</h1>
</div>

<div id="container" bind:this={container}>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} autoplay playsinline></video>
  <canvas bind:this={canvas}></canvas>
</div>
<div id="status">{status}</div>

<div class="pixel-card" id="resultCard">
  <div id="result"><img src={sticker} alt="sign" /></div>
  <div id="score">{scoreText}</div>
  {#if !started}
    <button onclick={start} disabled={starting}>{starting ? 'Starting...' : 'Start Camera'}</button>
  {/if}

  <div id="signList">
    <h2>Available Signs</h2>
    <div id="signGrid">
      {#each signs as sign (sign.id)}
        <span class="sign-tag">{sign.name}</span>
      {/each}
    </div>
    <button class="rainbow" onclick={() => navigate('/custom-hand-sign')}>Buat Gestur Kamu Sendiri</button>
  </div>
</div>

<style>
  /* gold frame + hard black drop shadow for the title and action cards */
  .pixel-card {
    border: 4px solid #ffd700; outline: none;
    box-shadow: inset 0 0 0 2px #b8860b, 8px 8px 0 #000;
  }
  #resultCard { margin-top: auto; margin-bottom: 50px; }
  h1 { font-size: 1.4rem; letter-spacing: 1px; margin: 0; }
  #container {
    position: relative; width: 100%; max-width: 640px; aspect-ratio: 4 / 3; margin: 0 auto;
    border: 4px solid #fff; outline: 4px solid #000; box-shadow: 0 0 0 4px #fff, 0 0 0 8px #000;
    image-rendering: pixelated;
  }
  video, canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    border-radius: 0; transform: scaleX(-1);
  }
  #status { margin-top: 6px; font-size: 1rem; min-height: 1.3em; color: #9f9; }
  #result { min-height: 90px; display: flex; align-items: center; justify-content: center; }
  #result img {
    max-height: 80px; max-width: 100%; border-radius: 0; background: #222;
    border: 3px solid #fff; outline: 2px solid #000; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #000; padding: 4px;
  }
  #score { font-size: 1rem; color: #000; }
  #signList { margin-top: 10px; }
  #signList h2 { font-size: 1rem; color: #333; font-weight: normal; margin: 0 0 6px; }
  #signGrid { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .sign-tag {
    padding: 3px 8px; font-size: 0.85rem; color: #eee; background: #222;
    border: 2px solid #555; border-radius: 0;
  }

  /* rainbow gradient that scrolls + a light streak sweeping across */
  .rainbow {
    position: relative; overflow: hidden; margin-top: 10px;
    color: #fff; text-shadow: 2px 2px 0 #000;
    background: linear-gradient(90deg, #ff004d, #ff8c00, #ffe600, #00e436, #29adff, #83769c, #ff77a8, #ff004d);
    background-size: 300% 100%;
    animation: rainbow-scroll 4s linear infinite;
  }
  .rainbow::after {
    content: ''; position: absolute; top: 0; bottom: 0; left: -60%; width: 40%;
    background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.85), transparent);
    transform: skewX(-20deg);
    animation: rainbow-shine 2.2s ease-in-out infinite;
    pointer-events: none;
  }
  .rainbow:hover { animation-duration: 1.5s; }
  @keyframes rainbow-scroll { to { background-position: 300% 0; } }
  @keyframes rainbow-shine {
    0% { left: -60%; }
    60%, 100% { left: 130%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rainbow, .rainbow::after { animation: none; }
  }

  @media (max-width: 480px) {
    h1 { font-size: 1.15rem; }
    #result img { max-height: 64px; }
  }

  #bgRipple {
    position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: 0;
    background: radial-gradient(
      circle at var(--rx, 50%) var(--ry, 50%),
      #fff 0%, var(--rlight, #fff) 12%, var(--rdark, #000) var(--rsize, 0%), transparent var(--rsize, 0%)
    );
  }
  #confettiLayer { position: fixed; inset: 0; pointer-events: none; z-index: 10; overflow: hidden; }
  #emojiFloatLayer { position: fixed; inset: 0; pointer-events: none; z-index: -1; overflow: hidden; }

  /* created imperatively by lib/effects, so not scoped */
  :global(.confetti-piece) { position: absolute; will-change: transform, opacity; line-height: 1; }
  :global(.emoji-float) { position: absolute; will-change: transform; width: auto; height: auto; }
</style>
