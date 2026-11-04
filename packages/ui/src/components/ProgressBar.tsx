import styles from './ProgressBar.module.css'

export interface ProgressBarProps {
  readonly done: number
  readonly total: number
  /** Com rótulo, a barra vira `progressbar` acessível; sem rótulo, é decorativa (aria-hidden). */
  readonly label?: string | undefined
  readonly className?: string | undefined
}

export function ProgressBar({ done, total, label, className }: ProgressBarProps) {
  const safeTotal = Math.max(0, Math.trunc(total))
  const safeDone = Math.min(Math.max(0, Math.trunc(done)), safeTotal)
  const percent = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100)
  const classes = [styles.track, className].filter(Boolean).join(' ')

  if (label === undefined) {
    return (
      <span className={classes} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
    )
  }

  return (
    <span
      className={classes}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeDone}
      aria-valuetext={`${safeDone} de ${safeTotal}`}
    >
      <span className={styles.fill} style={{ width: `${percent}%` }} />
    </span>
  )
}
