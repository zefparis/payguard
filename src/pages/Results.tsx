import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Results() {
  const nav = useNavigate()

  const [showIcon, setShowIcon] = useState(false)
  const [showText, setShowText] = useState(false)
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setShowIcon(true), 50)
    const t2 = setTimeout(() => setShowText(true), 350)
    const t3 = setTimeout(() => setShowButton(true), 600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes springIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.08); }
          70% { transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div
        style={{
          ...styles.iconCircle,
          opacity: showIcon ? 1 : 0,
          animation: showIcon ? 'springIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
          <path
            d="M12 2L4 5.5V11C4 16.25 7.4 21.15 12 22.5C16.6 21.15 20 16.25 20 11V5.5L12 2Z"
            fill="#34C759"
          />
          <path
            d="M9.5 12.5L11 14L14.5 10.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Title */}
      <h1
        style={{
          ...styles.title,
          opacity: showText ? 1 : 0,
          animation: showText ? 'fadeUp 0.4s ease-out forwards' : 'none',
        }}
      >
        Setup complete
      </h1>

      {/* Subtitle */}
      <p
        style={{
          ...styles.subtitle,
          opacity: showText ? 1 : 0,
          animation: showText ? 'fadeUp 0.4s ease-out 0.08s forwards' : 'none',
        }}
      >
        Your identity is secured.<br />
        You can now use PayGuard.
      </p>

      {/* Button */}
      <button
        onClick={() => nav('/verify')}
        style={{
          ...styles.button,
          opacity: showButton ? 1 : 0,
          animation: showButton ? 'fadeUp 0.4s ease-out forwards' : 'none',
        }}
      >
        Get started
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    background: 'var(--system-background, #000)',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: 'rgba(52, 199, 89, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--label, #fff)',
    margin: '0 0 10px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'var(--secondary-label, rgba(255,255,255,0.6))',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '0 0 40px',
  },
  button: {
    width: '100%',
    maxWidth: 360,
    height: 54,
    borderRadius: 14,
    border: 'none',
    background: '#34C759',
    color: '#fff',
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.2px',
  },
}
