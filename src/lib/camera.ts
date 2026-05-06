export async function captureSelfie(videoEl: HTMLVideoElement): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.videoWidth || 640
  canvas.height = videoEl.videoHeight || 480
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '')
}

export async function startCameraStream(facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}
