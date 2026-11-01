import { useEffect } from 'react'
import type { DateOnly, TaskStatus } from '@agilebox/core'
import { Button, ReadOnlyBadge } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { CostCard } from './CostCard'
import { DeadlineCard } from './DeadlineCard'
import { DetailsCard } from './DetailsCard'
import { ParticipantsCard } from './ParticipantsCard'
import { SaveError } from './SaveError'
import { TimelineCard } from './TimelineCard'
import { useBlurSave } from './use-blur-save'
import { useMoveTaskStatus, useTaskDetail, useUpdateTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

export interface TaskDetailViewProps {
  readonly taskId: string
  readonly onBack: () => void
  readonly today?: DateOnly
}

export function TaskDetailView({ taskId, onBack, today = todayDateOnly() }: TaskDetailViewProps) {
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

  const backButton = (
    <Button type="button" onClick={onBack}>
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
        {backButton}
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
        {readOnly ? <ReadOnlyBadge /> : null}
      </header>
      <SaveError error={update.error ?? move.error} />
      <div className={styles.columns}>
        <div className={styles.column}>
          <DetailsCard
            task={task!}
            readOnly={readOnly}
            onUpdate={(changes) => update.mutate(changes)}
            onMove={(status: TaskStatus) => move.mutate(status)}
          />
          <DeadlineCard
            task={task!}
            readOnly={readOnly}
            today={today}
            onUpdate={(changes) => update.mutate(changes)}
          />
          <CostCard task={task!} readOnly={readOnly} />
        </div>
        <div className={styles.column}>
          <ParticipantsCard task={task!} readOnly={readOnly} />
          <TimelineCard taskId={taskId} />
        </div>
      </div>
    </section>
  )
}
