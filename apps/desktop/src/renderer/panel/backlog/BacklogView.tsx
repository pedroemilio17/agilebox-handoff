import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button, EmptyState, ProjectSwatch } from '@agilebox/ui'
import { canReorderBacklog } from '@agilebox/core'
import { ApiError, type TaskDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useActor } from '../../shared/session/useActor'
import { useUndo } from '../layout/UndoProvider'
import { useProjects } from '../hooks/use-projects'
import { NewTaskDialog } from '../board/NewTaskDialog'
import { BacklogRow } from './BacklogRow'
import { backlogCopy } from './copy'
import {
  countOtherParticipants,
  dropPlacement,
  movedHeadline,
  movedNotice,
  neighborPlacement,
  resolveInsertIndex,
  scopeNoticeFor,
  visibleBacklog,
  type MoveDirection,
  type Placement,
} from './backlog-moves'
import {
  invalidateBacklog,
  useBacklogDetails,
  useBacklogList,
  useReorderBacklog,
  useTakeToBoard,
} from './use-backlog'
import styles from './Backlog.module.css'

/** Mensagem do erro do servidor, a razão que a regra devolveu. */
function reasonOf(error: unknown): string {
  return error instanceof ApiError ? error.message : backlogCopy.actionError
}

/**
 * Tela Backlog (quadros 09 e 10): lista única do time, filtro por projeto, "Levar ao Quadro" e
 * "Nova tarefa" no fim. Só o gestor reordena (alça, Alt+↑/↓ e menu "⋯"); cada movimento tem Desfazer.
 */
export function BacklogView() {
  const api = useApi()
  const queryClient = useQueryClient()
  const { actor } = useActor()
  const canReorder = actor ? canReorderBacklog(actor, actor.organizationId) : false
  const backlog = useBacklogList()
  const projects = useProjects()
  const items: readonly TaskDto[] = backlog.data ?? []
  const details = useBacklogDetails(items.map((item) => item.id))
  const reorder = useReorderBacklog()
  const takeToBoard = useTakeToBoard()
  const { offer } = useUndo()
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  const emptyRef = useRef<HTMLDivElement>(null)
  // Foco a aplicar quando a lista nova chega: mover e levar ao quadro mudam a lista.
  const pendingFocus = useRef<(() => void) | null>(null)
  // Um movimento por vez: uma segunda tecla antes da resposta do servidor é descartada.
  const movingRef = useRef(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const visible = visibleBacklog(items, projectFilter)
  const projectList = projects.data ?? []

  useEffect(() => {
    const focus = pendingFocus.current
    if (!focus) return
    pendingFocus.current = null
    focus()
  }, [backlog.data])

  /** Alça da linha (gestor) ou botão Levar ao Quadro (colaborador, sem alça). */
  function focusRowControl(taskId: string) {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-grip-for="${taskId}"], [data-take-for="${taskId}"]`)
      ?.focus()
  }

  const titleOf = (id: UniqueIdentifier) =>
    items.find((item) => item.id === String(id))?.title ?? String(id)
  const positionOf = (id: UniqueIdentifier) => items.findIndex((item) => item.id === String(id)) + 1

  const responsibleOf = (taskId: string): string | undefined => {
    const index = items.findIndex((item) => item.id === taskId)
    const detail = details[index]?.data
    return detail?.participations.find((participation) => participation.role === 'responsible')
      ?.participantName
  }

  async function moveTask(taskId: string, placement: Placement) {
    const from = items.findIndex((item) => item.id === taskId)
    const task = items[from]
    if (!task) return
    const to = resolveInsertIndex(placement, items.length)
    if (to === from) return
    if (movingRef.current) return
    movingRef.current = true
    try {
      await runMove(taskId, placement, task, from, to)
    } finally {
      movingRef.current = false
    }
  }

  async function runMove(
    taskId: string,
    placement: Placement,
    task: TaskDto,
    from: number,
    to: number,
  ) {
    setActionError(null)
    // Quantos outros participam: só isso decide se o aviso de escopo aparece.
    let others: number
    try {
      const detail = await queryClient.ensureQueryData({
        queryKey: queryKeys.tasks.detail(taskId),
        queryFn: () => api.tasks.get({ taskId }),
      })
      others = countOtherParticipants(detail.participations, actor?.userId ?? '')
    } catch {
      others = 0
    }

    pendingFocus.current = () => focusRowControl(taskId)
    try {
      await reorder.mutateAsync({ taskId, placement })
    } catch (error) {
      pendingFocus.current = null
      setActionError(reasonOf(error))
      return
    }

    setAnnouncement(movedNotice(task.title, to, items.length))
    const scope = scopeNoticeFor(others)
    offer({
      message: (
        <>
          {movedHeadline(task.title, from, to)}
          {scope ? (
            <>
              <br />
              <span className={styles.scope}>{scope}</span>
            </>
          ) : null}
        </>
      ),
      // Toda mudança de ordem tem Desfazer: volta à posição de origem.
      undo: () => reorder.mutateAsync({ taskId, placement: from }),
    })
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLLIElement>, task: TaskDto) {
    if (!canReorder || !event.altKey || reorder.isPending) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const direction: MoveDirection = event.key === 'ArrowUp' ? 'up' : 'down'
    const placement = neighborPlacement(items, projectFilter, task.id, direction)
    if (placement === null) {
      setAnnouncement(
        direction === 'up'
          ? backlogCopy.alreadyTop(task.title)
          : backlogCopy.alreadyEnd(task.title),
      )
      return
    }
    void moveTask(task.id, placement)
  }

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over?.id
    if (overId === undefined || overId === event.active.id) return
    const placement = dropPlacement(items, String(overId))
    if (placement === null) return
    void moveTask(String(event.active.id), placement)
  }

  async function takeTask(task: TaskDto) {
    setActionError(null)
    // A linha some: o foco vai à seguinte, sem ela à anterior, e sem nenhuma ao estado vazio.
    const index = visible.findIndex((item) => item.id === task.id)
    const neighbor = visible[index + 1] ?? visible[index - 1]
    pendingFocus.current = () => {
      if (neighbor) focusRowControl(neighbor.id)
      else emptyRef.current?.focus()
    }
    try {
      await takeToBoard.mutateAsync({ taskId: task.id })
      setAnnouncement(backlogCopy.takenToBoard(task.title))
    } catch (error) {
      pendingFocus.current = null
      setActionError(reasonOf(error))
    }
  }

  const loading = backlog.isPending
  const failed = backlog.isError

  return (
    <section className={styles.view}>
      <header className={styles.header}>
        <span className={styles.hint}>
          {canReorder ? backlogCopy.managerHint : backlogCopy.collaboratorHint}
        </span>
        <span className={styles.spacer} />
        <Button onClick={() => setNewTaskOpen(true)} variant="primary">
          {backlogCopy.newTask}
        </Button>
      </header>

      <div className={styles.chips} role="group" aria-label={backlogCopy.filterLabel}>
        <button
          aria-pressed={projectFilter === null}
          className={styles.chip}
          onClick={() => setProjectFilter(null)}
          type="button"
        >
          {backlogCopy.filterAll} <span className={styles.count}>{items.length}</span>
        </button>
        {projectList.map((project, index) => (
          <button
            aria-pressed={projectFilter === project.id}
            className={styles.chip}
            key={project.id}
            onClick={() => setProjectFilter(project.id)}
            type="button"
          >
            <ProjectSwatch index={index} name={project.name} />
            {project.name}{' '}
            <span className={styles.count}>
              {items.filter((item) => item.projectId === project.id).length}
            </span>
          </button>
        ))}
      </div>

      {failed ? (
        <p className={styles.alert} role="alert">
          {backlogCopy.loadError} {reasonOf(backlog.error)}
        </p>
      ) : null}
      {actionError ? (
        <p className={styles.alert} role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? <p className={styles.muted}>{backlogCopy.loading}</p> : null}

      {!loading && !failed && visible.length === 0 ? (
        <div className={styles.emptyFocus} ref={emptyRef} tabIndex={-1}>
          {items.length === 0 ? (
            <EmptyState title={backlogCopy.emptyTitle} description={backlogCopy.emptyDescription} />
          ) : (
            <p className={styles.muted}>{backlogCopy.emptyProject}</p>
          )}
        </div>
      ) : null}

      <div className={styles.scroller}>
        <DndContext
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => backlogCopy.dragStarted(titleOf(active.id)),
              onDragOver: ({ active, over }) =>
                over
                  ? backlogCopy.dragOver(titleOf(active.id), positionOf(over.id), items.length)
                  : backlogCopy.dragNoTarget(titleOf(active.id)),
              onDragEnd: ({ active, over }) =>
                over
                  ? backlogCopy.dragEnded(titleOf(active.id), positionOf(over.id), items.length)
                  : backlogCopy.dragEndedNowhere(titleOf(active.id)),
              onDragCancel: ({ active }) => backlogCopy.dragCancelled(titleOf(active.id)),
            },
            screenReaderInstructions: { draggable: backlogCopy.dragInstructions },
          }}
          onDragEnd={onDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={visible.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul
              aria-label={backlogCopy.listLabel}
              className={styles.list}
              ref={listRef}
              role="list"
            >
              {visible.map((task) => {
                const index = items.findIndex((item) => item.id === task.id)
                return (
                  <BacklogRow
                    canReorder={canReorder}
                    index={index}
                    key={task.id}
                    menuOpen={menuTaskId === task.id}
                    onCloseMenu={() => setMenuTaskId(null)}
                    onKeyDown={(event) => onRowKeyDown(event, task)}
                    onMenuSelect={(id) => {
                      void moveTask(task.id, id)
                    }}
                    onTakeToBoard={() => void takeTask(task)}
                    onToggleMenu={() => setMenuTaskId(menuTaskId === task.id ? null : task.id)}
                    projectIndex={projectList.findIndex((project) => project.id === task.projectId)}
                    responsibleName={responsibleOf(task.id)}
                    taking={takeToBoard.isPending && takeToBoard.variables?.taskId === task.id}
                    task={task}
                    total={items.length}
                  />
                )
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      {canReorder ? (
        <footer className={styles.footer}>
          <span>{backlogCopy.footerKeys}</span>
          <span className={styles.spacer} />
          <span>{backlogCopy.footerTeam}</span>
        </footer>
      ) : null}

      <p className={styles.srOnly} role="status">
        {announcement}
      </p>

      <NewTaskDialog
        inBacklog
        onClose={() => setNewTaskOpen(false)}
        onCreated={(task) => {
          setAnnouncement(backlogCopy.createdInBacklog(task.title))
          void invalidateBacklog(queryClient)
        }}
        open={newTaskOpen}
        projects={projectList}
        selectedProjectId={projectFilter}
      />
    </section>
  )
}
