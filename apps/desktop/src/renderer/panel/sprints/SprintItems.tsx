import { formatHours, sprintLabel, TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { Button, TaskKey } from '@agilebox/ui'
import { useBacklogList } from '../backlog/use-backlog'
import { heldByOtherSprint } from './sprint-rules'
import { sprintCopy } from './sprint-copy'
import styles from './SprintsView.module.css'

/** Linha de item de sprint: chave, título (abre o detalhe), estado e remoção opcional. */
export function SprintItemRow({
  task,
  midSprint,
  onOpen,
  onRemove,
  removeDisabled,
}: {
  readonly task: TaskDto
  readonly midSprint: boolean
  readonly onOpen: (taskId: string) => void
  readonly onRemove?: ((taskId: string) => void) | undefined
  readonly removeDisabled?: boolean
}) {
  return (
    <li className={styles.itemRow}>
      <div className={styles.itemText}>
        <div className={styles.itemTop}>
          <TaskKey value={task.key} />
          <button
            type="button"
            className={styles.titleButton}
            aria-label={sprintCopy.openItem(task.title)}
            onClick={() => onOpen(task.id)}
          >
            {task.title}
          </button>
        </div>
        <div className={styles.meta}>
          <span>{TASK_STATUS_LABELS[task.status]}</span>
          {midSprint ? <span className={styles.midMark}>{sprintCopy.addedMidSprint}</span> : null}
        </div>
      </div>
      {onRemove ? (
        <Button
          type="button"
          aria-label={sprintCopy.removeItem(task.title)}
          disabled={removeDisabled}
          onClick={() => onRemove(task.id)}
        >
          Remover
        </Button>
      ) : null}
    </li>
  )
}

/** Horas estimadas e realizadas, em formato pt-BR (centésimos de hora, como no restante do painel). */
export function hoursText(hours: number): string {
  return formatHours(Math.round(hours * 100))
}

/**
 * Backlog do projeto para escolher itens da sprint. Itens já nesta sprint ficam de fora; item que
 * está em outra sprint aparece com o marcador e sem botão (o domínio recusa a segunda sprint).
 */
export function BacklogPicker({
  projectId,
  sprintId,
  excludeTaskIds,
  busy,
  onAdd,
}: {
  readonly projectId: string
  readonly sprintId: string
  readonly excludeTaskIds: ReadonlySet<string>
  readonly busy: boolean
  readonly onAdd: (task: TaskDto) => void
}) {
  const backlog = useBacklogList(projectId)
  if (backlog.isPending)
    return (
      <p role="status" className={styles.hint}>
        {sprintCopy.backlogLoading}
      </p>
    )
  const candidates = (backlog.data ?? []).filter((task) => !excludeTaskIds.has(task.id))
  return (
    <section className={styles.picker} aria-label={sprintCopy.backlogPick}>
      <h4 className={styles.sectionTitle}>{sprintCopy.backlogPick}</h4>
      {candidates.length === 0 ? (
        <p className={styles.hint}>{sprintCopy.backlogPickEmpty}</p>
      ) : (
        <ul className={styles.list}>
          {candidates.map((task) => {
            const other = heldByOtherSprint(task, sprintId)
            return (
              <li key={task.id} className={styles.itemRow}>
                <div className={styles.itemText}>
                  <div className={styles.itemTop}>
                    <TaskKey value={task.key} />
                    <span className={styles.itemTitle}>{task.title}</span>
                  </div>
                  {other && task.sprint ? (
                    <span className={styles.meta}>
                      {sprintCopy.backlogBusy(sprintLabel(task.sprint.number))}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  aria-label={sprintCopy.backlogAdd(task.title)}
                  disabled={busy || other}
                  onClick={() => onAdd(task)}
                >
                  {sprintCopy.backlogAddButton}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
