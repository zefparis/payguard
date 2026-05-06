export function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${Math.max(2, size / 12)}px solid var(--separator)`,
        borderTopColor: 'var(--green)',
        animation: 'spinner 0.9s linear infinite',
      }}
    />
  )
}
