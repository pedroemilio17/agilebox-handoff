import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatHours } from '@agilebox/core'
import type { ProjectDto, TaskDto } from '@agilebox/contract'
import { Button, Drawer, EmptyState, IconButton, TaskKey, TextField, Toast } from '@agilebox/ui'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { useDefinitionOfDoneGate } from '../../shared/definition-of-done/use-definition-of-done-gate'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { TaskDetailView } from '../task-detail/TaskDetailView'
import { moveRequest, type BacklogMove } from './backlog-order'
import { refusalMessage } from './refusal-message'
import {
  useAddToBacklog,
  useBacklogList,
  useBacklogProjects,
  usePullFromBacklog,
  useReorderBacklog,
} from './use-backlog'
import styles from './BacklogView.module.css'

type PullStatus = 'todo' | 'in_progress' | 'review' | 'done'

const PULL_STATUS_OPTIONS: readonly { value: PullStatus; label: string }[] = [
  { value: 'todo', label: 'A fazer' },
  { value: 'in_progress', label: 'Desenvolvendo' },
  { value: 'review', label: 'Revisar' },
  { value: 'done', label: 'Concluído' },
]

export interface BacklogViewProps {
  /** Projeto que já estava selecionado no painel, se houver. */
  readonly initialProjectId?: string | null
  /** Projetos ativos (arquivados ficam de fora, como na criação de tarefa). */
  readonly projects: readonly ProjectDto[]
  readonly isManager: boolean
}

export function BacklogView({ initialProjectId = null, projects, isManager }: BacklogViewProps) {
  const capabilities = useCapabilities()
  const actor = useActor()
  const visible = useBacklogProjects(projects, isManager, actor.actor?.userId)
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(initialProjectId)
  // Escolha que não está mais na lista (projeto saiu ou não é mais visível) cai no primeiro.
  const projectId =
    visible.projects.find((project) => project.id === chosenProjectId)?.id ??
    visible.projects[0]?.id ??
    null
  const selectId = useId()
  const list = useBacklogList(projectId)
  const add = useAddToBacklog(projectId ?? '')
  const reorder = useReorderBacklog(projectId ?? '')
  const pull = usePullFromBacklog()
  const definitionGate = useDefinitionOfDoneGate()
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [pullStatus, setPullStatus] = useState<Record<string, PullStatus>>({})
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const noticeSeq = useRef(0)
  const dragFrom = useRef<number | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // Depois de mover pelo teclado, o foco volta ao botão do mesmo item (o React move o nó e o perde).
  const focusAfterMove = useRef<{ taskId: string; direction: 'up' | 'down' } | null>(null)
  const addFieldId = useId()

  useEffect(() => {
    const pending = focusAfterMove.current
    if (!pending) return
    focusAfterMove.current = null
    const opposite = pending.direction === 'up' ? 'down' : 'up'
    const button =
      listRef.current?.querySelector<HTMLButtonElement>(
        `[data-task-id="${pending.taskId}"][data-move="${pending.direction}"]:not([disabled])`,
      ) ??
      listRef.current?.querySelector<HTMLButtonElement>(
        `[data-task-id="${pending.taskId}"][data-move="${opposite}"]:not([disabled])`,
      )
    button?.focus()
  }, [list.data])

  const showNotice = (message: string) => {
    noticeSeq.current += 1
    setNotice({ id: noticeSeq.current, message })
  }

  // Encerrando, o backlog não aceita item novo: a criação some, mas os itens seguem editáveis.
  const creatingBlocked = capabilities.isWindingDown('backlog')
  const showEstimate = capabilities.showScreen('estimates.hours')
  const showCriteria = capabilities.showScreen('acceptance')
  const items = list.data ?? []
  const openTask = items.find((task) => task.id === openTaskId)

  const submitAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = draft.trim()
    if (title === '') {
      setAddError(panelCopy.backlogTitleRequired)
      return
    }
    setAddError(null)
    add.mutate(title, {
      onSuccess: () => setDraft(''),
      onError: (error) => showNotice(refusalMessage(error, panelCopy.backlogAddError)),
    })
  }

  const move = (from: number, to: number) => {
    const current = list.data
    if (!current || projectId === null) return
    const request: BacklogMove | null = moveRequest(current, from, to)
    if (!request) return
    const task = current[from]!
    setAnnouncement(panelCopy.backlogMoved(task.title, to + 1, current.length))
    focusAfterMove.current = { taskId: task.id, direction: to < from ? 'up' : 'down' }
    reorder.mutate(
      { move: request, from, to },
      { onError: () => showNotice(panelCopy.backlogMoveError) },
    )
  }

  const pullTask = (task: TaskDto) => {
    const status = pullStatus[task.id] ?? 'todo'
    const done = () => showNotice(panelCopy.backlogPulled(task.title))
    const failed = (error: unknown) => showNotice(refusalMessage(error, panelCopy.backlogPullError))
    if (status === 'done') {
      // Concluir passa pela conferência da definição de pronto, como no quadro.
      definitionGate.conclude({
        projectId: task.projectId,
        definitionOfDoneCount:
          projects.find((project) => project.id === task.projectId)?.definitionOfDoneCount ?? 0,
        complete: (confirmedDefinitionItemIds) =>
          pull
            .mutateAsync({ taskId: task.id, status, confirmedDefinitionItemIds })
            .then(done, failed),
      })
      return
    }
    pull.mutate({ taskId: task.id, status }, { onSuccess: done, onError: failed })
  }

  return (
    <section aria-label={panelCopy.backlogTitle} className={styles.view}>
      <div className={styles.toolbar}>
        <label className={styles.projectField} htmlFor={selectId}>
          <span className={styles.label}>{panelCopy.backlogProject}</span>
          <select
            id={selectId}
            className={styles.select}
            value={projectId ?? ''}
            disabled={visible.projects.length === 0}
            onChange={(event) => setChosenProjectId(event.currentTarget.value)}
          >
            {visible.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {projectId === null ? (
        visible.pending ? (
          <p role="status" className={styles.helper}>
            {panelCopy.backlogLoading}
          </p>
        ) : (
          <EmptyState title={panelCopy.backlogNoProjects} />
        )
      ) : (
        <>
          {creatingBlocked ? (
            <p className={styles.helper}>{panelCopy.backlogWindingDown}</p>
          ) : (
            <form className={styles.addForm} noValidate onSubmit={submitAdd}>
              <TextField
                id={addFieldId}
                label={panelCopy.backlogAddLabel}
                value={draft}
                aria-invalid={addError !== null}
                aria-describedby={addError ? `${addFieldId}-error` : `${addFieldId}-hint`}
                disabled={add.isPending}
                onChange={(event) => {
                  setDraft(event.currentTarget.value)
                  if (addError) setAddError(null)
                }}
              />
              <p id={`${addFieldId}-hint`} className={styles.hint}>
                {panelCopy.backlogAddHint}
              </p>
              {addError ? (
                <p id={`${addFieldId}-error`} role="alert" className={styles.error}>
                  {addError}
                </p>
              ) : null}
            </form>
          )}

          <p className={styles.srOnly} role="status" aria-live="polite">
            {announcement}
          </p>

          {list.isPending ? (
            <p role="status" className={styles.helper}>
              {panelCopy.backlogLoading}
            </p>
          ) : list.isError ? (
            <div role="alert" className={styles.errorBox}>
              <p>{panelCopy.backlogError}</p>
              <Button type="button" onClick={() => void list.refetch()}>
                {panelCopy.backlogRetry}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState title={panelCopy.backlogEmpty} description={panelCopy.backlogEmptyHint} />
          ) : (
            <ol ref={listRef} aria-label={panelCopy.backlogList} className={styles.list}>
              {items.map((task, index) => (
                <li
                  key={task.id}
                  className={styles.row}
                  draggable
                  onDragStart={(event) => {
                    dragFrom.current = index
                    event.dataTransfer?.setData('text/plain', task.id)
                  }}
                  onDragOver={(event) => {
                    if (dragFrom.current !== null) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const from = dragFrom.current
                    dragFrom.current = null
                    if (from !== null) move(from, index)
                  }}
                  onDragEnd={() => {
                    dragFrom.current = null
                  }}
                >
                  <span className={styles.position} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className={styles.main}>
                    <div className={styles.top}>
                      <TaskKey value={task.key} />
                      <button
                        type="button"
                        className={styles.titleButton}
                        aria-label={panelCopy.backlogOpen(task.title)}
                        onClick={() => setOpenTaskId(task.id)}
                      >
                        {task.title}
                      </button>
                    </div>
                    <div className={styles.meta}>
                      <span>
                        {task.priority === 'high'
                          ? panelCopy.backlogPriorityHigh
                          : panelCopy.backlogPriorityNormal}
                      </span>
                      {showEstimate && task.estimatedHours != null ? (
                        <span>
                          {panelCopy.backlogEstimate(
                            formatHours(Math.round(task.estimatedHours * 100)),
                          )}
                        </span>
                      ) : null}
                      {showCriteria && task.criteriaProgress && task.criteriaProgress.total > 0 ? (
                        <span>
                          {panelCopy.criteriaMarker(
                            task.criteriaProgress.done,
                            task.criteriaProgress.total,
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <IconButton
                      type="button"
                      data-task-id={task.id}
                      data-move="up"
                      aria-label={panelCopy.backlogMoveUp(task.title)}
                      title="Subir"
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, index - 1)}
                    >
                      <span aria-hidden="true">↑</span>
                    </IconButton>
                    <IconButton
                      type="button"
                      data-task-id={task.id}
                      data-move="down"
                      aria-label={panelCopy.backlogMoveDown(task.title)}
                      title="Descer"
                      disabled={index === items.length - 1 || reorder.isPending}
                      onClick={() => move(index, index + 1)}
                    >
                      <span aria-hidden="true">↓</span>
                    </IconButton>
                    <select
                      aria-label={panelCopy.backlogPullState(task.title)}
                      className={styles.select}
                      value={pullStatus[task.id] ?? 'todo'}
                      onChange={(event) =>
                        setPullStatus((current) => ({
                          ...current,
                          [task.id]: event.currentTarget.value as PullStatus,
                        }))
                      }
                    >
                      {PULL_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      aria-label={panelCopy.backlogPull(task.title)}
                      disabled={pull.isPending}
                      onClick={() => pullTask(task)}
                    >
                      Puxar
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <Drawer
        open={openTaskId !== null}
        title={openTask?.title ?? panelCopy.taskDetail}
        onClose={() => setOpenTaskId(null)}
      >
        {openTaskId ? (
          <TaskDetailView key={openTaskId} taskId={openTaskId} onBack={() => setOpenTaskId(null)} />
        ) : null}
      </Drawer>
      {definitionGate.dialog}
      {notice ? <Toast key={notice.id} message={notice.message} /> : null}
    </section>
  )
}
