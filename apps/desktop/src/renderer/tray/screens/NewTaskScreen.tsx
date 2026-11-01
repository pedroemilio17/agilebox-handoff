import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, SegmentedControl, TextField } from '@agilebox/ui'
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
  const [title, setTitle] = useState('')
  const [chosenProject, setChosenProject] = useState('')
  const list = projects.data ?? []
  const projectId = chosenProject || list[0]?.id || ''
  const create = useMutation({
    mutationFn: () => api.tasks.create({ projectId, title: title.trim() }),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      onCreated(task.id)
    },
  })
  const canCreate = title.trim() !== '' && projectId !== '' && !create.isPending

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
