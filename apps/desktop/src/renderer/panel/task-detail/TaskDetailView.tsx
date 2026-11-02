import { useEffect } from 'react'
import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { DateOnly, TaskStatus } from '@agilebox/core'
import { Button, IconButton, ReadOnlyBadge } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { CostCard } from './CostCard'
import { DeadlineCard } from './DeadlineCard'
import { StatusProperty, TicketProperty, TaskDescription } from './DetailsCard'
import { PropertyRow } from './PropertyRow'
import { ParticipantsCard } from './ParticipantsCard'
import { SaveError } from './SaveError'
import { TimelineCard } from './TimelineCard'
import { useBlurSave } from './use-blur-save'
import { useMoveTaskStatus, useTaskDetail, useUpdateTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

export interface TaskDetailViewProps {
  readonly fullScreen?: boolean
  readonly onToggleFullScreen?: () => void
  readonly taskId: string
  readonly onBack: () => void
  readonly today?: DateOnly
}

export function TaskDetailView({
  taskId,
  onBack,
  fullScreen = false,
  onToggleFullScreen,
  today = todayDateOnly(),
}: TaskDetailViewProps) {
  const api = useApi()
  const detail = useTaskDetail(taskId)
  const update = useUpdateTask(taskId)
  const move = useMoveTaskStatus(taskId)
  const task = detail.data
  const title = useBlurSave(task?.title ?? '', (next) => {
    if (next.trim() !== '') update.mutate({ title: next.trim() })
  })

  useEffect(() => {
    void api.tasks.recordOpen({ taskId }).catch(() => undefined)
  }, [api, taskId])

  const backButton = onToggleFullScreen ? (
    <IconButton
      key="back"
      type="button"
      aria-label={panelCopy.backToBoard}
      title="Fechar detalhe"
      onClick={onBack}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </IconButton>
  ) : (
    <Button key="back" type="button" onClick={onBack}>
      ← {panelCopy.backToBoard}
    </Button>
  )

  if (detail.isPending) {
    return (
      <section aria-label={panelCopy.taskDetail} className={styles.view}>
        <header className={styles.header}>{backButton}</header>
        <p role="status">{panelCopy.taskDetailLoading}</p>
      </section>
    )
  }
  if (detail.isError) {
    return (
      <section aria-label={panelCopy.taskDetail} className={styles.view}>
        <header className={styles.header}>{backButton}</header>
        <p role="alert">{panelCopy.taskDetailError}</p>
      </section>
    )
  }

  const readOnly = task!.readOnly

  return (
    <section aria-label={panelCopy.taskDetail} className={styles.view}>
      <header className={styles.header}>
        <span className={styles.projectLabel}>{task!.projectName}</span>
        {onToggleFullScreen && (
          <IconButton
            type="button"
            aria-label={fullScreen ? 'Voltar ao painel lateral' : 'Abrir em tela cheia'}
            onClick={onToggleFullScreen}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d={
                  fullScreen
                    ? 'M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5'
                    : 'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5'
                }
              />
            </svg>
          </IconButton>
        )}
        {backButton}
        {readOnly ? <ReadOnlyBadge /> : null}
      </header>
      <input
        aria-label={panelCopy.taskTitle}
        className={styles.title}
        disabled={readOnly}
        value={title.value}
        onChange={(event) => title.onChange(event.currentTarget.value)}
        onFocus={title.onFocus}
        onBlur={() => {
          if (title.value.trim() === '') title.onChange(task!.title)
          title.onBlur()
        }}
      />
      <SaveError error={update.error ?? move.error} />
      {(task!.agingDays ?? 0) > 4 && (
        <aside className={styles.agingAlert} aria-label="Tarefa parada">
          <p>
            Parada há {task!.agingDays} dias em {TASK_STATUS_LABELS[task!.status]}. Algo está
            travando?
          </p>
          <Button
            type="button"
            disabled={readOnly || update.isPending}
            onClick={() => update.mutate({ progressConfirmed: true })}
          >
            Segue em andamento
          </Button>
        </aside>
      )}
      <dl className={styles.properties}>
        <StatusProperty
          task={task!}
          readOnly={readOnly}
          onMove={(status: TaskStatus) => move.mutate(status)}
        />
        <PropertyRow label={panelCopy.responsible}>
          {task!.participations.find((person) => person.role === 'responsible')?.participantName ??
            panelCopy.noResponsible}
        </PropertyRow>
        <ParticipantsCard task={task!} readOnly={readOnly} />
        <DeadlineCard
          task={task!}
          readOnly={readOnly}
          today={today}
          onUpdate={(changes) => update.mutate(changes)}
        />
        <TicketProperty
          task={task!}
          readOnly={readOnly}
          onUpdate={(changes) => update.mutate(changes)}
        />
        <CostCard task={task!} readOnly={readOnly} />
      </dl>
      <TaskDescription
        task={task!}
        readOnly={readOnly}
        onUpdate={(changes) => update.mutate(changes)}
      />
      <TimelineCard taskId={taskId} />
    </section>
  )
}
