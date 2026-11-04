import styles from './StepIndicator.module.css'

export interface StepIndicatorProps {
  readonly current: number
  readonly total: number
  readonly className?: string | undefined
}

/** Indicador de passos: o texto "Passo X de Y" é lido por leitor de tela; as barras são decorativas. */
export function StepIndicator({ current, total, className }: StepIndicatorProps) {
  const safeTotal = Math.max(1, Math.trunc(total))
  const safeCurrent = Math.min(Math.max(1, Math.trunc(current)), safeTotal)
  const classes = [styles.root, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <span className={styles.text}>{`Passo ${safeCurrent} de ${safeTotal}`}</span>
      <span className={styles.bars} aria-hidden="true">
        {Array.from({ length: safeTotal }, (_, index) => (
          <span key={index} className={index < safeCurrent ? styles.filled : styles.bar} />
        ))}
      </span>
    </div>
  )
}
