import { useEffect, useState } from 'react'
import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { DateOnly, TaskStatus } from '@agilebox/core'
import { Button, IconButton, ReadOnlyBadge, TaskKey, Toast } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { isAgingTask } from '../../shared/lib/task-signals'
import { CostCard } from './CostCard'
import { DeadlineCard } from './DeadlineCard'
import { PriorityProperty, StatusProperty, TicketProperty, TaskDescription } from './DetailsCard'
import { PropertyRow } from './PropertyRow'
import { ParticipantsCard } from './ParticipantsCard'
import { SaveError } from './SaveError'
import { TimelineCard } from './TimelineCard'
import { useBlurSave } from './use-blur-save'
import { BlockControl } from './BlockControl'
import { ChecklistCard } from './ChecklistCard'
import { CommentsCard } from './CommentsCard'
import { useMoveTaskStatus, useTaskDetail, useUpdateTask } from './use-task-detail'
import { useDefinitionOfDoneGate } from '../../shared/definition-of-done/use-definition-of-done-gate'
import { isDefinitionOfDoneNotConfirmed } from '../../shared/definition-of-done/definition-of-done'
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
  const definitionGate = useDefinitionOfDoneGate()
  const task = detail.data
  const [copyNotice, setCopyNotice] = useState<{ id: number; message: string } | null>(null)
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

  // O ID é texto copiado para a área de transferência (não há link nem protocolo para ele).
  function copyTaskKey() {
    const key = task!.key
    const notify = (message: string) =>
      setCopyNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(key))
      .then(() => notify(panelCopy.taskIdCopied))
      .catch(() => notify(panelCopy.taskIdCopyError))
  }

  return (
    <section aria-label={panelCopy.taskDetail} className={styles.view}>
      <header className={styles.header}>
        <span className={styles.projectLabel}>{task!.projectName}</span>
        <TaskKey value={task!.key} />
        <IconButton
          type="button"
          aria-label={`Copiar ID ${task!.key}`}
          title="Copiar ID"
          onClick={copyTaskKey}
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
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
        </IconButton>
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
      <SaveError
        error={update.error ?? (isDefinitionOfDoneNotConfirmed(move.error) ? null : move.error)}
      />
      {copyNotice ? <Toast key={copyNotice.id} message={copyNotice.message} /> : null}
      <BlockControl task={task!} readOnly={readOnly} />
      {isAgingTask(task!) && (
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
          onMove={(status: TaskStatus) => {
            if (status === 'done' && task!.status !== 'done') {
              // Concluir pelo detalhe passa pela conferência da definição de pronto do projeto.
              definitionGate.conclude({
                projectId: task!.projectId,
                items: task!.projectDefinitionOfDone,
                definitionOfDoneCount: task!.projectDefinitionOfDone.length,
                complete: (confirmedDefinitionItemIds) =>
                  move.mutateAsync({ status, confirmedDefinitionItemIds }),
              })
              return
            }
            move.mutate({ status })
          }}
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
        <PriorityProperty
          task={task!}
          readOnly={readOnly}
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
      <ChecklistCard task={task!} readOnly={readOnly} />
      <CommentsCard task={task!} />
      <TimelineCard taskId={taskId} />
      {definitionGate.dialog}
    </section>
  )
}
