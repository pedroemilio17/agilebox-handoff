import {
  useState,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { TaskKey } from '@agilebox/ui'
import { isArchivedTask } from '../../shared/lib/task-signals'
import {
  anchorStyle,
  dragAnchorPoint,
  isPointerPoint,
  type AnchorPoint,
} from '../board/drag-anchor'
import { panelCopy } from '../copy'
import { hoursText, estimateText } from './SprintItems'
import { sprintCopy } from './sprint-copy'
import { groupByStatus, sumHours } from './sprint-rules'
import styles from './SprintsView.module.css'

/** Colunas que o quadro da sprint mostra sempre (design). "Planejamento" só aparece com itens. */
const BOARD_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

// O destino é a coluna sob o cursor; só sem cursor (teclado) vale a sobreposição do card.
const detectCollisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

/** Estado de destino de uma solta no quadro da sprint: coluna ou tarefa sob o ponteiro. */
export function sprintDropTargetStatus(
  overId: string | number | undefined,
  items: readonly TaskDto[],
  statuses: readonly TaskStatus[],
): TaskStatus | undefined {
  if (overId === undefined) return undefined
  const targetId = String(overId)
  if (statuses.includes(targetId as TaskStatus)) return targetId as TaskStatus
  return items.find((item) => item.id === targetId)?.status
}

/** Move a tarefa arrastada para a coluna de destino caso seja um estado diferente do atual. */
export function moveSprintTaskAfterDrop(
  activeId: string | number,
  overId: string | number | undefined,
  items: readonly TaskDto[],
  statuses: readonly TaskStatus[],
  onMoveTask: (task: TaskDto, status: TaskStatus) => void,
): boolean {
  const task = items.find((item) => item.id === activeId)
  const target = sprintDropTargetStatus(overId, items, statuses)
  if (!task || !target || task.status === target) return false
  onMoveTask(task, target)
  return true
}

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

export interface ActiveBoardProps {
  readonly items: readonly TaskDto[]
  readonly midSprint: ReadonlySet<string>
  readonly showEstimates: boolean
  readonly removeDisabled: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onRemove: (taskId: string) => void
  readonly onMoveTask?: (task: TaskDto, status: TaskStatus) => void
  /** Selo extra no topo do cartão (ex.: a entrega da tarefa, na tela da sprint dentro da entrega). */
  readonly cardTag?: (task: TaskDto) => ReactNode
}

/** Quadro da sprint ativa: colunas por estado com arraste por ponteiro e teclado. */
export function ActiveBoard({
  items,
  midSprint,
  showEstimates,
  removeDisabled,
  onOpenTask,
  onRemove,
  onMoveTask,
  cardTag,
}: ActiveBoardProps) {
  const groups = groupByStatus(items)
  const statuses: readonly TaskStatus[] =
    groups.planning.length > 0 ? ['planning', ...BOARD_STATUSES] : BOARD_STATUSES
  const [activeTask, setActiveTask] = useState<{
    readonly task: TaskDto
    readonly width: number
    readonly anchor: AnchorPoint | null
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const task = items.find((item) => item.id === active.id)
    const initial = active.rect.current.initial
    if (!task) return
    const anchor = initial
      ? dragAnchorPoint(isPointerPoint(activatorEvent) ? activatorEvent : null, initial)
      : null
    setActiveTask({ task, width: initial?.width ?? 220, anchor })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!onMoveTask) return
    moveSprintTaskAfterDrop(active.id, over?.id, items, statuses, onMoveTask)
  }

  const grid = (
    <div
      className={styles.board}
      aria-label={sprintCopy.items}
      style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(220px, 1fr))` }}
    >
      {statuses.map((status) => (
        <SprintBoardColumn
          key={status}
          status={status}
          statuses={statuses}
          column={groups[status]}
          midSprint={midSprint}
          showEstimates={showEstimates}
          removeDisabled={removeDisabled}
          onOpenTask={onOpenTask}
          onRemove={onRemove}
          onMoveTask={onMoveTask}
          cardTag={cardTag}
        />
      ))}
    </div>
  )

  if (!onMoveTask) return grid

  return (
    <DndContext
      collisionDetection={detectCollisions}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
      sensors={sensors}
    >
      {grid}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div
              className={styles.boardOverlay}
              data-done={activeTask.task.status === 'done' ? 'yes' : 'no'}
              style={{ width: activeTask.width, ...anchorStyle(activeTask.anchor) }}
            >
              <SprintCardBody
                task={activeTask.task}
                midSprint={midSprint.has(activeTask.task.id)}
                showEstimates={showEstimates}
                cardTag={cardTag}
              />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}

interface SprintBoardColumnProps {
  readonly status: TaskStatus
  readonly statuses: readonly TaskStatus[]
  readonly column: readonly TaskDto[]
  readonly midSprint: ReadonlySet<string>
  readonly showEstimates: boolean
  readonly removeDisabled: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onRemove: (taskId: string) => void
  readonly onMoveTask: ((task: TaskDto, status: TaskStatus) => void) | undefined
  readonly cardTag: ((task: TaskDto) => ReactNode) | undefined
}

function SprintBoardColumn({
  status,
  statuses,
  column,
  midSprint,
  showEstimates,
  removeDisabled,
  onOpenTask,
  onRemove,
  onMoveTask,
  cardTag,
}: SprintBoardColumnProps) {
  const hours = sumHours(column)
  const { isOver, setNodeRef } = useDroppable({ id: status, disabled: !onMoveTask })
  const draggableIds = onMoveTask
    ? column.filter((task) => !isArchivedTask(task)).map((task) => task.id)
    : []

  const columnClass = [styles.boardColumn, isOver ? styles.boardColumnOver : '']
    .filter(Boolean)
    .join(' ')

  return (
    <section
      ref={setNodeRef}
      className={columnClass}
      aria-label={TASK_STATUS_LABELS[status]}
      data-status={status}
    >
      <header className={styles.boardColumnHead}>
        <span className={styles.statusDot} aria-hidden="true" />
        <h4 className={styles.boardColumnName}>{TASK_STATUS_LABELS[status]}</h4>
        <span className={styles.count}>{column.length}</span>
        <span className={styles.spacer} />
        {showEstimates ? <span className={styles.count}>{hoursText(hours.estimated)}</span> : null}
      </header>
      <SortableContext items={draggableIds} strategy={verticalListSortingStrategy}>
        {column.length === 0 ? (
          <p className={styles.cardEmpty}>{sprintCopy.noColumnItems}</p>
        ) : (
          <ul className={styles.boardCards}>
            {column.map((task) => (
              <SortableSprintCard
                key={task.id}
                task={task}
                status={status}
                statuses={statuses}
                midSprint={midSprint.has(task.id)}
                showEstimates={showEstimates}
                removeDisabled={removeDisabled}
                onOpenTask={onOpenTask}
                onRemove={onRemove}
                onMoveTask={onMoveTask}
                cardTag={cardTag}
              />
            ))}
          </ul>
        )}
      </SortableContext>
    </section>
  )
}

interface SortableSprintCardProps {
  readonly task: TaskDto
  readonly status: TaskStatus
  readonly statuses: readonly TaskStatus[]
  readonly midSprint: boolean
  readonly showEstimates: boolean
  readonly removeDisabled: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onRemove: (taskId: string) => void
  readonly onMoveTask: ((task: TaskDto, status: TaskStatus) => void) | undefined
  readonly cardTag: ((task: TaskDto) => ReactNode) | undefined
}

function SortableSprintCard({
  task,
  status,
  statuses,
  midSprint,
  showEstimates,
  removeDisabled,
  onOpenTask,
  onRemove,
  onMoveTask,
  cardTag,
}: SortableSprintCardProps) {
  const draggable = onMoveTask !== undefined && !isArchivedTask(task)
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    disabled: !draggable,
  })
  const onPointerDown = draggable
    ? (listeners?.onPointerDown as PointerEventHandler<HTMLLIElement> | undefined)
    : undefined
  const onKeyDown = draggable
    ? (listeners?.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined)
    : undefined

  const cardClass = [
    styles.boardCard,
    draggable ? styles.boardCardDraggable : '',
    isDragging ? styles.boardCardGhost : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      ref={draggable ? setNodeRef : undefined}
      className={cardClass}
      data-task-id={task.id}
      data-done={status === 'done' ? 'yes' : 'no'}
      onPointerDown={onPointerDown}
      style={
        draggable
          ? {
              transform: transform
                ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                : undefined,
              transition,
            }
          : undefined
      }
    >
      <SprintCardBody
        task={task}
        midSprint={midSprint}
        showEstimates={showEstimates}
        cardTag={cardTag}
        onOpenTask={() => onOpenTask(task.id)}
        onRemove={() => onRemove(task.id)}
        removeDisabled={removeDisabled}
        dragHandle={
          draggable ? (
            <button
              type="button"
              className={styles.dragHandle}
              {...attributes}
              onKeyDown={onKeyDown}
              aria-label={`${panelCopy.moveTask} ${task.title}`}
              title={panelCopy.moveTask}
            >
              ⠿
            </button>
          ) : null
        }
      />
      {draggable && onMoveTask ? (
        <select
          aria-label={panelCopy.moveTaskToState(task.title)}
          className={styles.statusSelect}
          value={task.status}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onMoveTask(task, event.target.value as TaskStatus)}
        >
          {statuses.map((optionStatus) => (
            <option key={optionStatus} value={optionStatus}>
              {TASK_STATUS_LABELS[optionStatus]}
            </option>
          ))}
        </select>
      ) : null}
    </li>
  )
}

function SprintCardBody({
  task,
  midSprint,
  showEstimates,
  cardTag,
  onOpenTask,
  onRemove,
  removeDisabled = false,
  dragHandle,
}: {
  readonly task: TaskDto
  readonly midSprint: boolean
  readonly showEstimates: boolean
  readonly cardTag: ((task: TaskDto) => ReactNode) | undefined
  readonly onOpenTask?: () => void
  readonly onRemove?: () => void
  readonly removeDisabled?: boolean
  readonly dragHandle?: ReactNode
}) {
  return (
    <>
      <div className={styles.cardTop}>
        {dragHandle}
        <TaskKey value={task.key} />
        {cardTag ? cardTag(task) : null}
        <span className={styles.spacer} />
        {midSprint ? <span className={styles.flag}>{sprintCopy.addedMidSprint}</span> : null}
        {onRemove ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={sprintCopy.removeItem(task.title)}
            disabled={removeDisabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRemove}
          >
            <span aria-hidden="true">−</span>
          </button>
        ) : null}
      </div>
      {onOpenTask ? (
        <button
          type="button"
          className={styles.boardCardTitle}
          aria-label={sprintCopy.openItem(task.title)}
          onClick={onOpenTask}
        >
          {task.title}
        </button>
      ) : (
        <span className={styles.boardCardTitle}>{task.title}</span>
      )}
      <span className={styles.cardMeta}>
        {showEstimates || task.status === 'review' ? cardHoursText(task) : ''}
      </span>
    </>
  )
}
