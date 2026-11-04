import styles from './DailyStatusBadge.module.css'

export interface DailyStatusBadgeProps {
  /** Daily da pessoa na data: true para "Feita", false para "Pendente". */
  readonly done: boolean
}

/** Estado da daily com ícone e texto (nunca só cor). O ícone é decorativo; o texto é lido. */
export function DailyStatusBadge({ done }: DailyStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${done ? styles.done : styles.pending}`}>
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {done ? (
          <path d="M3 8.5 6.5 12 13 4.5" />
        ) : (
          <circle cx="8" cy="8" r="5" strokeDasharray="2 2" />
        )}
      </svg>
      {done ? 'Feita' : 'Pendente'}
    </span>
  )
}
