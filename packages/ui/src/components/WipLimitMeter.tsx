import type { ReactNode } from 'react'
import styles from './WipLimitMeter.module.css'

export type WipLimitState = 'ok' | 'at_limit' | 'over'

export interface WipLimitMeterProps {
  /** Nome da coluna, usado no nome acessível ("Desenvolvendo: 4 de 3, acima do limite"). */
  readonly name: string
  readonly count: number
  readonly limit: number
  readonly state: WipLimitState
  /** Dica discreta (ex.: colaborador vê só as próprias tarefas). */
  readonly title?: string | undefined
}

const STATE_TEXT: Record<WipLimitState, string> = {
  ok: 'dentro do limite',
  at_limit: 'no limite',
  over: 'acima do limite',
}

const VISIBLE_TEXT: Record<WipLimitState, string> = {
  ok: 'Dentro do limite',
  at_limit: 'No limite',
  over: 'Acima do limite',
}

function StateIcon({ state }: { readonly state: WipLimitState }): ReactNode {
  const common = {
    'aria-hidden': true,
    width: 12,
    height: 12,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (state === 'over')
    return (
      <svg {...common}>
        <path d="M8 2 15 14H1L8 2Z" />
        <path d="M8 6v4m0 1.5v1" />
      </svg>
    )
  if (state === 'at_limit')
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M5 6.5h6M5 9.5h6" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M5.2 8.2 7.2 10.2 11 6" />
    </svg>
  )
}

/** Contagem "N/limite" de uma coluna de WIP. O estado vem do servidor: o componente só mostra. */
export function WipLimitMeter({ name, count, limit, state, title }: WipLimitMeterProps) {
  return (
    <span
      className={`${styles.meter} ${styles[state]}`}
      role="img"
      aria-label={`${name}: ${count} de ${limit}, ${STATE_TEXT[state]}`}
      title={title}
    >
      <span className={styles.count}>
        {count}/{limit}
      </span>
      <span className={styles.state} aria-hidden="true">
        <StateIcon state={state} />
        {VISIBLE_TEXT[state]}
      </span>
    </span>
  )
}
