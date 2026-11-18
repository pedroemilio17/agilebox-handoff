import { formatHours, sprintLabel } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { TaskKey } from '@agilebox/ui'
import { useBacklogList } from '../backlog/use-backlog'
import { heldByOtherSprint } from './sprint-rules'
import { sprintCopy } from './sprint-copy'
import styles from './SprintsView.module.css'

/** Horas em pt-BR, com a unidade ("6 h", "1,5 h"), como no restante do painel. */
export function hoursText(hours: number): string {
  return formatHours(Math.round(hours * 100))
}

/** Estimativa de uma tarefa, ou "—" quando não tem. */
export function estimateText(task: Pick<TaskDto, 'estimatedHours'>): string {
  return task.estimatedHours == null ? '—' : hoursText(task.estimatedHours)
}

/** Linha de item da sprint na coluna "Sprint" (Planejamento): chave, título e remoção. */
export function SprintLine({
  task,
  showEstimates,
  onOpen,
  onRemove,
  removeDisabled,
}: {
  readonly task: TaskDto
  readonly showEstimates: boolean
  readonly onOpen: (taskId: string) => void
  readonly onRemove: (taskId: string) => void
  readonly removeDisabled?: boolean
}) {
  return (
    <li className={styles.sprintLine}>
      <TaskKey value={task.key} />
      <button
        type="button"
        className={styles.titleButton}
        aria-label={sprintCopy.openItem(task.title)}
        onClick={() => onOpen(task.id)}
      >
        {task.title}
      </button>
      <span className={styles.estimate}>{showEstimates ? estimateText(task) : ''}</span>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={sprintCopy.removeItem(task.title)}
        disabled={removeDisabled}
        onClick={() => onRemove(task.id)}
      >
        <MinusIcon />
      </button>
    </li>
  )
}

/**
 * Backlog do projeto para escolher itens da sprint, no layout do design: ordem, chave, título,
 * estimativa e "+". Os itens podem ser arrastados para a coluna da sprint. Item de outra sprint
 * aparece com o marcador e sem botão (o domínio recusa a segunda sprint).
 */
export function BacklogPicker({
  projectId,
  sprintId,
  excludeTaskIds,
  busy,
  showEstimates,
  onAdd,
}: {
  readonly projectId: string
  readonly sprintId: string
  readonly excludeTaskIds: ReadonlySet<string>
  readonly busy: boolean
  readonly showEstimates: boolean
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
  const withoutEstimate = candidates.filter((task) => task.estimatedHours == null).length
  return (
    <section className={styles.card} aria-label={sprintCopy.backlogPick}>
      <header className={styles.cardHeader}>
        <h3 className={styles.cardHeading}>{sprintCopy.backlogTitle}</h3>
        <span className={styles.count}>{sprintCopy.backlogOrder(candidates.length)}</span>
        <span className={styles.spacer} />
        {showEstimates && withoutEstimate > 0 ? (
          <span className={styles.warn}>{sprintCopy.noEstimateCount(withoutEstimate)}</span>
        ) : null}
      </header>
      {candidates.length === 0 ? (
        <p className={styles.cardEmpty}>{sprintCopy.backlogPickEmpty}</p>
      ) : (
        <ul className={styles.backlogList}>
          {candidates.map((task, index) => {
            const other = heldByOtherSprint(task, sprintId)
            return (
              <li
                key={task.id}
                className={styles.backlogRow}
                draggable={!other && !busy}
                onDragStart={(event) => {
                  event.dataTransfer?.setData('text/plain', task.id)
                }}
              >
                <span className={styles.position}>{index + 1}</span>
                <TaskKey value={task.key} />
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{task.title}</span>
                  {other && task.sprint ? (
                    <span className={styles.meta}>
                      {sprintCopy.backlogBusy(sprintLabel(task.sprint.number))}
                    </span>
                  ) : null}
                </div>
                <span
                  className={task.estimatedHours == null ? styles.estimateMissing : styles.estimate}
                >
                  {showEstimates ? estimateText(task) : ''}
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={sprintCopy.backlogAdd(task.title)}
                  disabled={busy || other}
                  onClick={() => onAdd(task)}
                >
                  <PlusIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className={styles.cardFoot}>{sprintCopy.backlogDragHint}</p>
    </section>
  )
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
    </svg>
  )
}
