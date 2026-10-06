// Starts the webcam into `video` and sizes `canvas` (the landmark overlay) to match.
export async function startCamera(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true })
  await new Promise((r) => (video.onloadedmetadata = r))
  await video.play()
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
}

export function stopCamera(video: HTMLVideoElement | undefined) {
  ;(video?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
}
