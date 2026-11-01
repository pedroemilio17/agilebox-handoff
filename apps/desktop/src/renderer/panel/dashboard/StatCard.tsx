import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import { GlassSurface } from '@agilebox/ui'
import { STATUS_COLOR_VAR } from './status-colors'
import styles from './Dashboard.module.css'

export interface StatCardProps {
  readonly status: TaskStatus
  readonly percentage: number
}

export function StatCard({ status, percentage }: StatCardProps) {
  return (
    <GlassSurface variant="group" className={styles.statCard} data-status={status}>
      <span className={styles.statLabel}>
        <span
          className={styles.dot}
          aria-hidden="true"
          style={{ background: STATUS_COLOR_VAR[status] }}
        />
        {TASK_STATUS_LABELS[status]}
      </span>
      <strong className={styles.statValue}>{percentage}%</strong>
    </GlassSurface>
  )
}
