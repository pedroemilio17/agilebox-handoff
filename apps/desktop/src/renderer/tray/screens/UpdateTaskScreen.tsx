import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TaskStatus } from '@agilebox/core'
import {
  Button,
  FieldRow,
  GroupedList,
  ReadOnlyBadge,
  StatusChip,
  StatusMenu,
  TextArea,
} from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { useTaskDetail } from '../../panel/task-detail/use-task-detail'
import { trayCopy } from '../copy'
import styles from '../Tray.module.css'

export interface UpdateTaskScreenProps {
  readonly taskId: string
  readonly onSaved: () => void
}

export function UpdateTaskScreen({ taskId, onSaved }: UpdateTaskScreenProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const detail = useTaskDetail(taskId)
  const task = detail.data
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [status, setStatus] = useState<TaskStatus>('planning')
  const [ticket, setTicket] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    void api.tasks.recordOpen({ taskId }).catch(() => undefined)
  }, [api, taskId])

  useEffect(() => {
    if (!task || loadedId === task.id) return
    setLoadedId(task.id)
    setDescription(task.description)
    setDeadline(task.deadline ?? '')
    setStatus(task.status)
    setTicket(task.ticketId === null ? '' : String(task.ticketId))
  }, [loadedId, task])

  const save = useMutation({
    mutationFn: async () => {
      if (!task) return
      const changes: Parameters<typeof api.tasks.update>[0]['changes'] = {}
      if (description !== task.description) changes.description = description
      if (deadline !== (task.deadline ?? '')) changes.deadline = deadline === '' ? null : deadline
      if (ticket !== (task.ticketId === null ? '' : String(task.ticketId))) {
        changes.ticketId = ticket === '' ? null : Number(ticket)
        if (ticket === '') changes.ticketUrl = null
      }
      if (Object.keys(changes).length > 0) await api.tasks.update({ taskId, changes })
      if (status !== task.status) await api.tasks.move({ taskId, status })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.timeline.list(taskId) })
      onSaved()
    },
  })

  if (detail.isPending) return <p role="status">{trayCopy.loadingTask}</p>
  if (detail.isError || !task) return <p role="alert">{trayCopy.taskError}</p>

  const readOnly = task.readOnly
  const responsible = task.participations
    .filter((participation) => participation.role === 'responsible')
    .map((participation) => participation.participantName)
    .join(', ')
  const participants = task.participations
    .map((participation) => participation.participantName)
    .join(', ')

  return (
    <form
      className={styles.screenBody}
      onSubmit={(event) => {
        event.preventDefault()
        if (!readOnly) save.mutate()
      }}
    >
      <div className={styles.taskHead}>
        <h2 className={styles.taskTitle}>{task.title}</h2>
        <span className={styles.rowMeta}>{task.projectName}</span>
        {readOnly ? <ReadOnlyBadge /> : null}
      </div>
      <TextArea
        label={trayCopy.doing}
        disabled={readOnly}
        value={description}
        onChange={(event) => setDescription(event.currentTarget.value)}
      />
      <GroupedList>
        <FieldRow label={trayCopy.status}>
          <div className={styles.menuAnchor}>
            <button
              type="button"
              className={styles.statusButton}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={trayCopy.status}
              disabled={readOnly}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <StatusChip status={status} />
            </button>
            {menuOpen ? (
              <div className={styles.menuPopover}>
                <StatusMenu
                  value={status}
                  onChange={setStatus}
                  onClose={() => setMenuOpen(false)}
                />
              </div>
            ) : null}
          </div>
        </FieldRow>
        <FieldRow label={trayCopy.deadline}>
          <input
            type="date"
            aria-label={trayCopy.deadline}
            className={styles.inlineInput}
            disabled={readOnly}
            value={deadline}
            onChange={(event) => setDeadline(event.currentTarget.value)}
          />
        </FieldRow>
        <FieldRow label={trayCopy.responsible}>
          <span>{responsible || trayCopy.noResponsible}</span>
        </FieldRow>
        <FieldRow label={trayCopy.participants}>
          <span className={styles.truncate}>{participants || trayCopy.noParticipants}</span>
        </FieldRow>
        <FieldRow label={trayCopy.ticket}>
          <input
            aria-label={trayCopy.ticket}
            className={styles.inlineInput}
            inputMode="numeric"
            disabled={readOnly}
            value={ticket}
            onChange={(event) => setTicket(event.currentTarget.value.replace(/\D/g, ''))}
          />
        </FieldRow>
      </GroupedList>
      {save.isError ? <p role="alert">{trayCopy.saveError}</p> : null}
      <div className={styles.footer}>
        <Button type="submit" variant="primary" disabled={readOnly || save.isPending}>
          {trayCopy.save}
        </Button>
      </div>
    </form>
  )
}
