import { useEffect, useRef, useState } from 'react'
import { startCameraStream, stopStream, captureSelfie } from '../lib/camera'

export type CameraError =
  | { kind: 'permission-denied' }
  | { kind: 'unavailable' }
  | { kind: 'other'; message: string }

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<CameraError | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await startCameraStream('user')
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch (err) {
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
            setError({ kind: 'permission-denied' })
          } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
            setError({ kind: 'unavailable' })
          } else {
            setError({ kind: 'other', message: err.message })
          }
        } else {
          setError({ kind: 'other', message: err instanceof Error ? err.message : 'Camera unavailable' })
        }
      }
    })()
    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  const capture = async (): Promise<string | null> => {
    if (!videoRef.current || !ready) return null
    return captureSelfie(videoRef.current)
  }

  return { videoRef, ready, error, capture }
}
