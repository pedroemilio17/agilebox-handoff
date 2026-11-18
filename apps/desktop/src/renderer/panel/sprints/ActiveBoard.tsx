import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { TaskKey } from '@agilebox/ui'
import { hoursText, estimateText } from './SprintItems'
import { sprintCopy } from './sprint-copy'
import { groupByStatus, sumHours } from './sprint-rules'
import styles from './SprintsView.module.css'

/** Colunas que o quadro da sprint mostra sempre (design). "Planejamento" só aparece com itens. */
const BOARD_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

/** Horas do cartão: restantes em andamento, estimativa nas outras, e o estado em revisão. */
export function cardHoursText(task: TaskDto): string {
  if (task.status === 'review') return sprintCopy.cardInReview
  if (task.estimatedHours == null) return sprintCopy.noEstimate
  if (task.status === 'in_progress') {
    const left = Math.max(0, task.estimatedHours - (task.actualHours ?? 0))
    return sprintCopy.cardRemaining(hoursText(left))
  }
  return estimateText(task)
}

/** Quadro da sprint ativa: uma coluna por estado, cartões com chave, título, horas e remoção. */
export function ActiveBoard({
  items,
  midSprint,
  showEstimates,
  removeDisabled,
  onOpenTask,
  onRemove,
}: {
  readonly items: readonly TaskDto[]
  readonly midSprint: ReadonlySet<string>
  readonly showEstimates: boolean
  readonly removeDisabled: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onRemove: (taskId: string) => void
}) {
  const groups = groupByStatus(items)
  const statuses: readonly TaskStatus[] =
    groups.planning.length > 0 ? ['planning', ...BOARD_STATUSES] : BOARD_STATUSES
  return (
    <div
      className={styles.board}
      aria-label={sprintCopy.items}
      style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(220px, 1fr))` }}
    >
      {statuses.map((status) => {
        const column = groups[status]
        const hours = sumHours(column)
        return (
          <section
            key={status}
            className={styles.boardColumn}
            aria-label={TASK_STATUS_LABELS[status]}
            data-status={status}
          >
            <header className={styles.boardColumnHead}>
              <span className={styles.statusDot} aria-hidden="true" />
              <h4 className={styles.boardColumnName}>{TASK_STATUS_LABELS[status]}</h4>
              <span className={styles.count}>{column.length}</span>
              <span className={styles.spacer} />
              {showEstimates ? (
                <span className={styles.count}>{hoursText(hours.estimated)}</span>
              ) : null}
            </header>
            {column.length === 0 ? (
              <p className={styles.cardEmpty}>{sprintCopy.noColumnItems}</p>
            ) : (
              <ul className={styles.boardCards}>
                {column.map((task) => (
                  <li
                    key={task.id}
                    className={styles.boardCard}
                    data-done={status === 'done' ? 'yes' : 'no'}
                  >
                    <div className={styles.cardTop}>
                      <TaskKey value={task.key} />
                      <span className={styles.spacer} />
                      {midSprint.has(task.id) ? (
                        <span className={styles.flag}>{sprintCopy.addedMidSprint}</span>
                      ) : null}
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={sprintCopy.removeItem(task.title)}
                        disabled={removeDisabled}
                        onClick={() => onRemove(task.id)}
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.boardCardTitle}
                      aria-label={sprintCopy.openItem(task.title)}
                      onClick={() => onOpenTask(task.id)}
                    >
                      {task.title}
                    </button>
                    <span className={styles.cardMeta}>
                      {showEstimates || task.status === 'review' ? cardHoursText(task) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
