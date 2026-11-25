import styles from './TaskDetailView.module.css'

export interface ProgressTrackProps {
  readonly done: number
  readonly total: number
  /** Rótulo acessível da barra (vira `progressbar`). */
  readonly label: string
}

/** Barra fina de 3px do protótipo (.progress-track). */
export function ProgressTrack({ done, total, label }: ProgressTrackProps) {
  const safeTotal = Math.max(0, Math.trunc(total))
  const safeDone = Math.min(Math.max(0, Math.trunc(done)), safeTotal)
  const percent = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100)
  return (
    <div
      className={styles.progressTrack}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeDone}
      aria-valuetext={`${safeDone} de ${safeTotal}`}
    >
      <div className={styles.progressFill} style={{ width: `${percent}%` }} />
    </div>
  )
}
