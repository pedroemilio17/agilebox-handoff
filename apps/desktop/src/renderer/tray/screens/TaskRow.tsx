import type { TaskDto } from '@agilebox/contract'
import { ChecklistProgress, CommentCount, StatusChip, SignalBadge, TaskKey } from '@agilebox/ui'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { formatRelativeDate } from '../../shared/lib/format-date'
import { isAgingTask, isBlockedTask } from '../../shared/lib/task-signals'
import { sprintMarker } from '../../panel/sprints/sprint-rules'
import { blockedMarkerLabel } from '../../panel/impediments/impediment-copy'
import styles from '../Tray.module.css'

export interface TaskRowProps {
  readonly task: TaskDto
  readonly now: Date
  readonly highlighted: boolean
  readonly onOpen: (taskId: string) => void
}

export function TaskRow({ task, now, highlighted, onOpen }: TaskRowProps) {
  const capabilities = useCapabilities()
  const showChecklist = capabilities.can('subtasks:passive')
  const blocked = isBlockedTask(task) && capabilities.can('impediments:passive')
  // Sprint atual (M4.2): marcador passivo na linha, em qualquer nível com o módulo ligado.
  const sprintText = capabilities.can('sprints:passive') ? sprintMarker(task) : null
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
            {showChecklist ? (
              <ChecklistProgress
                done={task.checklistProgress.done}
                total={task.checklistProgress.total}
              />
            ) : null}
            <CommentCount count={task.commentCount} />
            {blocked ? (
              <span
                title={blockedMarkerLabel(task.blockedReason, task.impediment?.ownerName ?? null)}
              >
                <SignalBadge variant="blocked">Bloqueada</SignalBadge>
              </span>
            ) : null}
            {isAgingTask(task) ? (
              <SignalBadge variant="aging">parada {task.agingDays}d</SignalBadge>
            ) : (
              <StatusChip status={task.status} />
            )}
          </span>
        </span>
        <span className={styles.rowMeta}>
          <TaskKey value={task.key} /> · {task.projectName}
          {sprintText ? <> · {sprintText}</> : null} ·{' '}
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
