import { useState } from 'react'
import { useAudio } from '../hooks/useAudio'
import { computeVocalEmbedding } from '../lib/audio'
import { VOICE_DURATION_MS } from '../constants/config'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { ErrorState } from '../ui/ErrorState'
import { openAppSettings } from '../lib/settings'

type Props = { onComplete: (embedding: number[]) => void }

export function VoiceStep({ onComplete }: Props) {
  const { recordFor, recording, error } = useAudio()
  const [computing, setComputing] = useState(false)

  if (error) {
    return <ErrorState
      title="Microphone unavailable"
      message="PayGuard needs microphone access to verify your voice. Please enable it in Settings."
      onSecondaryAction={openAppSettings}
      secondaryLabel="Open Settings"
    />
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
      <h2 style={{ marginBottom: 16 }}>Voice check</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>
        Read this sentence aloud:<br />
        <strong style={{ color: 'var(--label)' }}>"My voice is my passport, verify me."</strong>
      </p>
      {(recording || computing) && (
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      )}
      <Button disabled={recording || computing} onClick={start}>
        {recording ? 'Recording...' : computing ? 'Processing...' : 'Start'}
      </Button>
    </div>
  )
}
