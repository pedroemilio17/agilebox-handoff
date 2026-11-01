import { useQueries } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { KeyboardEventHandler, PointerEventHandler, ReactNode } from 'react'
import { TASK_STATUSES, TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import type { TaskStatus } from '@agilebox/core'
import { Avatar, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { formatDate } from '../../shared/lib/format-date'
import { panelCopy } from '../copy'
import styles from './BoardView.module.css'

// O destino é a coluna sob o cursor; só sem cursor (teclado) vale a sobreposição do card.
const detectCollisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

export interface BoardViewProps {
  readonly tasks: readonly TaskDto[] | undefined
  readonly loading: boolean
  readonly error: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onMoveTask: (taskId: string, status: TaskStatus) => void
}

export function BoardView({ tasks, loading, error, onOpenTask, onMoveTask }: BoardViewProps) {
  const api = useApi()
  const [activeTask, setActiveTask] = useState<{ task: TaskDto; width: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const lastDroppedId = useRef<string | null>(null)
  useLayoutAnimation(boardRef, tasks, activeTask !== null, lastDroppedId)
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

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = (tasks ?? []).find((item) => item.id === active.id)
    if (task) setActiveTask({ task, width: active.rect.current.initial?.width ?? 240 })
  }
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    lastDroppedId.current = String(active.id)
    setActiveTask(null)
    moveTaskAfterDrop(active.id, over?.id, tasks ?? [], onMoveTask)
  }

  return (
    <DndContext
      collisionDetection={detectCollisions}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
      sensors={sensors}
    >
      <div ref={boardRef} aria-label={panelCopy.boardLabel} className={styles.board}>
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
      {/* O card "sai" da coluna enquanto é arrastado: esta cópia flutua livre sobre o quadro. */}
      <DragOverlay dropAnimation={{ duration: 350, easing: 'cubic-bezier(.32, .72, 0, 1)' }}>
        {activeTask ? (
          <div className={styles.overlay} style={{ width: activeTask.width }}>
            <TaskCard onOpen={() => undefined} responsibleName={undefined} task={activeTask.task} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * Anima (FLIP) os cards que mudam de lugar quando as tarefas mudam: quem foi empurrado ou subiu
 * desliza até a nova posição. O card recém-solto é ignorado, porque o DragOverlay já o anima.
 */
function useLayoutAnimation(
  rootRef: { readonly current: HTMLElement | null },
  tasks: readonly TaskDto[] | undefined,
  dragging: boolean,
  droppedId: { current: string | null },
) {
  const previous = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || dragging) return
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, DOMRect>()
    const dropped = droppedId.current
    for (const element of root.querySelectorAll<HTMLElement>('[data-task-id]')) {
      const id = element.dataset.taskId!
      const rect = element.getBoundingClientRect()
      next.set(id, rect)
      const before = previous.current.get(id)
      if (!before || reduced || id === dropped || typeof element.animate !== 'function') continue
      const dx = before.left - rect.left
      const dy = before.top - rect.top
      if (dx === 0 && dy === 0) continue
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 450, easing: 'cubic-bezier(.32, .72, 0, 1)' },
      )
    }
    droppedId.current = null
    previous.current = next
  }, [rootRef, tasks, dragging, droppedId])
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
  // O card inteiro arrasta com o mouse (o clique simples ainda abre a tarefa: o arraste só começa
  // depois de 6 px). O teclado fica no botão ⠿, que segue sendo o único elemento focável do arraste.
  const onPointerDown = listeners?.onPointerDown as PointerEventHandler<HTMLLIElement> | undefined
  const onKeyDown = listeners?.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined
  return (
    <li
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.cardGhost : ''}`}
      data-task-id={task.id}
      onPointerDown={onPointerDown}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
    >
      <button
        className={styles.dragHandle}
        type="button"
        {...attributes}
        onKeyDown={onKeyDown}
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
