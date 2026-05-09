import { useRef, useCallback, useEffect, useState } from 'react'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let active = true
    async function start() {
      try {
        setIsInitializing(true)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 }
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            if (active) {
              setReady(true)
              setIsInitializing(false)
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera access denied. Please allow camera in browser settings.')
        setIsInitializing(false)
      }
    }
    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const capture = useCallback((): string | null => {
    const video = videoRef.current
    if (!video || !ready) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.75)
  }, [ready])

  return { videoRef, ready, error, capture, isInitializing }
}
