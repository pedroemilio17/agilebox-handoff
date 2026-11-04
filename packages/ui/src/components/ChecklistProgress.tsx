import { ProgressBar } from './ProgressBar'
import styles from './ChecklistProgress.module.css'

export interface ChecklistProgressProps {
  readonly done: number
  readonly total: number
}

/** Indicador compacto "2/5" com barra fina. Sem subtarefas, não aparece. */
export function ChecklistProgress({ done, total }: ChecklistProgressProps) {
  if (total <= 0) return null
  return (
    <span className={styles.wrap}>
      <span className={styles.count}>
        {done}/{total}
      </span>
      <ProgressBar className={styles.bar} done={done} total={total} />
    </span>
  )
}
