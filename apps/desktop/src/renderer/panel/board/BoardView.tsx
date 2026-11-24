import { useQueries } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { KeyboardEventHandler, PointerEventHandler, ReactNode } from 'react'
import { anchorStyle, dragAnchorPoint, isPointerPoint } from './drag-anchor'
import type { AnchorPoint } from './drag-anchor'
import {
  deadlineLabel,
  diffInDays,
  parseDateOnly,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '@agilebox/core'
import type { TaskDto, WipColumnDto } from '@agilebox/contract'
import { formatHours } from '@agilebox/core'
import type { TaskStatus } from '@agilebox/core'
import {
  AddButton,
  Avatar,
  Button,
  ChecklistProgress,
  CommentCount,
  EmptyState,
  Skeleton,
  StatusChip,
  ProjectSwatch,
  SignalBadge,
  TaskKey,
  WipLimitMeter,
} from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities, type Capabilities } from '../../shared/capabilities/capabilities-context'
import { queryKeys } from '../../shared/query/keys'
import { formatDate } from '../../shared/lib/format-date'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { isAgingTask, isArchivedTask, isBlockedTask } from '../../shared/lib/task-signals'
import { blockedMarkerLabel } from '../impediments/impediment-copy'
import { formatTaskCount, formatUpdatedAgo } from './board-status'
import { matchesBoardSearch } from './board-search'
import { sprintMarker } from '../sprints/sprint-rules'
import { isWipStatus, type WipStatus } from './wip-limit'
import { WipLimitEditor } from './WipLimitEditor'
import styles from './BoardView.module.css'

// O destino é a coluna sob o cursor; só sem cursor (teclado) vale a sobreposição do card.
const detectCollisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

export interface BoardViewProps {
  readonly cycleDays?: number | null
  readonly flowError?: boolean
  readonly initialException?: BoardException | null
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
  /** Contagem e limite de WIP por coluna, já calculados pelo servidor. */
  readonly wipColumns?: readonly WipColumnDto[] | undefined
  /** Só o gestor edita o limite. */
  readonly canEditWipLimits?: boolean
  readonly onSetWipLimit?: (status: WipStatus, limit: number | null) => void
  /** Visão Equipe: cards só de leitura, sem arrastar, sem "+" nas colunas e sem editar o limite. */
  readonly readOnlyScope?: boolean
  /** Tenta carregar de novo quando a visão Equipe falha. */
  readonly onRetry?: () => void
  /** Mostra tarefas arquivadas (desligado por padrão). A consulta é feita pelo pai. */
  readonly showArchived?: boolean
  readonly onShowArchivedChange?: (show: boolean) => void
  /** Motivo para desabilitar "+" e "Nova tarefa" (ex.: projeto arquivado). */
  readonly newTaskBlockedReason?: string | undefined
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
  wipColumns = [],
  canEditWipLimits = false,
  onSetWipLimit,
  readOnlyScope = false,
  onRetry,
  showArchived = false,
  onShowArchivedChange,
  newTaskBlockedReason,
}: BoardViewProps) {
  const api = useApi()
  const capabilities = useCapabilities()
  const [exception, setException] = useState<BoardException | null>(initialException)
  const [query, setQuery] = useState('')
  // Filtro de um módulo desligado (ou sem a tela) não aparece; o valor guardado volta se ele reabrir.
  const activeException =
    exception !== null && exceptionVisible(exception, capabilities) ? exception : null
  const blockedVisible = capabilities.can('impediments:passive')
  // Filtro de sprint ativa só com a tela de Sprints (Intermediário em diante).
  const sprintFilterVisible = capabilities.can('sprints:screen')
  const flowVisible = capabilities.can('flowMetrics:screen')
  // Relógio do indicador "atualizado há N min": recalcula a cada 30 s, sem refazer a busca.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const [activeTask, setActiveTask] = useState<{
    task: TaskDto
    width: number
    anchor: AnchorPoint | null
  } | null>(null)
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

  // Responsável de cada tarefa (vem do detalhe já consultado); a busca e os cartões usam o mesmo mapa.
  const responsibleById = new Map(
    (tasks ?? []).map((task, index) => [task.id, responsibleQueries[index]?.data]),
  )

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
    return readOnlyScope ? (
      <div className={styles.error} role="alert">
        <p>{panelCopy.teamError}</p>
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            {panelCopy.retry}
          </Button>
        ) : null}
      </div>
    ) : (
      <p className={styles.error} role="alert">
        {panelCopy.boardError}
      </p>
    )

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const task = (tasks ?? []).find((item) => item.id === active.id)
    const initial = active.rect.current.initial
    if (!task) return
    // O cartão flutuante gira em torno do ponto em que foi pego (mouse), não do centro.
    const anchor = initial
      ? dragAnchorPoint(isPointerPoint(activatorEvent) ? activatorEvent : null, initial)
      : null
    setActiveTask({ task, width: initial?.width ?? 240, anchor })
  }
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    lastDroppedId.current = String(active.id)
    setActiveTask(null)
    const moved = moveTaskAfterDrop(active.id, over?.id, tasks ?? [], onMoveTask)
    const dropped = active.rect.current.translated
    const target = dropTargetStatus(over?.id, tasks ?? [])
    // O card "voa" do ponto onde foi solto até o lugar novo assim que a lista atualizar.
    pendingLanding.current =
      moved && dropped && target
        ? { id: String(active.id), left: dropped.left, top: dropped.top, status: target, tasks }
        : null
  }

  // Arquivadas ficam fora das contagens e dos filtros de exceção: são só para consulta.
  const activeTasks = (tasks ?? []).filter((task) => !isArchivedTask(task))
  const agingCount = activeTasks.filter(isAgingTask).length
  const overdueCount = activeTasks.filter((task) => task.overdue).length
  const highPriorityCount = activeTasks.filter((task) => task.priority === 'high').length
  const blockedCount = activeTasks.filter(isBlockedTask).length
  const activeSprintCount = activeTasks.filter((task) => task.sprint?.status === 'active').length
  const visibleTasks = (tasks ?? []).filter(
    (task) =>
      matchesBoardSearch(task, responsibleById.get(task.id), query) &&
      (activeException === null
        ? true
        : !isArchivedTask(task) &&
          (activeException === 'aging'
            ? isAgingTask(task)
            : activeException === 'overdue'
              ? task.overdue
              : activeException === 'high'
                ? task.priority === 'high'
                : activeException === 'blocked'
                  ? isBlockedTask(task)
                  : activeException === 'activeSprint'
                    ? task.sprint?.status === 'active'
                    : true)),
  )
  const columns = () =>
    TASK_STATUSES.map((status) => (
      <KanbanColumn
        key={status}
        cycleDays={cycleDays}
        flowError={flowError}
        selectedTaskId={selectedTaskId}
        onCreateTask={readOnlyScope ? undefined : onCreateTask}
        onOpenTask={onOpenTask}
        onMoveTask={onMoveTask}
        newTaskBlockedReason={newTaskBlockedReason}
        wip={wipColumns.find((column) => column.status === status)}
        canEditWipLimits={canEditWipLimits && !readOnlyScope}
        onSetWipLimit={onSetWipLimit}
        readOnlyScope={readOnlyScope}
        responsibleNames={responsibleById}
        status={status}
        tasks={visibleTasks.filter((task) => task.status === status)}
      />
    ))

  const noTasks = (tasks ?? []).length === 0
  return (
    <>
      <div className={styles.filters} aria-label="Filtros do quadro">
        <input
          aria-label="Buscar tarefas no quadro"
          className={styles.search}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Buscar por ID, título ou pessoa..."
          type="search"
          value={query}
        />
        {flowVisible ? (
          <button
            type="button"
            aria-pressed={activeException === 'aging'}
            onClick={() => setException(activeException === 'aging' ? null : 'aging')}
          >
            Paradas · {agingCount}
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={activeException === 'overdue'}
          onClick={() => setException(activeException === 'overdue' ? null : 'overdue')}
        >
          Vencidas · {overdueCount}
        </button>
        <button
          type="button"
          aria-pressed={activeException === 'high'}
          onClick={() => setException(activeException === 'high' ? null : 'high')}
        >
          Prioridade alta · {highPriorityCount}
        </button>
        {blockedVisible ? (
          <button
            type="button"
            aria-pressed={activeException === 'blocked'}
            onClick={() => setException(activeException === 'blocked' ? null : 'blocked')}
          >
            Bloqueadas · {blockedCount}
          </button>
        ) : null}
        {sprintFilterVisible ? (
          <button
            type="button"
            aria-pressed={activeException === 'activeSprint'}
            onClick={() => setException(activeException === 'activeSprint' ? null : 'activeSprint')}
          >
            Sprint ativa · {activeSprintCount}
          </button>
        ) : null}
        {onShowArchivedChange ? (
          <button
            type="button"
            aria-pressed={showArchived}
            onClick={() => onShowArchivedChange(!showArchived)}
          >
            {panelCopy.showArchived}
          </button>
        ) : null}
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
          title={readOnlyScope ? panelCopy.teamEmpty : 'Nenhuma tarefa ainda'}
          {...(readOnlyScope
            ? {}
            : {
                description: 'Crie a primeira tarefa para começar a acompanhar o trabalho do time.',
              })}
          action={
            !readOnlyScope && onNewTask ? (
              <AddButton
                variant="primary"
                shortcut="N"
                onClick={onNewTask}
                disabled={newTaskBlockedReason !== undefined}
                title={newTaskBlockedReason}
              >
                Nova tarefa
              </AddButton>
            ) : null
          }
        />
      )}
      {readOnlyScope ? (
        <div ref={boardRef} aria-label={panelCopy.boardLabel} className={styles.board}>
          {columns()}
        </div>
      ) : (
        <DndContext
          collisionDetection={detectCollisions}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
          sensors={sensors}
        >
          <div ref={boardRef} aria-label={panelCopy.boardLabel} className={styles.board}>
            {columns()}
          </div>
          {/*
            O card "sai" da coluna enquanto é arrastado: esta cópia flutua livre sobre o quadro.
            Vai para o body porque position: fixed só é relativo à janela fora de ancestrais com
            transform ou backdrop-filter (a janela do painel tem os dois); dentro deles o cartão
            ficava deslocado em relação ao ponteiro.
          */}
          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeTask ? (
                <div
                  className={styles.overlay}
                  style={{ width: activeTask.width, ...anchorStyle(activeTask.anchor) }}
                >
                  <TaskCard
                    onOpen={() => undefined}
                    responsibleName={undefined}
                    task={activeTask.task}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}
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
  /** Estado para onde o card foi solto; sem ele chegar, a animação não vale (ex.: conferência cancelada). */
  readonly status: TaskStatus
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
        const landed = tasks?.find((task) => task.id === id)?.status === landing.status
        if (landed && !reduced && typeof element.animate === 'function') {
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

/** Estado de destino de uma solta: a coluna sob o cursor, ou o estado do card que está sob ele. */
function dropTargetStatus(
  overId: string | number | undefined,
  tasks: readonly TaskDto[],
): TaskStatus | undefined {
  if (overId === undefined) return undefined
  const targetId = String(overId)
  if (TASK_STATUSES.includes(targetId as TaskStatus)) return targetId as TaskStatus
  return tasks.find((item) => item.id === targetId)?.status
}

export function moveTaskAfterDrop(
  activeId: string | number,
  overId: string | number | undefined,
  tasks: readonly TaskDto[],
  onMoveTask: (taskId: string, status: TaskStatus) => void,
): boolean {
  const task = tasks.find((item) => item.id === activeId)
  const status = dropTargetStatus(overId, tasks)
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
  readonly wip: WipColumnDto | undefined
  readonly canEditWipLimits: boolean
  readonly onSetWipLimit: BoardViewProps['onSetWipLimit']
  readonly readOnlyScope: boolean
  readonly newTaskBlockedReason: string | undefined
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
  wip,
  canEditWipLimits,
  onSetWipLimit,
  readOnlyScope,
  newTaskBlockedReason,
}: KanbanColumnProps) {
  const title = TASK_STATUS_LABELS[status]
  // Só Desenvolvendo e Revisar têm limite; nas outras colunas o cabeçalho segue só com a contagem.
  const acceptsWip = isWipStatus(status)
  const sortedTasks = [...tasks].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  )
  const { isOver, setNodeRef } = useDroppable({ id: status })
  const capabilities = useCapabilities()
  const wipVisible = capabilities.can('wip:screen')
  const flowVisible = capabilities.can('flowMetrics:screen')

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
        {wipVisible && acceptsWip && wip && wip.limit !== null && wip.state !== 'none' ? (
          <WipLimitMeter
            name={title}
            count={wip.count}
            limit={wip.limit}
            state={wip.state}
            title={canEditWipLimits ? undefined : panelCopy.wipLimitScopeHint}
          />
        ) : (
          <span aria-label={`${tasks.length} tarefas`}>{tasks.length}</span>
        )}
        {wipVisible &&
        isWipStatus(status) &&
        canEditWipLimits &&
        onSetWipLimit &&
        !readOnlyScope ? (
          <WipLimitEditor
            columnName={title}
            limit={wip?.limit ?? null}
            onSave={(limit) => onSetWipLimit(status, limit)}
          />
        ) : null}
        {onCreateTask && !readOnlyScope && (
          <button
            type="button"
            className={styles.addTask}
            aria-label={`Nova tarefa em ${title}`}
            disabled={newTaskBlockedReason !== undefined}
            title={newTaskBlockedReason}
            onClick={() => onCreateTask(status)}
          >
            +
          </button>
        )}
      </header>
      {readOnlyScope ? (
        <ul className={styles.cards}>
          {sortedTasks.length === 0 ? (
            <li className={styles.empty}>{panelCopy.boardColumnEmpty}</li>
          ) : (
            sortedTasks.map((task) => (
              <li
                className={`${styles.card} ${isArchivedTask(task) ? styles.cardArchived : ''}`}
                data-task-id={task.id}
                key={task.id}
              >
                <TaskCard
                  archived={isArchivedTask(task)}
                  readOnly
                  selected={selectedTaskId === task.id}
                  onOpen={() => onOpenTask(task.id)}
                  responsibleName={responsibleNames.get(task.id)}
                  task={task}
                />
              </li>
            ))
          )}
        </ul>
      ) : (
        <SortableContext
          items={sortedTasks.filter((task) => !isArchivedTask(task)).map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className={styles.cards}>
            {sortedTasks.length === 0 ? (
              <li className={styles.empty}>{panelCopy.boardColumnEmpty}</li>
            ) : (
              sortedTasks.map((task) =>
                isArchivedTask(task) ? (
                  // Arquivada: sem arrastar nem trocar de estado; abre só para leitura.
                  <li
                    className={`${styles.card} ${styles.cardArchived}`}
                    data-task-id={task.id}
                    key={task.id}
                  >
                    <TaskCard
                      archived
                      selected={selectedTaskId === task.id}
                      onOpen={() => onOpenTask(task.id)}
                      responsibleName={responsibleNames.get(task.id)}
                      task={task}
                    />
                  </li>
                ) : (
                  <SortableTaskCard key={task.id} task={task} onMoveTask={onMoveTask}>
                    <TaskCard
                      selected={selectedTaskId === task.id}
                      onOpen={() => onOpenTask(task.id)}
                      responsibleName={responsibleNames.get(task.id)}
                      task={task}
                    />
                  </SortableTaskCard>
                ),
              )
            )}
          </ul>
        </SortableContext>
      )}
      {status === 'done' && !readOnlyScope && flowVisible && (
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

type BoardException = 'aging' | 'overdue' | 'high' | 'blocked' | 'activeSprint'

/** "Paradas" depende da ferramenta de fluxo; "Bloqueadas" é efeito passivo do impedimento. */
function exceptionVisible(value: BoardException, capabilities: Capabilities): boolean {
  if (value === 'aging') return capabilities.can('flowMetrics:screen')
  if (value === 'blocked') return capabilities.can('impediments:passive')
  if (value === 'activeSprint') return capabilities.can('sprints:screen')
  return true
}

interface TaskCardProps {
  readonly selected?: boolean
  /** Arquivada: atenuada, com marcador "Arquivada" e nome acessível com o aviso. */
  readonly archived?: boolean
  /** Visão Equipe: sem comentários no cartão e nome acessível com o estado e o responsável. */
  readonly readOnly?: boolean
  readonly task: TaskDto
  readonly responsibleName: string | undefined
  readonly onOpen: () => void
}

function TaskCard({
  task,
  responsibleName,
  onOpen,
  selected = false,
  readOnly = false,
  archived = false,
}: TaskCardProps) {
  const deadline = describeDeadline(task)
  const capabilities = useCapabilities()
  const blocked = isBlockedTask(task) && capabilities.can('impediments:passive')
  // Responsável do impedimento aberto (efeito passivo): só aparece no rótulo e no title.
  const blockedOwner = blocked ? (task.impediment?.ownerName ?? null) : null
  const blockedAria = blocked
    ? `, bloqueada${blockedOwner ? `, responsável ${blockedOwner}` : ''}`
    : ''
  const showChecklist = capabilities.can('subtasks:passive')
  const { done, total } = task.checklistProgress
  const checklistLabel =
    showChecklist && total > 0 ? `, ${panelCopy.checklistProgressCount(done, total)}` : ''
  const commentLabel =
    !readOnly && task.commentCount > 0 ? `, ${panelCopy.commentCountLabel(task.commentCount)}` : ''
  // Marcadores passivos (M3.3): aparecem em qualquer nível, quando o módulo está ligado.
  const criteria = task.criteriaProgress
  const criteriaText =
    capabilities.can('acceptance:passive') && criteria && criteria.total > 0
      ? panelCopy.criteriaMarker(criteria.done, criteria.total)
      : null
  const estimateText =
    capabilities.can('estimates.hours:passive') && task.estimatedHours != null
      ? panelCopy.backlogEstimate(formatHours(Math.round(task.estimatedHours * 100)))
      : null
  // Sprint atual (M4.2): marcador passivo em qualquer nível, com o módulo ligado ou encerrando.
  const sprintText = capabilities.can('sprints:passive') ? sprintMarker(task) : null
  const passiveLabel = [criteriaText, estimateText, sprintText]
    .filter(Boolean)
    .map((text) => `, ${text}`)
    .join('')
  const ariaLabel = readOnly
    ? panelCopy.teamCardLabel(
        task.key,
        `${task.title}${task.priority === 'high' ? ', prioridade alta' : ''}${blockedAria}`,
        TASK_STATUS_LABELS[task.status],
        responsibleName ?? panelCopy.noResponsible.toLowerCase(),
      )
    : `${task.key} · ${task.title}${task.priority === 'high' ? ' · Prioridade alta' : ''}${blockedAria}${archived ? ', arquivada' : ''}${checklistLabel}${passiveLabel}${commentLabel}`

  return (
    <button
      aria-describedby={`${task.id}-project ${task.id}-meta`}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={styles.cardButton}
      onClick={onOpen}
      title={blocked ? blockedMarkerLabel(task.blockedReason, blockedOwner) : undefined}
      type="button"
    >
      <span className={styles.cardTop}>
        <TaskKey value={task.key} />
        {archived ? (
          <span className={styles.archivedMarker}>{panelCopy.archivedMarker}</span>
        ) : null}
        {task.priority === 'high' ? <SignalBadge variant="priority">Alta</SignalBadge> : null}
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
        {showChecklist ? <ChecklistProgress done={done} total={total} /> : null}
        {criteriaText ? <span className={styles.passiveMark}>{criteriaText}</span> : null}
        {estimateText ? <span className={styles.passiveMark}>{estimateText}</span> : null}
        {sprintText ? <span className={styles.passiveMark}>{sprintText}</span> : null}
        {readOnly ? null : <CommentCount count={task.commentCount} />}
        {blocked ? <SignalBadge variant="blocked">Bloqueada</SignalBadge> : null}
        {isAgingTask(task) && <SignalBadge variant="aging">parada {task.agingDays}d</SignalBadge>}
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
