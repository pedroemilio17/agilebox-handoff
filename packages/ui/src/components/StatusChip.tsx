import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import styles from './StatusChip.module.css'

export interface StatusChipProps {
  readonly status: TaskStatus
  readonly className?: string
}

export function StatusChip({ status, className }: StatusChipProps) {
  const classes = [styles.chip, styles[status], className].filter(Boolean).join(' ')

  return (
    <span className={classes} data-status={status}>
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}
