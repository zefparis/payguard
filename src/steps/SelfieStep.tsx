import { useCamera } from '../hooks/useCamera'
import { Button } from '../ui/Button'
import { ErrorState } from '../ui/ErrorState'
import { openAppSettings } from '../lib/settings'

type Props = { onComplete: (selfieB64: string) => void }

export function SelfieStep({ onComplete }: Props) {
  const { videoRef, ready, error, capture } = useCamera()

  if (error) {
    if (error.kind === 'permission-denied') {
      return (
        <ErrorState
          title="Camera access required"
          message="PayGuard needs camera access to verify your identity. Please enable it in Settings."
          onSecondaryAction={openAppSettings}
          secondaryLabel="Open Settings"
        />
      )
    }
    if (error.kind === 'unavailable') {
      return (
        <ErrorState
          title="No camera detected"
          message="Your device does not have a working camera available."
        />
      )
    }
    return (
      <ErrorState
        title="Camera unavailable"
        message="An unexpected error occurred. Please try again."
      />
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Take a selfie</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>
        Center your face in the frame.
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 320, borderRadius: 16, marginBottom: 24, background: '#000' }}
      />
      <Button
        disabled={!ready}
        onClick={async () => {
          const b64 = await capture()
          if (b64) onComplete(b64)
        }}
      >
        Capture
      </Button>
    </div>
  )
}
