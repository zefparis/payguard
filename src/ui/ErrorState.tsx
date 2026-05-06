import { Button } from './Button'

type Props = {
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({ title, message, onRetry, retryLabel = 'Retry' }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <h2 style={{ marginBottom: 12 }}>{title}</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>{message}</p>
      {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
    </div>
  )
}
