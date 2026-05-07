import { Button } from './Button'

type Props = {
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  onSecondaryAction?: () => void
  secondaryLabel?: string
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
  onSecondaryAction,
  secondaryLabel,
}: Props) {
  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <h2 style={{ marginBottom: 12 }}>{title}</h2>
      <p style={{ color: 'var(--secondary-label)', marginBottom: 24 }}>{message}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
        {onSecondaryAction && secondaryLabel && (
          <Button variant="secondary" onClick={onSecondaryAction}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
