import type { ReactNode } from 'react'
import styles from './MeetingMarks.module.css'

export type MeetingKind = 'meeting' | 'review' | 'retro'

export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  meeting: 'Reunião',
  review: 'Revisão',
  retro: 'Retro',
}

function KindIcon({ kind }: { readonly kind: MeetingKind }): ReactNode {
  const common = {
    'aria-hidden': true,
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (kind === 'review')
    return (
      <svg {...common}>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  if (kind === 'retro')
    return (
      <svg {...common}>
        <path d="M4 12a8 8 0 0 1 14-5l2 2" />
        <path d="M20 4v5h-5" />
        <path d="M20 12a8 8 0 0 1-14 5l-2-2" />
        <path d="M4 20v-5h5" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6" />
    </svg>
  )
}

export interface KindBadgeProps {
  readonly kind: MeetingKind
  readonly className?: string | undefined
}

/** Rótulo do tipo de agendamento: cor, ícone e texto (nunca só a cor). */
export function KindBadge({ kind, className }: KindBadgeProps) {
  return (
    <span
      className={[styles.badge, styles[kind], className].filter(Boolean).join(' ')}
      data-kind={kind}
    >
      <KindIcon kind={kind} />
      {MEETING_KIND_LABELS[kind]}
    </span>
  )
}

export interface RepeatMarkProps {
  /** Nome acessível. Padrão: "Repete toda semana". */
  readonly label?: string
}

/** Marca de série semanal (↻). */
export function RepeatMark({ label = 'Repete toda semana' }: RepeatMarkProps) {
  return (
    <span className={styles.repeat} role="img" aria-label={label} title={label}>
      ↻
    </span>
  )
}
