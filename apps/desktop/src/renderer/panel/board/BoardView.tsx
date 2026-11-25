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
import { Button, EmptyState, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities, type Capabilities } from '../../shared/capabilities/capabilities-context'
import { queryKeys } from '../../shared/query/keys'
import { formatDate } from '../../shared/lib/format-date'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { isAgingTask, isArchivedTask, isBlockedTask } from '../../shared/lib/task-signals'
import { blockedMarkerLabel } from '../impediments/impediment-copy'
import { formatTaskCount, formatUpdatedAgo } from './board-status'
import { useBoardChrome } from './board-chrome'
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
  const chrome = useBoardChrome()
  // Filtro de um módulo desligado (ou sem a tela) não aparece; o valor guardado volta se ele reabrir.
  const activeException =
    exception !== null && exceptionVisible(exception, capabilities) ? exception : null
  const blockedVisible = capabilities.can('impediments:passive')
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
  const peopleQueries = useQueries({
    queries: (tasks ?? []).map((task) => ({
      queryKey: queryKeys.tasks.detail(task.id),
      queryFn: () => api.tasks.get({ taskId: task.id }),
      select: (detail: Awaited<ReturnType<typeof api.tasks.get>>): TaskPeople => ({
        responsible: detail.participations.find(
          (participation) => participation.role === 'responsible',
        )?.participantName,
        support: detail.participations
          .filter((participation) => participation.role === 'support')
          .map((participation) => participation.participantName),
      }),
    })),
  })

  // Responsável e apoio de cada tarefa (vêm do detalhe já consultado); a busca e os cartões usam o mesmo mapa.
  const responsibleById = new Map(
    (tasks ?? []).map((task, index) => [task.id, peopleQueries[index]?.data?.responsible]),
  )
  const supportById = new Map(
    (tasks ?? []).map((task, index) => [task.id, peopleQueries[index]?.data?.support ?? []]),
  )

  const loadingBody = loading ? (
    <div
      aria-label={panelCopy.boardLoading}
      className={styles.board}
      role="status"
      aria-busy="true"
    >
      {TASK_STATUSES.map((status) => (
        <section className={styles.column} key={status}>
          <header className={styles.columnHeader}>
            <div className={styles.columnRow1}>
              <div className={styles.columnTitleWrap}>
                <span className={`${styles.statusDot} ${styles[`dot_${status}`] ?? ''}`} />
                <h2 className={styles.columnTitle}>{TASK_STATUS_LABELS[status]}</h2>
              </div>
            </div>
          </header>
          <Skeleton aria-label={panelCopy.loading} className={styles.skeletonCard} />
          <Skeleton aria-label={panelCopy.loading} className={styles.skeletonCard} />
        </section>
      ))}
    </div>
  ) : null

  const errorBody = error ? (
    readOnlyScope ? (
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
  ) : null

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
        supportNames={supportById}
        showProject={showProjectName}
        status={status}
        tasks={visibleTasks.filter((task) => task.status === status)}
      />
    ))

  const noTasks = (tasks ?? []).length === 0
  const showProjectName = chrome === null || chrome.projectName === null
  const heading = chrome ? `Quadro · ${chrome.projectName ?? panelCopy.allProjects}` : 'Quadro'
  const scopeChange = chrome?.onTaskScopeChange
  const currentScope = readOnlyScope ? 'team' : 'mine'
  // Filtros que chegam de outras telas (dashboard) e não têm pílula própria: aparecem ativos para limpar.
  const extraException =
    activeException === 'aging' ||
    activeException === 'overdue' ||
    activeException === 'activeSprint'
      ? activeException
      : null
  const pillClass = (active: boolean) => `${styles.filterPill} ${active ? styles.isActive : ''}`
  const scopeClass = (active: boolean) => `${styles.quietToggle} ${active ? styles.isActive : ''}`
  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadMain}>
          <h2 className={styles.pageTitle}>{heading}</h2>
          <p className={styles.pageSub}>Acompanhe o trabalho nos 5 estados sem atrito.</p>
        </div>
        {!readOnlyScope && onNewTask ? (
          <div className={styles.pageHeadActions}>
            <button
              type="button"
              className={styles.newTaskButton}
              disabled={newTaskBlockedReason !== undefined}
              title={newTaskBlockedReason}
              onClick={onNewTask}
            >
              + Nova tarefa
            </button>
          </div>
        ) : null}
      </header>
      <div className={styles.controls} role="region" aria-label="Controles do quadro">
        <div className={styles.controlsLeft}>
          <div className={styles.quietGroup} role="group" aria-label={panelCopy.taskScope}>
            <button
              type="button"
              className={scopeClass(currentScope === 'mine')}
              aria-pressed={currentScope === 'mine'}
              onClick={() => scopeChange?.('mine')}
            >
              {panelCopy.myTasks}
            </button>
            <button
              type="button"
              className={scopeClass(currentScope === 'team')}
              aria-pressed={currentScope === 'team'}
              onClick={() => scopeChange?.('team')}
            >
              {panelCopy.team}
            </button>
          </div>
        </div>
        <div className={styles.controlsRight}>
          <div className={styles.searchWrap}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              aria-label="Buscar tarefas no quadro"
              className={styles.searchInput}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Buscar por ID, título ou pessoa..."
              type="search"
              value={query}
            />
          </div>
          <div
            className={styles.pillGroup}
            role="group"
            aria-label="Filtrar prioridade ou bloqueio"
          >
            <button
              type="button"
              className={pillClass(activeException === null)}
              aria-pressed={activeException === null}
              onClick={() => setException(null)}
            >
              Todas
            </button>
            <button
              type="button"
              className={pillClass(activeException === 'high')}
              aria-pressed={activeException === 'high'}
              onClick={() => setException(activeException === 'high' ? null : 'high')}
            >
              Alta
            </button>
            {blockedVisible ? (
              <button
                type="button"
                className={pillClass(activeException === 'blocked')}
                aria-pressed={activeException === 'blocked'}
                onClick={() => setException(activeException === 'blocked' ? null : 'blocked')}
              >
                Bloqueadas
              </button>
            ) : null}
            {extraException ? (
              <button
                type="button"
                className={pillClass(true)}
                aria-pressed
                onClick={() => setException(null)}
              >
                {extraException === 'aging'
                  ? 'Paradas'
                  : extraException === 'overdue'
                    ? 'Vencidas'
                    : 'Sprint ativa'}
              </button>
            ) : null}
            {onShowArchivedChange ? (
              <button
                type="button"
                className={pillClass(showArchived)}
                aria-pressed={showArchived}
                onClick={() => onShowArchivedChange(!showArchived)}
              >
                {panelCopy.showArchived}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {/* Contagem e frescor dos dados: só para leitores de tela (o design não os mostra na faixa). */}
      <p className={styles.srOnly} role="status">
        {formatTaskCount(visibleTasks.length)} ·{' '}
        {refreshing
          ? 'atualizando…'
          : updatedAt === undefined
            ? '—'
            : formatUpdatedAgo(updatedAt, now)}
      </p>
      {chrome?.managerContext}
      {loadingBody ?? errorBody ?? (
        <>
          {noTasks && (
            <EmptyState
              className={styles.emptyBoard}
              title={readOnlyScope ? panelCopy.teamEmpty : 'Nenhuma tarefa ainda'}
              {...(readOnlyScope
                ? {}
                : {
                    description:
                      'Crie a primeira tarefa para começar a acompanhar o trabalho do time.',
                  })}
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
                        supportNames={[]}
                        showProject={showProjectName}
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
      )}
    </div>
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
  readonly supportNames: ReadonlyMap<string, readonly string[]>
  readonly showProject: boolean
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
  supportNames,
  showProject,
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
      <header className={styles.columnHeader}>
        <div className={styles.columnRow1}>
          <div className={styles.columnTitleWrap}>
            <span
              aria-hidden="true"
              className={`${styles.statusDot} ${styles[`dot_${status}`] ?? ''}`}
            />
            <h2 className={styles.columnTitle}>{title}</h2>
            <span className={styles.columnCount} aria-label={`${tasks.length} tarefas`}>
              {tasks.length}
            </span>
          </div>
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
        </div>
        <div className={styles.columnRow2}>
          {status === 'done' ? (
            flowVisible && !readOnlyScope ? (
              <span className={styles.tip}>
                <span className={styles.wipText} {...(flowError ? { role: 'alert' } : {})}>
                  {flowError
                    ? 'Não foi possível calcular o ciclo.'
                    : `Ciclo: ${cycleDays === null ? '—' : `${cycleDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}d`}`}
                </span>
                <ColumnHint id={`${status}-hint`} label="Explicar tempo de ciclo">
                  Tempo médio que as tarefas levam desde o início até Concluído.
                </ColumnHint>
              </span>
            ) : null
          ) : wipVisible && acceptsWip ? (
            <div className={`${styles.wipInfo} ${wip?.state === 'over' ? styles.wipOver : ''}`}>
              {wip?.state === 'over' ? (
                <span aria-hidden="true" className={`${styles.dotInline} ${styles.dotWarning}`} />
              ) : null}
              <span className={styles.tip}>
                {wip && wip.limit !== null && wip.state !== 'none' ? (
                  <span
                    className={styles.wipText}
                    role="img"
                    aria-label={`${title}: ${wip.count} de ${wip.limit}, ${WIP_STATE_TEXT[wip.state]}`}
                    title={canEditWipLimits ? undefined : panelCopy.wipLimitScopeHint}
                  >
                    {wip.count}/{wip.limit} simult.
                  </span>
                ) : (
                  <span className={styles.wipText}>Sem limite</span>
                )}
                <ColumnHint id={`${status}-hint`} label="Explicar limite simultâneo">
                  Máximo recomendado de tarefas ao mesmo tempo nesta coluna.
                </ColumnHint>
              </span>
            </div>
          ) : (
            <span />
          )}
          {wipVisible && acceptsWip && canEditWipLimits && onSetWipLimit && !readOnlyScope ? (
            <WipLimitEditor
              columnName={title}
              limit={wip?.limit ?? null}
              onSave={(limit) => onSetWipLimit(status, limit)}
            />
          ) : null}
        </div>
      </header>
      {readOnlyScope ? (
        <ul className={styles.cards}>
          {sortedTasks.length === 0 ? (
            <li className={styles.empty}>Nenhuma tarefa</li>
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
                  supportNames={supportNames.get(task.id) ?? []}
                  showProject={showProject}
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
              <li className={styles.empty}>Nenhuma tarefa</li>
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
                      supportNames={supportNames.get(task.id) ?? []}
                      showProject={showProject}
                      task={task}
                    />
                  </li>
                ) : (
                  <SortableTaskCard key={task.id} task={task} onMoveTask={onMoveTask}>
                    <TaskCard
                      selected={selectedTaskId === task.id}
                      onOpen={() => onOpenTask(task.id)}
                      responsibleName={responsibleNames.get(task.id)}
                      supportNames={supportNames.get(task.id) ?? []}
                      showProject={showProject}
                      task={task}
                    />
                  </SortableTaskCard>
                ),
              )
            )}
          </ul>
        </SortableContext>
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

interface TaskPeople {
  readonly responsible: string | undefined
  readonly support: readonly string[]
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
  readonly supportNames: readonly string[]
  /** Visão de todos os projetos: o card diz de qual projeto é (num projeto só, é redundante). */
  readonly showProject: boolean
  readonly onOpen: () => void
}

function TaskCard({
  task,
  responsibleName,
  supportNames,
  showProject,
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

  const blockedBadge = blocked ? (
    <span className={styles.blockedInline}>
      <span aria-hidden="true" className={`${styles.dotInline} ${styles.dotDanger}`} />
      Bloqueada
    </span>
  ) : null
  const urgent = deadline?.tone === 'toneSoon' || deadline?.tone === 'toneOverdue'
  const hasPeople = responsibleName !== undefined || supportNames.length > 0
  const checklistText = showChecklist && total > 0 ? `☑ ${done}/${total}` : null
  const marks = [criteriaText, estimateText, sprintText].filter(Boolean)
  const hasFoot = deadline !== null || checklistText !== null || marks.length > 0

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
        <span className={styles.taskId}>{task.key}</span>
        {showProject ? (
          <span className={styles.projectName} id={`${task.id}-project`}>
            {task.projectName}
          </span>
        ) : (
          <span hidden id={`${task.id}-project`}>
            {task.projectName}
          </span>
        )}
        <span className={styles.taskBadges}>
          {archived ? <span className={styles.tagNeutral}>{panelCopy.archivedMarker}</span> : null}
          {blockedBadge}
          {isAgingTask(task) ? (
            <span className={styles.tagNeutral}>parada {task.agingDays}d</span>
          ) : null}
          {task.priority === 'high' ? <span className={styles.tagNeutral}>Alta</span> : null}
        </span>
      </span>
      <span
        className={`${styles.taskTitle} ${task.status === 'done' ? styles.completedTitle : ''}`}
      >
        {task.title}
      </span>
      {hasPeople ? (
        <span className={styles.taskPeople}>
          {responsibleName !== undefined ? <strong>{responsibleName}</strong> : null}
          {supportNames.length > 0
            ? `${responsibleName !== undefined ? ' · ' : ''}${supportNames.join(', ')}`
            : null}
        </span>
      ) : null}
      <span className={styles.cardFoot} id={`${task.id}-meta`} hidden={!hasFoot}>
        {deadline ? (
          <time
            className={styles.dueInline}
            dateTime={task.deadline ?? undefined}
            title={deadline.full}
          >
            {urgent ? (
              <span
                aria-hidden="true"
                className={`${styles.dotInline} ${deadline.tone === 'toneOverdue' ? styles.dotDanger : styles.dotWarning}`}
              />
            ) : null}
            <span>{deadline.text}</span>
          </time>
        ) : (
          <span />
        )}
        {marks.map((text) => (
          <span key={text} className={styles.passiveMark}>
            {text}
          </span>
        ))}
        {checklistText ? <span>{checklistText}</span> : null}
      </span>
    </button>
  )
}

const WIP_STATE_TEXT = {
  ok: 'dentro do limite',
  at_limit: 'no limite',
  over: 'acima do limite',
} as const

/** Dica "?" do cabeçalho da coluna: aparece ao passar o mouse ou focar, sem abrir nada. */
function ColumnHint({
  id,
  label,
  children,
}: {
  readonly id: string
  readonly label: string
  readonly children: string
}) {
  return (
    <span className={styles.tipWrap}>
      <button type="button" className={styles.tipButton} aria-label={label} aria-describedby={id}>
        ?
      </button>
      <span id={id} role="tooltip" className={styles.tipPopover}>
        {children}
      </span>
    </span>
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
