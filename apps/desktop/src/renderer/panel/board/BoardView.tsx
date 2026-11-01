import { useQueries } from '@tanstack/react-query'
import { TASK_STATUSES, TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import type { TaskStatus } from '@agilebox/core'
import { Avatar, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { formatDate } from '../../shared/lib/format-date'
import { panelCopy } from '../copy'
import styles from './BoardView.module.css'

export interface BoardViewProps {
  readonly tasks: readonly TaskDto[] | undefined
  readonly loading: boolean
  readonly error: boolean
  readonly onOpenTask: (taskId: string) => void
}

export function BoardView({ tasks, loading, error, onOpenTask }: BoardViewProps) {
  const api = useApi()
  const responsibleQueries = useQueries({
    queries: (tasks ?? []).map((task) => ({
      queryKey: queryKeys.tasks.detail(task.id),
      queryFn: () => api.tasks.get({ taskId: task.id }),
      select: (detail: Awaited<ReturnType<typeof api.tasks.get>>) =>
        detail.participations.find((participation) => participation.role === 'responsible')
          ?.participantName,
    })),
  })

  if (loading) {
    return (
      <div
        aria-label={panelCopy.boardLoading}
        className={styles.board}
        role="status"
        aria-busy="true"
      >
        {TASK_STATUSES.map((status) => (
          <section className={styles.column} key={status}>
            <h2 className={styles.columnHeading}>{TASK_STATUS_LABELS[status]}</h2>
            <Skeleton aria-label={panelCopy.loading} className={styles.skeletonCard} />
            <Skeleton aria-label={panelCopy.loading} className={styles.skeletonCard} />
          </section>
        ))}
      </div>
    )
  }

  if (error)
    return (
      <p className={styles.error} role="alert">
        {panelCopy.boardError}
      </p>
    )

  return (
    <div aria-label={panelCopy.boardLabel} className={styles.board}>
      {TASK_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          onOpenTask={onOpenTask}
          responsibleNames={
            new Map((tasks ?? []).map((task, index) => [task.id, responsibleQueries[index]?.data]))
          }
          status={status}
          tasks={(tasks ?? []).filter((task) => task.status === status)}
        />
      ))}
    </div>
  )
}

interface KanbanColumnProps {
  readonly status: TaskStatus
  readonly tasks: readonly TaskDto[]
  readonly responsibleNames: ReadonlyMap<string, string | undefined>
  readonly onOpenTask: (taskId: string) => void
}

function KanbanColumn({ status, tasks, responsibleNames, onOpenTask }: KanbanColumnProps) {
  const title = TASK_STATUS_LABELS[status]

  return (
    <section aria-label={`${title}, tarefas`} className={styles.column} role="region">
      <header className={styles.columnHeading}>
        <h2>{title}</h2>
        <span aria-label={`${tasks.length} tarefas`}>{tasks.length}</span>
      </header>
      <ul className={styles.cards}>
        {tasks.length === 0 ? (
          <li className={styles.empty}>{panelCopy.boardColumnEmpty}</li>
        ) : (
          tasks.map((task) => (
            <li className={styles.card} key={task.id}>
              <TaskCard
                onOpen={() => onOpenTask(task.id)}
                responsibleName={responsibleNames.get(task.id)}
                task={task}
              />
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

interface TaskCardProps {
  readonly task: TaskDto
  readonly responsibleName: string | undefined
  readonly onOpen: () => void
}

function TaskCard({ task, responsibleName, onOpen }: TaskCardProps) {
  const deadline = task.deadline ? formatDate(new Date(`${task.deadline}T12:00:00`)) : undefined

  return (
    <button className={styles.cardButton} onClick={onOpen} type="button">
      <span className={styles.taskTitle}>{task.title}</span>
      <span className={styles.cardMeta}>
        {deadline ? <time dateTime={task.deadline ?? undefined}>{deadline}</time> : <span />}
        {responsibleName ? (
          <Avatar aria-label={`Responsável: ${responsibleName}`} name={responsibleName} />
        ) : null}
      </span>
    </button>
  )
}
