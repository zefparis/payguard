import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export function Button({ variant = 'primary', children, style, ...rest }: Props) {
  const base = {
    width: '100%',
    height: 54,
    borderRadius: 14,
    fontSize: 17,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  } as const
  const styles = variant === 'primary'
    ? { ...base, background: 'var(--green)', color: '#fff' }
    : { ...base, background: 'transparent', color: 'var(--label)', border: '1px solid var(--separator)' }
  return <button style={{ ...styles, ...style }} {...rest}>{children}</button>
}
