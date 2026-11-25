import type { TaskDto } from '@agilebox/contract'
import { TASK_STATUS_LABELS } from '@agilebox/core'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { isBlockedTask } from '../../shared/lib/task-signals'
import { blockedMarkerLabel } from '../../panel/impediments/impediment-copy'
import { sprintMarker } from '../../panel/sprints/sprint-rules'
import { trayCopy } from '../copy'
import { StatusDot } from '../StatusDot'
import styles from '../Tray.module.css'

export interface TaskRowProps {
  readonly task: TaskDto
  readonly onOpen: (taskId: string) => void
  /** Sem uso: o cartão do protótipo não mostra data relativa nem destaque. Mantido por compatibilidade. */
  readonly now?: Date
  readonly highlighted?: boolean
}

/** Cartão da lista "Em foco" (.tray-task-card): o cartão inteiro é o botão. */
export function TaskRow({ task, onOpen }: TaskRowProps) {
  const capabilities = useCapabilities()
  const blocked = isBlockedTask(task) && capabilities.can('impediments:passive')
  // Sprint atual (M4.2): marcador passivo na meta, só com o módulo ligado.
  const sprintText = capabilities.can('sprints:passive') ? sprintMarker(task) : null
  return (
    <li>
      <button type="button" className={styles.taskCard} onClick={() => onOpen(task.id)}>
        <span className={styles.taskTop}>
          <span className={styles.taskMeta}>
            <StatusDot status={task.status} />
            <span>
              <strong>{task.key}</strong> · {task.projectName}
              {sprintText ? <> · {sprintText}</> : null}
            </span>
          </span>
          {blocked ? (
            <span
              className={styles.blockedInline}
              title={blockedMarkerLabel(task.blockedReason, task.impediment?.ownerName ?? null)}
            >
              <span className={`${styles.dotInline} ${styles.dotDanger}`} aria-hidden="true" />
              {trayCopy.blocked}
            </span>
          ) : (
            <span className={styles.taskStatus}>{TASK_STATUS_LABELS[task.status]}</span>
          )}
        </span>
        <span className={styles.taskTitle}>{task.title}</span>
      </button>
    </li>
  )
}
