<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { GestureRecognizer, GestureRecognizerResult } from '@mediapipe/tasks-vision'
  import {
    CUSTOM_SIGN_FEATURE_VERSION,
    CUSTOM_SIGN_MAX_SAMPLES,
    CUSTOM_SIGN_MIN_SAMPLES,
    CUSTOM_SIGN_NAME_MAX,
    STICKER_MAX_BYTES,
    STICKER_TYPES,
    type CreateSignRequest,
    type Handedness,
    type Sign,
    type UserSignSummary,
  } from '@hand-sign/shared'
  import { api } from '../lib/api'
  import { auth } from '../lib/auth.svelte'
  import { startCamera, stopCamera } from '../lib/camera'
  import { navigate } from '../lib/router.svelte'
  import {
    CustomSignMatcher,
    distance,
    handVector,
    landmarksToFloat32,
    type CustomSignData,
  } from '../lib/recognition/customMatcher'
  import { detectSign, drawHands, getRecognizer } from '../lib/recognition/recognizer'
  import { DEFAULT_SIGNS, colorsFrom, float32ToBase64, loadMyCustomSigns } from '../lib/signs'
  import UsernameDialog from '../components/UsernameDialog.svelte'

  const COUNTDOWN_S = 3
  const ROUND_MS = 2000
  const CAPTURE_INTERVAL_MS = 100
  // skip frames nearly identical to the last kept one
  const MIN_FRAME_DISTANCE = 0.05
  // warn when this share of recorded frames already matched another sign
  const CONFLICT_SHARE = 0.3
  const PROMPTS = ['Tahan gestur di depan kamera', 'Sedikit lebih dekat atau lebih jauh', 'Miringkan tangan sedikit']
  const DRAFT_ID = 'draft'

  interface Sample {
    landmarks: Float32Array
    handedness: Handedness
    vec: Float32Array
  }

  let name = $state('')
  let confetti = $state('✨')
  let color = $state('#7ec8ff')
  let stickerFile = $state<File | null>(null)
  let stickerPreview = $state('')
  let stickerError = $state('')

  let video: HTMLVideoElement
  let canvas: HTMLCanvasElement
  let status = $state('Memuat model...')
  let cameraOn = $state(false)
  let startingCamera = $state(false)
  let phase = $state<'idle' | 'countdown' | 'recording'>('idle')
  let countdown = $state(0)
  let round = $state(0)
  let samples = $state.raw<Sample[]>([])
  // existing sign name → recorded frames it matched
  let conflicts = $state.raw<Map<string, number>>(new Map())
  let testResult = $state('')
  let saving = $state(false)
  let error = $state('')

  let existing = $state.raw<CustomSignData[]>([])
  let existingMatcher: CustomSignMatcher | null = null
  // existing signs + this draft, so the test shows what Home would detect
  let testMatcher = $state.raw<CustomSignMatcher | null>(null)
  let rafId: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let recordUntil = 0
  let lastCaptureAt = 0

  const existingSigns = $derived<Sign[]>([...existing.map((d) => d.sign), ...DEFAULT_SIGNS])
  const enough = $derived(samples.length >= CUSTOM_SIGN_MIN_SAMPLES)
  const full = $derived(samples.length >= CUSTOM_SIGN_MAX_SAMPLES)
  const warnings = $derived(
    [...conflicts].filter(([, n]) => n / Math.max(samples.length, 1) >= CONFLICT_SHARE).map(([signName]) => signName),
  )
  const canSave = $derived(
    !!name.trim() && !!confetti.trim() && !!stickerFile && enough && phase === 'idle' && !saving,
  )

  onMount(() => {
    getRecognizer().then(
      () => (status = 'Model siap.'),
      (err) => (status = 'Error: ' + err.message),
    )
    loadMyCustomSigns().then(
      (custom) => {
        existing = custom.data
        existingMatcher = custom.matcher
      },
      (err) => console.error('Failed to load custom signs:', err),
    )
  })

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId)
    if (timer) clearTimeout(timer)
    stopCamera(video)
    if (stickerPreview) URL.revokeObjectURL(stickerPreview)
  })

  function onStickerChange(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null
    stickerError = ''
    if (stickerPreview) URL.revokeObjectURL(stickerPreview)
    stickerPreview = ''
    stickerFile = null
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

  async function turnOnCamera() {
    startingCamera = true
    try {
      const recognizer = await getRecognizer()
      await startCamera(video, canvas)
      cameraOn = true
      status = ''
      loop(recognizer)
    } catch (err) {
      status = 'Error: ' + (err as Error).message
    } finally {
      startingCamera = false
    }
  }

  function loop(recognizer: GestureRecognizer) {
    try {
      const now = performance.now()
      const results = recognizer.recognizeForVideo(video, now)
      drawHands(canvas.getContext('2d')!, results)
      if (phase === 'recording') {
        if (now >= recordUntil || full) finishRound()
        else if (now - lastCaptureAt >= CAPTURE_INTERVAL_MS) {
          lastCaptureAt = now
          capture(results)
        }
      } else if (phase === 'idle' && testMatcher) {
        testResult = describeTest(results)
      }
    } catch (err) {
      console.error('loop error:', err)
    } finally {
      rafId = requestAnimationFrame(() => loop(recognizer))
    }
  }

  // Keeps a frame only if it shows exactly one fully visible hand that differs from the last kept frame.
  function capture(results: GestureRecognizerResult) {
    if (results.landmarks.length !== 1) return
    const hand = results.landmarks[0]
    if (hand.some((lm) => lm.x < 0 || lm.x > 1 || lm.y < 0 || lm.y > 1)) return
    const vec = handVector(hand)
    const last = samples.at(-1)
    if (last && distance(vec, last.vec) < MIN_FRAME_DISTANCE) return

    const handedness = results.handedness[0]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right'
    samples = [...samples, { landmarks: landmarksToFloat32(hand), handedness, vec }]

    const clash = detectSign(results, existingSigns, existingMatcher)
    if (clash.kind === 'match') {
      conflicts = new Map(conflicts).set(clash.sign.name, (conflicts.get(clash.sign.name) ?? 0) + 1)
    }
  }

  function startRound() {
    phase = 'countdown'
    countdown = COUNTDOWN_S
    const tick = () => {
      if (countdown > 1) {
        countdown--
        timer = setTimeout(tick, 1000)
      } else {
        phase = 'recording'
        recordUntil = performance.now() + ROUND_MS
      }
    }
    timer = setTimeout(tick, 1000)
  }

  function finishRound() {
    phase = 'idle'
    round++
    const draft: CustomSignData = {
      sign: draftSign(),
      samples: samples.map((s) => s.landmarks),
    }
    testMatcher = new CustomSignMatcher([...existing, draft])
  }

  function draftSign(): Sign {
    return {
      id: DRAFT_ID,
      name: name.trim() || 'Gestur baru',
      source: 'custom',
      sticker: stickerPreview,
      emoji: stickerPreview,
      confetti,
      colors: colorsFrom(color),
    }
  }

  function describeTest(results: GestureRecognizerResult): string {
    const d = detectSign(results, existingSigns, testMatcher)
    if (d.kind === 'no-hand') return 'Tangan tidak terdeteksi'
    if (d.kind === 'no-match') return 'Tidak cocok'
    if (d.sign.id === DRAFT_ID) return `✓ Terdeteksi: ${name.trim() || 'gestur ini'}`
    return `Terdeteksi sebagai "${d.sign.name}"`
  }

  function resetSamples() {
    samples = []
    conflicts = new Map()
    round = 0
    testMatcher = null
    testResult = ''
  }

  async function save() {
    if (!canSave || !stickerFile) return
    saving = true
    error = ''
    try {
      const body: CreateSignRequest = {
        name: name.trim(),
        handCount: 1,
        confetti: confetti.trim(),
        colors: colorsFrom(color),
        featureVersion: CUSTOM_SIGN_FEATURE_VERSION,
        samples: samples.map((s) => ({ landmarks: float32ToBase64(s.landmarks), handedness: s.handedness })),
      }
      const form = new FormData()
      form.append('data', JSON.stringify(body))
      form.append('sticker', stickerFile)
      await api<UserSignSummary>('/signs', { method: 'POST', body: form })
      navigate('/custom-hand-sign')
    } catch (err) {
      error = (err as Error).message
    } finally {
      saving = false
    }
  }
</script>

{#if !auth.user?.username}
  <UsernameDialog />
{/if}

<div class="page">
  <div class="pixel-card">
    <h1>Buat Gestur Baru</h1>
  </div>

  <div class="pixel-card form">
    <label class="field">
      <span>Nama gestur</span>
      <input bind:value={name} maxlength={CUSTOM_SIGN_NAME_MAX} placeholder="mis. Salam Metal" />
    </label>

    <fieldset class="field">
      <legend>Jumlah tangan</legend>
      <div class="hands">
        <label class="choice"><input type="radio" name="hands" checked /> 1 Tangan</label>
        <label class="choice disabled">
          <input type="radio" name="hands" disabled /> 2 Tangan <span class="soon">Segera hadir</span>
        </label>
      </div>
      <p class="hint">Bisa dipakai dengan tangan kiri atau kanan.</p>
    </fieldset>

    <label class="field">
      <span>Sticker</span>
      <input type="file" accept={STICKER_TYPES.join(',')} onchange={onStickerChange} />
      {#if stickerPreview}<img class="preview" src={stickerPreview} alt="Preview sticker" />{/if}
      {#if stickerError}<p class="error">{stickerError}</p>{/if}
    </label>

    <div class="row">
      <label class="field">
        <span>Confetti</span>
        <input bind:value={confetti} maxlength="16" class="confetti" />
      </label>
      <label class="field">
        <span>Warna</span>
        <input type="color" bind:value={color} />
      </label>
    </div>
  </div>

  <div class="pixel-card">
    <h2>Rekam Gestur</h2>
    <p class="hint">
      {phase === 'idle' ? PROMPTS[round % PROMPTS.length] : phase === 'recording' ? 'Merekam... tahan!' : 'Siap-siap...'}
    </p>
    <div class="camera">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} autoplay playsinline></video>
      <canvas bind:this={canvas}></canvas>
      {#if phase === 'countdown'}<div class="overlay">{countdown}</div>{/if}
      {#if phase === 'recording'}<div class="rec">● REC</div>{/if}
    </div>
    {#if status}<p class="status">{status}</p>{/if}

    <div class="progress" aria-label="Sampel terekam">
      <div class="bar" style:width="{Math.min(100, (samples.length / CUSTOM_SIGN_MIN_SAMPLES) * 100)}%"></div>
    </div>
    <p class="hint">{samples.length} sampel (min {CUSTOM_SIGN_MIN_SAMPLES})</p>

    {#if !cameraOn}
      <button onclick={turnOnCamera} disabled={startingCamera}>
        {startingCamera ? 'Menyalakan...' : 'Nyalakan Kamera'}
      </button>
    {:else}
      <div class="actions">
        <button onclick={startRound} disabled={phase !== 'idle' || full}>
          {round === 0 ? 'Mulai Rekam' : 'Rekam Lagi'}
        </button>
        {#if samples.length}
          <button onclick={resetSamples} disabled={phase !== 'idle'}>Ulangi</button>
        {/if}
      </div>
    {/if}

    {#if testMatcher && phase === 'idle'}
      <p class="test">Tes: {testResult}</p>
    {/if}
    {#each warnings as signName (signName)}
      <p class="warn">Mirip dengan gestur "{signName}" — bisa tertukar saat dideteksi.</p>
    {/each}
  </div>

  {#if error}<p class="error save-error">{error}</p>{/if}
  <div class="actions bottom">
    <button onclick={() => navigate('/custom-hand-sign')}>Batal</button>
    <button class="primary" onclick={save} disabled={!canSave}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
  </div>
</div>

<style>
  /* body doesn't scroll (camera page), so this page scrolls itself */
  .page { flex: 1; overflow-y: auto; padding: 8px 8px 24px; }
  h1 { font-size: 1.4rem; letter-spacing: 1px; margin: 0; }
  h2 { font-size: 1.1rem; margin: 0 0 4px; }

  .form { display: flex; flex-direction: column; gap: 12px; text-align: left; }
  .field { display: flex; flex-direction: column; gap: 4px; border: 0; padding: 0; margin: 0; min-width: 0; }
  .field > span, legend { font-size: 0.95rem; padding: 0; }
  input:not([type='radio']):not([type='color']) {
    font: inherit; font-size: 1rem; padding: 6px 8px; border: 3px solid #000; background: #fff; min-width: 0;
  }
  input[type='color'] { width: 64px; height: 38px; padding: 0; border: 3px solid #000; background: #fff; }
  .confetti { width: 100px; }
  .row { display: flex; gap: 16px; }
  .hands { display: flex; flex-wrap: wrap; gap: 8px 16px; }
  .choice { display: flex; align-items: center; gap: 6px; }
  .disabled { color: #999; cursor: not-allowed; }
  .soon { font-size: 0.75rem; padding: 1px 6px; background: #ffe600; color: #000; border: 2px solid #000; }
  .preview {
    align-self: flex-start; max-height: 80px; max-width: 160px; margin-top: 4px;
    background: #222; border: 3px solid #000; padding: 4px; image-rendering: pixelated;
  }

  .hint { margin: 4px 0; font-size: 0.9rem; color: #555; }
  .camera {
    position: relative; width: 100%; aspect-ratio: 4 / 3; margin: 6px auto;
    background: #222; border: 3px solid #000;
  }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
  .overlay {
    position: absolute; inset: 0; display: grid; place-items: center;
    font-size: 5rem; color: #fff; text-shadow: 4px 4px 0 #000; background: rgba(0, 0, 0, 0.3);
  }
  .rec { position: absolute; top: 8px; left: 8px; color: #ff004d; text-shadow: 2px 2px 0 #000; }
  .status { margin: 4px 0; color: #070; }
  .progress { height: 12px; border: 3px solid #000; background: #eee; }
  .bar { height: 100%; background: #00e436; transition: width 0.2s; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .actions button { flex: 1; max-width: 220px; }
  .bottom { max-width: 640px; margin: 0 auto; }
  .primary { background: #00e436; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .test { margin: 8px 0 0; font-size: 1.05rem; }
  .warn { margin: 6px 0 0; padding: 4px 8px; background: #ffe600; border: 2px solid #000; font-size: 0.9rem; }
  .error { color: #c00; margin: 4px 0; }
  .save-error { color: #f66; }

  @media (max-width: 480px) {
    .actions { flex-direction: column; }
    .actions button { max-width: none; }
  }
</style>
