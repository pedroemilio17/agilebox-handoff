import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../hooks/use-reduced-motion'
import styles from './GlassToast.module.css'
import { Kbd } from './Indicators'

const DEFAULT_DURATION = 8000
const TICK_MS = 100
/** Com movimento reduzido, a barra anda em degraus de 1 s em vez de deslizar. */
const REDUCED_TICK_MS = 1000

export interface GlassToastProps {
  /** Texto do aviso. Pode ter trechos marcados, por exemplo um ID em fonte mono. */
  readonly message: ReactNode
  /** Rótulo do botão de ação, por exemplo "Desfazer". Sem ele, não há botão. */
  readonly actionLabel?: string
  /** Atalho mostrado ao lado do botão, só informativo. */
  readonly actionShortcut?: string
  readonly onAction?: () => void
  /** Chamado ao expirar, ao usar a ação ou ao clicar nela. Quem monta o toast o desmonta aqui. */
  readonly onDismiss: () => void
  /** Tempo em milissegundos. O padrão é 8 s, como no handoff. */
  readonly duration?: number
}

/**
 * Aviso flutuante em vidro, no canto inferior esquerdo, com `role="status"`.
 * Some sozinho após `duration` e a barra mostra o tempo restante.
 * O cronômetro pausa enquanto o foco estiver dentro do aviso.
 */
export function GlassToast({
  message,
  actionLabel,
  actionShortcut,
  onAction,
  onDismiss,
  duration = DEFAULT_DURATION,
}: GlassToastProps) {
  const reducedMotion = useReducedMotion()
  const tick = reducedMotion ? REDUCED_TICK_MS : TICK_MS
  const [remaining, setRemaining] = useState(duration)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const interval = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - tick))
    }, tick)
    return () => window.clearInterval(interval)
  }, [paused, tick])

  useEffect(() => {
    if (remaining <= 0) onDismiss()
  }, [remaining, onDismiss])

  return (
    <div
      className={`${styles.toast} motion-toast-enter`}
      role="status"
      aria-live="polite"
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      <div className={styles.row}>
        <span className={styles.message}>{message}</span>
        {actionLabel ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              onAction?.()
              onDismiss()
            }}
          >
            {actionLabel}
            {actionShortcut ? <Kbd aria-hidden="true">{actionShortcut}</Kbd> : null}
          </button>
        ) : null}
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.bar} style={{ transform: `scaleX(${remaining / duration})` }} />
      </div>
    </div>
  )
}
