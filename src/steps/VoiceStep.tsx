import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useAudio } from '../hooks/useAudio'
import { computeVocalEmbedding } from '../lib/audio'
import { VOICE_DURATION_MS } from '../constants/config'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { ErrorState } from '../ui/ErrorState'
import { openAppSettings } from '../lib/settings'

type Props = { onComplete: (embedding: number[]) => void }

export function VoiceStep({ onComplete }: Props) {
  const { recordFor, recording, error, clearError } = useAudio()
  const [computing, setComputing] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('appStateChange', (state: { isActive: boolean }) => {
      if (state.isActive && error?.kind === 'permission-denied') {
        clearError()
      }
    })

    return () => { listener.then((l: { remove: () => void }) => l.remove()) }
  }, [error, clearError])

  if (error) {
    if (error.kind === 'permission-denied') {
      return (
        <>
          <ErrorState
            title="Accès micro requis"
            message="Autorisez le micro pour vérifier votre voix."
            onSecondaryAction={openAppSettings}
            secondaryLabel="Ouvrir les réglages"
          />
          <p style={{ fontSize: '0.7rem', color: 'red', wordBreak: 'break-all' }}>
            DEBUG : {error?.message ?? 'aucun message'} | {error?.name ?? 'aucun nom'}
          </p>
        </>
      )
    }
    if (error.kind === 'unavailable') {
      return (
        <ErrorState
          title="Aucun micro détecté"
          message="Aucun micro disponible sur cet appareil."
        />
      )
    }
    return (
      <ErrorState
        title="Micro indisponible"
        message="Une erreur est survenue. Réessayez."
      />
    )
  }

  const start = async () => {
    const samples = await recordFor(VOICE_DURATION_MS)
    setComputing(true)
    const embedding = computeVocalEmbedding(samples)
    setComputing(false)
    onComplete(embedding)
  }

  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Vérification vocale</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>
        Lisez cette phrase :<br />
        <strong style={{ color: 'var(--label)' }}>"Ma voix confirme mon identité."</strong>
      </p>
      {(recording || computing) && (
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      )}
      <Button disabled={recording || computing} onClick={start}>
        {recording ? 'Enregistrement...' : computing ? 'Traitement...' : 'Démarrer'}
      </Button>
    </div>
  )
}
