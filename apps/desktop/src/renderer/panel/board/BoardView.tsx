import { useQueries } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import {
  deadlineLabel,
  diffInDays,
  parseDateOnly,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import type { TaskStatus } from '@agilebox/core'
import {
  Avatar,
  Button,
  EmptyState,
  Skeleton,
  StatusChip,
  ProjectSwatch,
  SignalBadge,
  TaskKey,
} from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { formatDate } from '../../shared/lib/format-date'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { formatTaskCount, formatUpdatedAgo } from './board-status'
import styles from './BoardView.module.css'

// O destino é a coluna sob o cursor; só sem cursor (teclado) vale a sobreposição do card.
const detectCollisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

export interface BoardViewProps {
  readonly cycleDays?: number | null
  readonly flowError?: boolean
  readonly initialException?: 'aging' | 'overdue' | null
  readonly selectedTaskId?: string | null
  readonly tasks: readonly TaskDto[] | undefined
  readonly loading: boolean
  readonly error: boolean
  readonly onCreateTask?: (status: TaskStatus) => void
  /** Cria tarefa sem estado definido (botão do estado vazio). */
  readonly onNewTask?: () => void
  /** Momento (ms) em que a lista foi obtida pela última vez. */
  readonly updatedAt?: number | undefined
  /** Há uma busca em andamento sobre dados já exibidos. */
  readonly refreshing?: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onMoveTask: (taskId: string, status: TaskStatus) => void
}

export function BoardView({
  tasks,
  loading,
  error,
  onOpenTask,
  onMoveTask,
  onCreateTask,
  onNewTask,
  updatedAt,
  refreshing = false,
  selectedTaskId,
  cycleDays = null,
  flowError = false,
  initialException = null,
}: BoardViewProps) {
  const api = useApi()
  const [exception, setException] = useState<'aging' | 'overdue' | null>(initialException)
  // Relógio do indicador "atualizado há N min": recalcula a cada 30 s, sem refazer a busca.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const [activeTask, setActiveTask] = useState<{ task: TaskDto; width: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const lastDroppedId = useRef<string | null>(null)
  const pendingLanding = useRef<PendingLanding | null>(null)
  useLayoutAnimation(boardRef, tasks, activeTask !== null, lastDroppedId, pendingLanding)
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
    const moved = moveTaskAfterDrop(active.id, over?.id, tasks ?? [], onMoveTask)
    const dropped = active.rect.current.translated
    // O card "voa" do ponto onde foi solto até o lugar novo assim que a lista atualizar.
    pendingLanding.current =
      moved && dropped
        ? { id: String(active.id), left: dropped.left, top: dropped.top, tasks }
        : null
  }

  const agingCount = (tasks ?? []).filter((task) => (task.agingDays ?? 0) > 4).length
  const overdueCount = (tasks ?? []).filter((task) => task.overdue).length
  const visibleTasks = (tasks ?? []).filter((task) =>
    exception === 'aging'
      ? (task.agingDays ?? 0) > 4
      : exception === 'overdue'
        ? task.overdue
        : true,
  )
  const noTasks = (tasks ?? []).length === 0
  return (
    <>
      <div className={styles.filters} aria-label="Filtros do quadro">
        <button
          type="button"
          aria-pressed={exception === 'aging'}
          onClick={() => setException(exception === 'aging' ? null : 'aging')}
        >
          Paradas · {agingCount}
        </button>
        <button
          type="button"
          aria-pressed={exception === 'overdue'}
          onClick={() => setException(exception === 'overdue' ? null : 'overdue')}
        >
          Vencidas · {overdueCount}
        </button>
        <span>
          {formatTaskCount(visibleTasks.length)} ·{' '}
          {refreshing
            ? 'atualizando…'
            : updatedAt === undefined
              ? '—'
              : formatUpdatedAgo(updatedAt, now)}
        </span>
      </div>
      {noTasks && (
        <EmptyState
          className={styles.emptyBoard}
          title="Nenhuma tarefa ainda"
          description="Crie a primeira tarefa para começar a acompanhar o trabalho do time."
          action={
            onNewTask ? (
              <Button variant="primary" shortcut="N" onClick={onNewTask}>
                Nova tarefa
              </Button>
            ) : null
          }
        />
      )}
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
              cycleDays={cycleDays}
              flowError={flowError}
              selectedTaskId={selectedTaskId}
              onCreateTask={onCreateTask}
              onOpenTask={onOpenTask}
              onMoveTask={onMoveTask}
              responsibleNames={
                new Map(
                  (tasks ?? []).map((task, index) => [task.id, responsibleQueries[index]?.data]),
                )
              }
              status={status}
              tasks={visibleTasks.filter((task) => task.status === status)}
            />
          ))}
        </div>
        {/* O card "sai" da coluna enquanto é arrastado: esta cópia flutua livre sobre o quadro. */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className={styles.overlay} style={{ width: activeTask.width }}>
              <TaskCard
                onOpen={() => undefined}
                responsibleName={undefined}
                task={activeTask.task}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}

/**
 * Anima (FLIP) os cards que mudam de lugar quando as tarefas mudam: quem foi empurrado ou subiu
 * desliza até a nova posição. O card recém-solto é ignorado, porque o DragOverlay já o anima.
 */
interface PendingLanding {
  readonly id: string
  readonly left: number
  readonly top: number
  readonly tasks: readonly TaskDto[] | undefined
}

const SMOOTH = 'cubic-bezier(.32, .72, 0, 1)'

function useLayoutAnimation(
  rootRef: { readonly current: HTMLElement | null },
  tasks: readonly TaskDto[] | undefined,
  dragging: boolean,
  droppedId: { current: string | null },
  pending: { current: PendingLanding | null },
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
      const landing = pending.current
      if (landing?.id === id && landing.tasks !== tasks) {
        pending.current = null
        if (!reduced && typeof element.animate === 'function') {
          // Parte do ponto onde o card foi solto, ainda "levantado", e assenta no lugar novo.
          element.animate(
            [
              {
                transform: `translate(${landing.left - rect.left}px, ${landing.top - rect.top}px) scale(1.04) rotate(2deg)`,
                opacity: 0.9,
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
              },
              {
                transform: 'translate(0, 0) scale(1) rotate(0deg)',
                opacity: 1,
                boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
              },
            ],
            { duration: 560, easing: SMOOTH },
          )
        }
        continue
      }
      const before = previous.current.get(id)
      if (!before || reduced || id === dropped || typeof element.animate !== 'function') continue
      const dx = before.left - rect.left
      const dy = before.top - rect.top
      if (dx === 0 && dy === 0) continue
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 520, easing: SMOOTH },
      )
    }
    droppedId.current = null
    previous.current = next
  }, [rootRef, tasks, dragging, droppedId, pending])
}

export function moveTaskAfterDrop(
  activeId: string | number,
  overId: string | number | undefined,
  tasks: readonly TaskDto[],
  onMoveTask: (taskId: string, status: TaskStatus) => void,
): boolean {
  if (overId === undefined) return false
  const task = tasks.find((item) => item.id === activeId)
  const targetId = String(overId)
  const targetTask = tasks.find((item) => item.id === targetId)
  const status = TASK_STATUSES.includes(targetId as TaskStatus)
    ? (targetId as TaskStatus)
    : targetTask?.status
  if (!task || !status || task.status === status) return false
  onMoveTask(task.id, status)
  return true
}

interface KanbanColumnProps {
  readonly cycleDays: number | null
  readonly flowError: boolean
  readonly selectedTaskId: BoardViewProps['selectedTaskId']
  readonly onCreateTask: BoardViewProps['onCreateTask']
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
  cycleDays,
  flowError,
  selectedTaskId,
  onCreateTask,
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
        <h2>
          <StatusChip status={status} />
        </h2>
        <span aria-label={`${tasks.length} tarefas`}>{tasks.length}</span>
        {onCreateTask && (
          <button
            type="button"
            className={styles.addTask}
            aria-label={`Nova tarefa em ${title}`}
            onClick={() => onCreateTask(status)}
          >
            +
          </button>
        )}
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
                  selected={selectedTaskId === task.id}
                  onOpen={() => onOpenTask(task.id)}
                  responsibleName={responsibleNames.get(task.id)}
                  task={task}
                />
              </SortableTaskCard>
            ))
          )}
        </ul>
      </SortableContext>
      {status === 'done' && (
        <p className={styles.cycle} {...(flowError ? { role: 'alert' } : {})}>
          {flowError
            ? 'Não foi possível calcular o ciclo.'
            : `Ciclo médio desta semana: ${cycleDays === null ? '—' : `${cycleDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}d`}`}
        </p>
      )}
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
  readonly selected?: boolean
  readonly task: TaskDto
  readonly responsibleName: string | undefined
  readonly onOpen: () => void
}

function TaskCard({ task, responsibleName, onOpen, selected = false }: TaskCardProps) {
  const deadline = describeDeadline(task)

  return (
    <button
      aria-describedby={`${task.id}-project ${task.id}-meta`}
      aria-pressed={selected}
      aria-label={`${task.key} · ${task.title}`}
      className={styles.cardButton}
      onClick={onOpen}
      type="button"
    >
      <span className={styles.cardTop}>
        <TaskKey value={task.key} />
        <span className={styles.projectName} id={`${task.id}-project`}>
          {task.projectName}
        </span>
        <ProjectSwatch
          index={Array.from(task.projectId).reduce((sum, char) => sum + char.charCodeAt(0), 0)}
          name={task.projectName}
        />
      </span>
      <span
        className={`${styles.taskTitle} ${task.status === 'done' ? styles.completedTitle : ''}`}
      >
        {task.title}
      </span>
      <span className={styles.cardMeta} id={`${task.id}-meta`}>
        {deadline ? (
          <time
            className={`${styles.deadline} ${styles[deadline.tone] ?? ''}`}
            dateTime={task.deadline ?? undefined}
            title={deadline.full}
          >
            {deadline.text}
          </time>
        ) : (
          <span />
        )}
        {(task.agingDays ?? 0) > 4 && (
          <SignalBadge variant="aging">parada {task.agingDays}d</SignalBadge>
        )}
        {responsibleName ? (
          <Avatar aria-label={`Responsável: ${responsibleName}`} name={responsibleName} />
        ) : null}
      </span>
    </button>
  )
}

type DeadlineTone = 'toneNormal' | 'toneSoon' | 'toneOverdue' | 'toneDone'

/** Prazo curto no card: a data quando há folga; "Vence amanhã" / "Venceu há 2 dias" quando é urgente. */
function describeDeadline(
  task: TaskDto,
): { text: string; full: string; tone: DeadlineTone } | null {
  if (!task.deadline) return null
  const date = parseDateOnly(task.deadline)
  const full = formatDate(new Date(`${task.deadline}T12:00:00`))
  const label = deadlineLabel(task.status, date, todayDateOnly())
  if (task.status === 'done') return { text: full, full: label, tone: 'toneDone' }
  const days = diffInDays(todayDateOnly(), date)
  if (days < 0) return { text: label, full, tone: 'toneOverdue' }
  if (days <= 1) return { text: label, full, tone: 'toneSoon' }
  return { text: full, full: label, tone: 'toneNormal' }
}
