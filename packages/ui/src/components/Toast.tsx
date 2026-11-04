import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

export interface ToastProps {
  readonly message: string
  readonly duration?: number
  /** Aviso de atenção (ex.: limite de WIP ultrapassado): ícone de alerta em vez de confirmação. */
  readonly tone?: 'default' | 'warning'
}

export function Toast({ message, duration = 2600, tone = 'default' }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const timeout = window.setTimeout(() => setVisible(false), duration)
    return () => window.clearTimeout(timeout)
  }, [duration, message])

  if (!visible) return null

  return (
    <div className={`${styles.toast} motion-toast-enter`} role="status" aria-live="polite">
      <span className={tone === 'warning' ? styles.warning : styles.check} aria-hidden="true">
        {tone === 'warning' ? '!' : '✓'}
      </span>
      <span>{message}</span>
    </div>
  )
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  return {
    message,
    showToast: (nextMessage: string) => setMessage(nextMessage),
    dismissToast: () => setMessage(null),
  } as const
}
