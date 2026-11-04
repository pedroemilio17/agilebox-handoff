import type { TaskDto } from '@agilebox/contract'
import { StatusChip, SignalBadge, TaskKey } from '@agilebox/ui'
import { formatRelativeDate } from '../../shared/lib/format-date'
import { isAgingTask, isBlockedTask } from '../../shared/lib/task-signals'
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
          <span className={styles.rowSignals}>
            {task.priority === 'high' ? <SignalBadge variant="priority">Alta</SignalBadge> : null}
            {isBlockedTask(task) ? <SignalBadge variant="blocked">Bloqueada</SignalBadge> : null}
            {isAgingTask(task) ? (
              <SignalBadge variant="aging">parada {task.agingDays}d</SignalBadge>
            ) : (
              <StatusChip status={task.status} />
            )}
          </span>
        </span>
        <span className={styles.rowMeta}>
          <TaskKey value={task.key} /> · {task.projectName} ·{' '}
          {task.deadline ? (
            <time dateTime={task.deadline}>
              prazo {task.deadline.slice(8, 10)}/{task.deadline.slice(5, 7)}
            </time>
          ) : (
            formatRelativeDate(new Date(task.updatedAt), now)
          )}
        </span>
      </button>
    </li>
  )
}
