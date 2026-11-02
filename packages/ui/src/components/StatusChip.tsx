import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import styles from './StatusChip.module.css'

export interface StatusChipProps {
  readonly status: TaskStatus
  readonly compact?: boolean
  readonly className?: string
}

export function StatusChip({ status, compact = false, className }: StatusChipProps) {
  const classes = [styles.chip, styles[status], compact && styles.compact, className]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={classes}
      data-status={status}
      title={compact ? TASK_STATUS_LABELS[status] : undefined}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}
