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
          title="Accès caméra requis"
          message="Autorisez la caméra pour vérifier votre identité."
          onSecondaryAction={openAppSettings}
          secondaryLabel="Ouvrir les réglages"
        />
      )
    }
    if (error.kind === 'unavailable') {
      return (
        <ErrorState
          title="Aucune caméra détectée"
          message="Aucune caméra disponible sur cet appareil."
        />
      )
    }
    return (
      <ErrorState
        title="Caméra indisponible"
        message="Une erreur est survenue. Réessayez."
      />
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Prenez un selfie</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>
        Placez votre visage au centre.
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
        Capturer
      </Button>
    </div>
  )
}
