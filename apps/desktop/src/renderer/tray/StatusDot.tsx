import type { TaskStatus } from '@agilebox/core'
import styles from './Tray.module.css'

const DOT_CLASS: Record<TaskStatus, string | undefined> = {
  planning: styles.dotPlanning,
  todo: styles.dotTodo,
  in_progress: styles.dotInProgress,
  review: styles.dotReview,
  done: styles.dotDone,
}

export interface StatusDotProps {
  readonly status: TaskStatus
  readonly large?: boolean
}

/** Ponto de estado (.status-dot): 6px na bandeja, 8px no seletor de estado. */
export function StatusDot({ status, large = false }: StatusDotProps) {
  return (
    <span
      className={`${styles.statusDot} ${large ? styles.statusDotLarge : ''} ${DOT_CLASS[status]}`}
      data-status={status}
      aria-hidden="true"
    />
  )
}
