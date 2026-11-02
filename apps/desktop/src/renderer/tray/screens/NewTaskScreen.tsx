import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, SegmentedControl, TextField } from '@agilebox/ui'
import { parseQuickAdd } from '@agilebox/core'
import { todayDateOnly } from '../../shared/lib/today'
import { useSessionUsers } from '../../panel/hooks/use-session-users'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useProjects } from '../../panel/hooks/use-projects'
import { trayCopy } from '../copy'
import styles from '../Tray.module.css'

export interface NewTaskScreenProps {
  readonly onCreated: (taskId: string) => void
}

export function NewTaskScreen({ onCreated }: NewTaskScreenProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const projects = useProjects()
  const people = useSessionUsers()
  const [title, setTitle] = useState('')
  const [chosenProject, setChosenProject] = useState('')
  const list = projects.data ?? []
  const parsed = parseQuickAdd(title, {
    today: todayDateOnly(),
    people: people.data ?? [],
    projects: list,
  })
  const projectId = parsed.projectId || chosenProject || list[0]?.id || ''
  const create = useMutation({
    mutationFn: () =>
      api.tasks.create({
        projectId,
        title: parsed.title,
        ...(parsed.tokens.length ? { status: 'todo' as const } : {}),
        ...(parsed.responsibleId ? { responsibleId: parsed.responsibleId } : {}),
        ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
      }),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      onCreated(task.id)
    },
  })
  const canCreate = parsed.title !== '' && projectId !== '' && !create.isPending

  return (
    <form
      className={styles.screenBody}
      onSubmit={(event) => {
        event.preventDefault()
        if (canCreate) create.mutate()
      }}
    >
      <TextField
        label={trayCopy.taskTitle}
        placeholder={trayCopy.taskTitlePlaceholder}
        value={title}
        autoFocus
        autoComplete="off"
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      {parsed.tokens.length > 0 && (
        <div className={styles.quickTokens}>
          {parsed.tokens.map((token) => (
            <span key={token.start}>{token.label}</span>
          ))}
          <span>A fazer</span>
        </div>
      )}
      {list.length >= 2 && list.length <= 3 ? (
        <SegmentedControl
          aria-label={trayCopy.project}
          value={projectId}
          onChange={setChosenProject}
          options={
            list.map((project) => ({ value: project.id, label: project.name })) as [
              { value: string; label: string },
              { value: string; label: string },
              ...{ value: string; label: string }[],
            ]
          }
        />
      ) : (
        <label className={styles.selectField}>
          <span>{trayCopy.project}</span>
          <select
            aria-label={trayCopy.project}
            value={projectId}
            onChange={(event) => setChosenProject(event.currentTarget.value)}
          >
            {list.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {create.isError ? <p role="alert">{trayCopy.createError}</p> : null}
      <div className={styles.footer}>
        <Button type="submit" variant="primary" disabled={!canCreate}>
          {trayCopy.createTask}
        </Button>
      </div>
    </form>
  )
}
