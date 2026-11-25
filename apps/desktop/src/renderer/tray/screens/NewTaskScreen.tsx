import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '@agilebox/core'
import { useActor } from '../../shared/session/useActor'
import { useSessionUsers } from '../../panel/hooks/use-session-users'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useProjects } from '../../panel/hooks/use-projects'
import { trayCopy } from '../copy'
import { BackButton, OpenPanelButton, TrayHeader } from '../TrayHeader'
import styles from '../Tray.module.css'

export interface NewTaskScreenProps {
  readonly onCreated: (taskId: string) => void
  readonly onBack: () => void
}

/** Tela "Nova tarefa" (screen-new): título, projeto, estado inicial e responsável. */
export function NewTaskScreen({ onCreated, onBack }: NewTaskScreenProps) {
  const api = useApi()
  const actor = useActor()
  const queryClient = useQueryClient()
  const projects = useProjects()
  const people = useSessionUsers()
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [chosenProject, setChosenProject] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [chosenResponsible, setChosenResponsible] = useState('')
  const projectList = projects.data ?? []
  const peopleList = people.data ?? []
  const projectId = chosenProject || projectList[0]?.id || ''
  const responsibleId =
    chosenResponsible ||
    peopleList.find((person) => person.id === actor.actor?.userId)?.id ||
    peopleList[0]?.id ||
    ''
  const create = useMutation({
    mutationFn: () =>
      api.tasks.create({
        projectId,
        title: title.trim(),
        status,
        ...(responsibleId ? { responsibleId } : {}),
      }),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      onCreated(task.id)
    },
  })

  const submit = () => {
    if (create.isPending) return
    if (title.trim() === '' || projectId === '') {
      titleRef.current?.focus()
      return
    }
    create.mutate()
  }

  return (
    <>
      <TrayHeader
        left={
          <>
            <BackButton onClick={onBack} />
            <h1 className={styles.headerTitle}>{trayCopy.newTask}</h1>
          </>
        }
        actions={<OpenPanelButton />}
      />
      <form
        className={`${styles.body} ${styles.formBody}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="tray-new-title">
            {trayCopy.newTaskPrompt}
          </label>
          <input
            ref={titleRef}
            id="tray-new-title"
            type="text"
            className={styles.input}
            placeholder={trayCopy.taskTitlePlaceholder}
            value={title}
            autoFocus
            autoComplete="off"
            required
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="tray-new-project">
            {trayCopy.project}
          </label>
          <select
            id="tray-new-project"
            className={styles.select}
            value={projectId}
            onChange={(event) => setChosenProject(event.currentTarget.value)}
          >
            {projectList.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="tray-new-status">
            {trayCopy.initialStatus}
          </label>
          <select
            id="tray-new-status"
            className={styles.select}
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as TaskStatus)}
          >
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TASK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="tray-new-assignee">
            {trayCopy.responsible}
          </label>
          <select
            id="tray-new-assignee"
            className={styles.select}
            value={responsibleId}
            onChange={(event) => setChosenResponsible(event.currentTarget.value)}
          >
            {peopleList.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
        {create.isError ? (
          <p role="alert" className={styles.errorText}>
            {trayCopy.createError}
          </p>
        ) : null}
      </form>
      <footer className={styles.fixedFooter}>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onBack}>
          {trayCopy.cancel}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={create.isPending}
          onClick={submit}
        >
          {trayCopy.createTask}
        </button>
      </footer>
    </>
  )
}
