import { useEffect, useState } from 'react'
import type { TaskStatus } from '@agilebox/core'
import type { ProjectDto, TaskDto } from '@agilebox/contract'
import { Button, Modal } from '@agilebox/ui'
import { useCreateTask } from '../hooks/use-create-task'
import { useDefinitionOfDoneGate } from '../../shared/definition-of-done/use-definition-of-done-gate'
import { panelCopy } from '../copy'
import styles from './NewTaskDialog.module.css'

export interface NewTaskDialogProps {
  readonly initialStatus?: TaskStatus
  readonly open: boolean
  readonly projects: readonly ProjectDto[]
  readonly selectedProjectId: string | null
  readonly onClose: () => void
  readonly onCreated: (task: TaskDto) => void
}

export function NewTaskDialog({
  open,
  initialStatus,
  projects,
  selectedProjectId,
  onClose,
  onCreated,
}: NewTaskDialogProps) {
  const [projectId, setProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const createTask = useCreateTask()
  const resetCreateTask = createTask.reset
  const canCreate = Boolean(projectId && title.trim() && !createTask.isPending)
  const definitionGate = useDefinitionOfDoneGate()

  useEffect(() => {
    if (!open) return
    setProjectId(selectedProjectId ?? projects[0]?.id ?? '')
    setTitle('')
    resetCreateTask()
  }, [open, projects, resetCreateTask, selectedProjectId])

  function close() {
    setTitle('')
    createTask.reset()
    onClose()
  }

  async function submit() {
    const trimmedTitle = title.trim()
    if (!projectId || !trimmedTitle || createTask.isPending) return
    if (initialStatus === 'done') {
      // Criar já como Concluído exige a mesma conferência de concluir uma tarefa existente.
      definitionGate.conclude({
        projectId,
        definitionOfDoneCount:
          projects.find((project) => project.id === projectId)?.definitionOfDoneCount ?? 0,
        complete: async (confirmedDefinitionItemIds) => {
          const task = await createTask.mutateAsync({
            projectId,
            title: trimmedTitle,
            status: 'done',
            ...(confirmedDefinitionItemIds.length > 0
              ? { confirmedDefinitionItemIds: [...confirmedDefinitionItemIds] }
              : {}),
          })
          close()
          onCreated(task)
        },
      })
      return
    }
    try {
      const task = await createTask.mutateAsync({
        projectId,
        title: trimmedTitle,
        ...(initialStatus ? { status: initialStatus } : {}),
      })
      close()
      onCreated(task)
    } catch {
      return
    }
  }

  return (
    <>
      <Modal open={open && !definitionGate.active} title={panelCopy.newTask} onClose={close}>
        <form
          className={styles.content}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <header className={styles.header}>
            <h2>{panelCopy.newTask}</h2>
            <Button aria-label={panelCopy.close} onClick={close} type="button">
              ×
            </Button>
          </header>
          <label className={styles.field}>
            <span>{panelCopy.newTaskProject}</span>
            <select
              aria-label={panelCopy.newTaskProject}
              className={styles.input}
              disabled={projects.length === 0}
              onChange={(event) => setProjectId(event.currentTarget.value)}
              value={projectId}
            >
              {projects.length === 0 ? <option value="">{panelCopy.projects}</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{panelCopy.newTaskTitle}</span>
            <input
              aria-label={panelCopy.newTaskTitle}
              autoComplete="off"
              className={styles.input}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder={panelCopy.newTaskTitlePlaceholder}
              value={title}
            />
          </label>
          {createTask.isError ? <p role="alert">{panelCopy.createTaskError}</p> : null}
          <Button disabled={!canCreate} type="submit" variant="primary">
            {panelCopy.createTask}
          </Button>
        </form>
      </Modal>
      {definitionGate.dialog}
    </>
  )
}
