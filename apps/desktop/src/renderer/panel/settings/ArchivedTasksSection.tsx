import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '@agilebox/contract'
import type { TaskDto } from '@agilebox/contract'
import { Button, GlassSurface } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { useArchivedTasks } from './use-archived-tasks'
import { useUnarchiveTask } from './use-unarchive-task'
import styles from './ArchivedTasksSection.module.css'
import settingsStyles from './SettingsView.module.css'

interface ProjectGroup {
  readonly projectId: string
  readonly projectName: string
  /** Nome do `aria-label` da lista. Quando dois projetos têm o mesmo nome, ganha um número. */
  readonly label: string
  readonly tasks: TaskDto[]
}

/** Agrupa por projeto mantendo a ordem em que o servidor devolveu as tarefas. */
function groupByProject(tasks: readonly TaskDto[]): ProjectGroup[] {
  const groups = new Map<string, Omit<ProjectGroup, 'label'>>()
  for (const task of tasks) {
    const group = groups.get(task.projectId) ?? {
      projectId: task.projectId,
      projectName: task.projectName,
      tasks: [],
    }
    group.tasks.push(task)
    groups.set(task.projectId, group)
  }
  const ordered = [...groups.values()]
  const totals = new Map<string, number>()
  for (const group of ordered) {
    totals.set(group.projectName, (totals.get(group.projectName) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  return ordered.map((group) => {
    if ((totals.get(group.projectName) ?? 0) < 2) return { ...group, label: group.projectName }
    const position = (seen.get(group.projectName) ?? 0) + 1
    seen.set(group.projectName, position)
    return { ...group, label: `${group.projectName} (${position})` }
  })
}

/** Tarefa que recebe o foco depois de sair da lista; `null` quer dizer "título da seção". */
interface FocusRequest {
  readonly taskId: string | null
}

/**
 * Tarefas arquivadas (M3.0b). Sem esta lista, uma tarefa que saiu do Desfazer de 8 s ficaria sem
 * caminho de volta. Agrupa por projeto. A regra de quem vê cada tarefa é do servidor.
 *
 * Cada desarquivamento tem estado próprio: a tarefa em envio fica com `aria-disabled` e o clique
 * é bloqueado no handler (o foco não se perde). A recusa aparece em role=alert ao lado da própria
 * tarefa, e uma tarefa não afeta o erro das outras. Quando a tarefa sai da lista, o foco vai para o
 * botão do item seguinte, depois o anterior, e por fim para o título da seção.
 */
export function ArchivedTasksSection() {
  const archived = useArchivedTasks()
  const unarchive = useUnarchiveTask()
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const items = useRef(new Map<string, HTMLLIElement>())
  // Trava síncrona: dois cliques no mesmo ciclo não passam, mesmo antes de o estado atualizar.
  const inFlight = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [failures, setFailures] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)

  const tasks = archived.data ?? []
  const groups = groupByProject(tasks)
  const displayOrder = groups.flatMap((group) => group.tasks)

  useEffect(() => {
    if (focusRequest === null) return
    const button =
      focusRequest.taskId === null
        ? null
        : items.current.get(focusRequest.taskId)?.querySelector('button')
    ;(button ?? headingRef.current)?.focus()
    setFocusRequest(null)
  }, [focusRequest])

  const setPending = (taskId: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current)
      if (pending) next.add(taskId)
      else next.delete(taskId)
      return next
    })
  }

  const setFailure = (taskId: string, message: string | undefined) => {
    setFailures((current) => {
      const next = new Map(current)
      if (message === undefined) next.delete(taskId)
      else next.set(taskId, message)
      return next
    })
  }

  const unarchiveOne = async (task: TaskDto) => {
    if (inFlight.current.has(task.id)) return
    inFlight.current.add(task.id)
    setPending(task.id, true)
    setFailure(task.id, undefined)
    const index = displayOrder.findIndex((item) => item.id === task.id)
    const neighbor = displayOrder[index + 1] ?? displayOrder[index - 1] ?? null
    try {
      await unarchive.mutateAsync(task.id)
      setFocusRequest({ taskId: neighbor?.id ?? null })
    } catch (error) {
      setFailure(task.id, error instanceof ApiError ? error.message : panelCopy.unarchiveTaskError)
    } finally {
      inFlight.current.delete(task.id)
      setPending(task.id, false)
    }
  }

  return (
    <GlassSurface
      variant="group"
      className={settingsStyles.section}
      role="region"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={settingsStyles.sectionTitle}>
        {panelCopy.archivedTasks}
      </h2>
      {archived.isError ? <p role="alert">{panelCopy.archivedTasksError}</p> : null}
      {archived.isSuccess && tasks.length === 0 ? (
        <p className={settingsStyles.hint}>{panelCopy.noArchivedTasks}</p>
      ) : null}
      {groups.map((group) => (
        <div key={group.projectId} className={styles.group}>
          <h3 className={styles.projectName}>{group.projectName}</h3>
          <ul className={styles.list} aria-label={group.label}>
            {group.tasks.map((task) => {
              const pending = pendingIds.has(task.id)
              const failure = failures.get(task.id)
              return (
                <li
                  key={task.id}
                  className={styles.item}
                  ref={(element) => {
                    if (element) items.current.set(task.id, element)
                    else items.current.delete(task.id)
                  }}
                >
                  <span className={styles.title}>{task.title}</span>
                  <Button
                    type="button"
                    className={styles.action}
                    aria-disabled={pending || undefined}
                    aria-busy={pending || undefined}
                    aria-label={
                      pending
                        ? panelCopy.unarchivingTaskLabel(task.title)
                        : panelCopy.unarchiveTask(task.title)
                    }
                    onClick={() => {
                      if (pending) return
                      void unarchiveOne(task)
                    }}
                  >
                    {pending ? panelCopy.unarchivingTask : 'Desarquivar'}
                  </Button>
                  {failure !== undefined ? (
                    <p role="alert" className={styles.error}>
                      {`${task.title}: ${failure}`}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </GlassSurface>
  )
}
