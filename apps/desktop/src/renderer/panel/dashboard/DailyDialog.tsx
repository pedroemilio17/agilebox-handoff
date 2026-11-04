import type { ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Button, Modal, ReadOnlyBadge, TaskKey } from '@agilebox/ui'
import type { DailyEntryDto } from '@agilebox/contract'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { trayCopy } from '../../tray/copy'
import { hasDailyText } from '../../tray/daily/daily-rules'
import { panelCopy } from '../copy'
import { useNoticeOnError, type NoticeHandler } from './use-notice-on-error'
import styles from './DailyDialog.module.css'

export interface DailyDialogProps {
  readonly userId: string
  readonly userName: string
  /** Data 'AAAA-MM-DD' de hoje, no fuso local. */
  readonly date: string
  readonly onClose: () => void
  readonly onNotice?: NoticeHandler | undefined
}

/** Daily de uma pessoa em somente leitura (gestor). Foco, Esc e retorno do foco vêm do Modal. */
export function DailyDialog({ userId, userName, date, onClose, onNotice }: DailyDialogProps) {
  const api = useApi()
  const entry = useQuery({
    queryKey: queryKeys.daily.entry(userId, date),
    queryFn: () => api.daily.getForUser({ userId, date }),
  })
  const title = panelCopy.dailyDialogTitle(userName, format(parseISO(date), 'dd/MM/yyyy'))
  useNoticeOnError(entry.isError, panelCopy.dailyLoadError, onNotice)

  return (
    <Modal open title={title} onClose={onClose}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <Button onClick={onClose}>{panelCopy.dailyClose}</Button>
        </header>
        <ReadOnlyBadge />
        <DailyBody entry={entry} onRetry={() => void entry.refetch()} />
      </div>
    </Modal>
  )
}

interface DailyBodyProps {
  readonly entry: {
    readonly isPending: boolean
    readonly isError: boolean
    readonly data: DailyEntryDto | null | undefined
  }
  readonly onRetry: () => void
}

function DailyBody({ entry, onRetry }: DailyBodyProps) {
  if (entry.isPending) return <p role="status">{panelCopy.dailyLoading}</p>
  if (entry.isError)
    return (
      <div className={styles.error}>
        <p role="alert">{panelCopy.dailyLoadError}</p>
        <Button onClick={onRetry}>{panelCopy.dailyRetry}</Button>
      </div>
    )
  if (!entry.data) return <p className={styles.muted}>{panelCopy.dailyPending}</p>
  return <DailyAnswers entry={entry.data} />
}

function DailyAnswers({ entry }: { readonly entry: DailyEntryDto }) {
  const { answers } = entry
  const hasText = hasDailyText(answers)
  return (
    <div className={styles.steps}>
      {entry.noNews ? <p className={styles.noNews}>{trayCopy.dailyNoNews}</p> : null}
      {entry.noNews && !hasText ? null : (
        <>
          <Step title={trayCopy.dailyStep1Title}>
            <Field label={trayCopy.dailyProgressLabel} value={answers.progress} />
            <TaskList taskIds={entry.taskRefs} />
          </Step>
          <Step title={trayCopy.dailyStep2Title}>
            <Field label={trayCopy.dailyNextLabel} value={answers.nextStep} />
          </Step>
          <Step title={trayCopy.dailyStep3Title}>
            <Field label={trayCopy.dailyBlockerLabel} value={answers.blocker} />
          </Step>
        </>
      )}
    </div>
  )
}

function Step({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.step}>
      <h3 className={styles.stepTitle}>{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className={styles.field}>
      <h4 className={styles.label}>{label}</h4>
      <p className={value.trim() ? styles.answer : styles.muted}>
        {value.trim() ? value : trayCopy.dailySummaryNone}
      </p>
    </div>
  )
}

function TaskList({ taskIds }: { readonly taskIds: readonly string[] }) {
  const api = useApi()
  const tasks = useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: queryKeys.tasks.detail(taskId),
      queryFn: () => api.tasks.get({ taskId }),
    })),
  })
  if (taskIds.length === 0) return <p className={styles.muted}>{trayCopy.dailySummaryNoTasks}</p>
  if (tasks.some((task) => task.isPending))
    return <p role="status">{panelCopy.dailyTasksLoading}</p>
  return (
    <div className={styles.field}>
      <h4 className={styles.label}>{trayCopy.dailyTasksLabel}</h4>
      <ul className={styles.tasks}>
        {tasks.map((task, index) => (
          <li key={taskIds[index]}>
            {task.data ? (
              <>
                <TaskKey value={task.data.key} /> <span>{task.data.title}</span>
              </>
            ) : (
              <span className={styles.muted}>{panelCopy.dailyTaskUnavailable}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
