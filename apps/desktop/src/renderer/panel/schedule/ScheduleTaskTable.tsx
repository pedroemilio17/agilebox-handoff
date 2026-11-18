import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ScheduleTaskDto } from '@agilebox/contract'
import { useUpdateTask } from '../task-detail/use-task-detail'
import { useSetTaskStart } from '../hooks/use-schedule'
import { queryKeys } from '../../shared/query/keys'
import { actionErrorText } from '../wbs/wbs-screen'
import styles from './ScheduleView.module.css'
import { barState, BAR_STATE_LABELS, shortDate } from './schedule-screen'

export const tableCopy = {
  section: 'Tarefas e datas',
  task: 'Tarefa',
  deliverable: 'Entrega',
  responsible: 'Responsável',
  start: 'Início',
  deadline: 'Prazo',
  situation: 'Situação',
  noDeliverable: '—',
  noResponsible: '—',
  noDates: 'sem datas',
  startAfterDeadline: 'O início não pode ser depois do prazo.',
  deadlineBeforeStart: 'O prazo não pode ser antes do início.',
  startLabel: (title: string) => `Início de ${title}`,
  deadlineLabel: (title: string) => `Prazo de ${title}`,
} as const

export interface ScheduleTaskTableProps {
  /** Tarefas na ordem de exibição, cada uma com o nome da entrega (ou nulo). */
  readonly rows: readonly {
    readonly task: ScheduleTaskDto
    readonly deliverableTitle: string | null
  }[]
  readonly today: string
}

/** Lista acessível do cronograma: as mesmas tarefas do Gantt, com as datas editáveis para quem pode. */
export function ScheduleTaskTable({ rows, today }: ScheduleTaskTableProps) {
  return (
    <section aria-label={tableCopy.section} className={styles.card}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{tableCopy.task}</th>
              <th scope="col">{tableCopy.deliverable}</th>
              <th scope="col">{tableCopy.responsible}</th>
              <th scope="col">{tableCopy.start}</th>
              <th scope="col">{tableCopy.deadline}</th>
              <th scope="col">{tableCopy.situation}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, deliverableTitle }) => (
              <ScheduleTaskRow
                key={task.taskId}
                task={task}
                deliverableTitle={deliverableTitle}
                today={today}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

interface ScheduleTaskRowProps {
  readonly task: ScheduleTaskDto
  readonly deliverableTitle: string | null
  readonly today: string
}

/**
 * Uma tarefa da lista. Início usa a mutação própria (`tasks.setStart`); o prazo usa `tasks.update`
 * (a mesma mutação do detalhe). Quem não pode editar a tarefa vê as datas em texto.
 */
function ScheduleTaskRow({ task, deliverableTitle, today }: ScheduleTaskRowProps) {
  const queryClient = useQueryClient()
  const setStart = useSetTaskStart()
  const updateTask = useUpdateTask(task.taskId)
  const [error, setError] = useState<string | null>(null)

  async function refreshSchedule() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all })
  }

  async function saveStart(next: string | null) {
    setError(null)
    if (next !== null && task.deadline !== null && next > task.deadline) {
      setError(tableCopy.startAfterDeadline)
      return
    }
    try {
      await setStart.mutateAsync({ taskId: task.taskId, startsOn: next })
    } catch (caught) {
      setError(actionErrorText(caught))
    }
  }

  async function saveDeadline(next: string | null) {
    setError(null)
    if (next !== null && task.startsOn !== null && next < task.startsOn) {
      setError(tableCopy.deadlineBeforeStart)
      return
    }
    try {
      await updateTask.mutateAsync({ deadline: next })
      await refreshSchedule()
    } catch (caught) {
      setError(actionErrorText(caught))
    }
  }

  const state = barState(task, today)

  return (
    <tr>
      <th scope="row">
        <span className={styles.key}>{task.key}</span> {task.title}
      </th>
      <td>{deliverableTitle ?? tableCopy.noDeliverable}</td>
      <td>{task.responsibleName ?? tableCopy.noResponsible}</td>
      <td>
        {task.canEdit ? (
          <input
            key={`start-${task.startsOn ?? ''}`}
            type="date"
            className={styles.input}
            aria-label={tableCopy.startLabel(task.title)}
            defaultValue={task.startsOn ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value
              if (value !== '') void saveStart(value)
            }}
            onBlur={(event) => {
              if (event.currentTarget.value === '' && task.startsOn !== null) void saveStart(null)
            }}
          />
        ) : (
          <span>{task.startsOn === null ? tableCopy.noDates : shortDate(task.startsOn)}</span>
        )}
      </td>
      <td>
        {task.canEdit ? (
          <input
            key={`deadline-${task.deadline ?? ''}`}
            type="date"
            className={styles.input}
            aria-label={tableCopy.deadlineLabel(task.title)}
            defaultValue={task.deadline ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value
              if (value !== '') void saveDeadline(value)
            }}
            onBlur={(event) => {
              if (event.currentTarget.value === '' && task.deadline !== null)
                void saveDeadline(null)
            }}
          />
        ) : (
          <span>{task.deadline === null ? tableCopy.noDates : shortDate(task.deadline)}</span>
        )}
      </td>
      <td>
        <span className={styles.status} data-state={state ?? undefined}>
          {state === null ? tableCopy.noDates : BAR_STATE_LABELS[state]}
        </span>
        {error ? (
          <p role="alert" className={styles.errorText}>
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  )
}
