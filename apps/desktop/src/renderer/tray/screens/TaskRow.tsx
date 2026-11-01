import type { TaskDto } from '@agilebox/contract'
import { StatusChip } from '@agilebox/ui'
import { formatRelativeDate } from '../../shared/lib/format-date'
import styles from '../Tray.module.css'

export interface TaskRowProps {
  readonly task: TaskDto
  readonly now: Date
  readonly highlighted: boolean
  readonly onOpen: (taskId: string) => void
}

export function TaskRow({ task, now, highlighted, onOpen }: TaskRowProps) {
  return (
    <li>
      <button
        type="button"
        className={`${styles.row} ${highlighted ? styles.rowHighlight : ''}`}
        data-highlighted={highlighted}
        onClick={() => onOpen(task.id)}
      >
        <span className={styles.rowTop}>
          <span className={styles.rowTitle}>{task.title}</span>
          <StatusChip status={task.status} />
        </span>
        <span className={styles.rowMeta}>
          {task.projectName} · {formatRelativeDate(new Date(task.updatedAt), now)}
        </span>
      </button>
    </li>
  )
}
