import { TASK_STATUSES, TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskStatusDistribution } from './types'
import { STATUS_COLOR_VAR } from './status-colors'
import styles from './Dashboard.module.css'

export interface StackedBarProps {
  readonly distribution: TaskStatusDistribution
  readonly label: string
  readonly compact?: boolean
}

// Cada trecho diz o estado e a porcentagem em texto acessível: a cor nunca é a única informação.
export function StackedBar({ distribution, label, compact = false }: StackedBarProps) {
  const summary = TASK_STATUSES.map(
    (status) => `${TASK_STATUS_LABELS[status]} ${distribution[status]}%`,
  ).join(', ')

  return (
    <div
      className={`${styles.bar} ${compact ? styles.barCompact : ''}`}
      role="img"
      aria-label={`${label}: ${summary}`}
    >
      {TASK_STATUSES.filter((status) => distribution[status] > 0).map((status) => (
        <span
          key={status}
          className={styles.segment}
          data-status={status}
          style={{ width: `${distribution[status]}%`, background: STATUS_COLOR_VAR[status] }}
        />
      ))}
    </div>
  )
}
