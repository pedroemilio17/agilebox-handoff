import { useQueries } from '@tanstack/react-query'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ReactNode } from 'react'
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
  readonly onMoveTask: (taskId: string, status: TaskStatus) => void
}

export function BoardView({ tasks, loading, error, onOpenTask, onMoveTask }: BoardViewProps) {
  const api = useApi()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
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

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    moveTaskAfterDrop(active.id, over?.id, tasks ?? [], onMoveTask)
  }

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <div aria-label={panelCopy.boardLabel} className={styles.board}>
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            onOpenTask={onOpenTask}
            onMoveTask={onMoveTask}
            responsibleNames={
              new Map(
                (tasks ?? []).map((task, index) => [task.id, responsibleQueries[index]?.data]),
              )
            }
            status={status}
            tasks={(tasks ?? []).filter((task) => task.status === status)}
          />
        ))}
      </div>
    </DndContext>
  )
}

export function moveTaskAfterDrop(
  activeId: string | number,
  overId: string | number | undefined,
  tasks: readonly TaskDto[],
  onMoveTask: (taskId: string, status: TaskStatus) => void,
) {
  if (overId === undefined) return
  const task = tasks.find((item) => item.id === activeId)
  const targetId = String(overId)
  const targetTask = tasks.find((item) => item.id === targetId)
  const status = TASK_STATUSES.includes(targetId as TaskStatus)
    ? (targetId as TaskStatus)
    : targetTask?.status
  if (task && status && task.status !== status) onMoveTask(task.id, status)
}

interface KanbanColumnProps {
  readonly status: TaskStatus
  readonly tasks: readonly TaskDto[]
  readonly responsibleNames: ReadonlyMap<string, string | undefined>
  readonly onOpenTask: (taskId: string) => void
  readonly onMoveTask: (taskId: string, status: TaskStatus) => void
}

function KanbanColumn({
  status,
  tasks,
  responsibleNames,
  onOpenTask,
  onMoveTask,
}: KanbanColumnProps) {
  const title = TASK_STATUS_LABELS[status]
  const sortedTasks = [...tasks].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  )
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <section
      ref={setNodeRef}
      aria-label={`${title}, tarefas`}
      className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
      role="region"
    >
      <header className={styles.columnHeading}>
        <h2>{title}</h2>
        <span aria-label={`${tasks.length} tarefas`}>{tasks.length}</span>
      </header>
      <SortableContext
        items={sortedTasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={styles.cards}>
          {sortedTasks.length === 0 ? (
            <li className={styles.empty}>{panelCopy.boardColumnEmpty}</li>
          ) : (
            sortedTasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} onMoveTask={onMoveTask}>
                <TaskCard
                  onOpen={() => onOpenTask(task.id)}
                  responsibleName={responsibleNames.get(task.id)}
                  task={task}
                />
              </SortableTaskCard>
            ))
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

function SortableTaskCard({
  task,
  onMoveTask,
  children,
}: {
  task: TaskDto
  onMoveTask: (taskId: string, status: TaskStatus) => void
  children: ReactNode
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  })
  return (
    <li
      ref={setNodeRef}
      className={styles.card}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
    >
      <button
        className={styles.dragHandle}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${panelCopy.moveTask} ${task.title}`}
        title={panelCopy.moveTask}
      >
        ⠿
      </button>
      {children}
      <select
        aria-label={panelCopy.moveTaskToState(task.title)}
        className={styles.statusSelect}
        onChange={(event) => onMoveTask(task.id, event.target.value as TaskStatus)}
        value={task.status}
      >
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {TASK_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </li>
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
