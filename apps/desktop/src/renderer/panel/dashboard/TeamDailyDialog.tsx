import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Button, Modal } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { panelCopy } from '../copy'
import { dashboardCopy } from './dashboard-copy'
import styles from './Dashboard.module.css'

const ALL = 'all'

export interface TeamDailyDialogProps {
  /** Data 'AAAA-MM-DD' de hoje, no fuso local. */
  readonly date: string
  readonly people: readonly {
    readonly userId: string
    readonly name: string
    readonly done: boolean
  }[]
  readonly loading: boolean
  readonly onOpenTask: (taskId: string) => void
  readonly onClose: () => void
}

/**
 * "Resumo do dia · Equipe": uma linha por pessoa com "Registrou hoje" ou "Pendente", o resumo do que
 * foi feito (o que a pessoa escreveu em "o que você fez") e o link para a primeira tarefa citada.
 * Somente leitura. Foco, Esc e retorno do foco vêm do Modal.
 */
export function TeamDailyDialog({
  date,
  people,
  loading,
  onOpenTask,
  onClose,
}: TeamDailyDialogProps) {
  const api = useApi()
  const [filter, setFilter] = useState<string>(ALL)
  const entries = useQueries({
    queries: people.map((person) => ({
      queryKey: queryKeys.daily.entry(person.userId, date),
      queryFn: () => api.daily.getForUser({ userId: person.userId, date }),
      enabled: person.done,
    })),
  })
  const rows = people
    .map((person, index) => ({ person, entry: entries[index]?.data ?? null }))
    .filter(({ person }) => filter === ALL || person.userId === filter)
  return (
    <Modal open title={dashboardCopy.dailyTitle} onClose={onClose}>
      <div className={styles.dailySheet}>
        <header className={styles.dailyHead}>
          <h2 className={styles.dailyTitle}>{dashboardCopy.dailyTitle}</h2>
          <Button onClick={onClose}>{panelCopy.dailyClose}</Button>
        </header>
        <div className={styles.filterChips} role="group" aria-label={dashboardCopy.feedFilterLabel}>
          {[{ userId: ALL, name: dashboardCopy.feedAll }, ...people].map((person) => (
            <button
              key={person.userId}
              type="button"
              aria-pressed={filter === person.userId}
              className={`${styles.filterChip} ${filter === person.userId ? styles.filterChipActive : ''}`}
              onClick={() => setFilter(person.userId)}
            >
              {person.name}
            </button>
          ))}
        </div>
        {loading ? (
          <p role="status">{panelCopy.dailyLoading}</p>
        ) : rows.length === 0 ? (
          <p className={styles.emptyLine}>{dashboardCopy.dailyEmpty}</p>
        ) : (
          <ul className={styles.dailyList}>
            {rows.map(({ person, entry }) => {
              const text = !person.done
                ? dashboardCopy.dailyPendingText
                : entry === null
                  ? ''
                  : entry.answers.progress.trim() || dashboardCopy.dailyNoNews
              const taskId = entry?.taskRefs[0]
              return (
                <li className={styles.dailyRow} key={person.userId}>
                  <div>
                    <div className={styles.dailyWho}>
                      <span
                        className={`${styles.dot} ${person.done ? styles.dotOk : styles.dotWarning}`}
                        aria-hidden="true"
                      />
                      <span>{person.name}</span>
                      <span className={styles.dailyState}>
                        {person.done ? dashboardCopy.dailyDone : dashboardCopy.dailyPending}
                      </span>
                    </div>
                    {text ? <div className={styles.dailyText}>{text}</div> : null}
                  </div>
                  {taskId ? (
                    <button
                      type="button"
                      className={styles.rowActionInline}
                      aria-label={`${dashboardCopy.dailyOpenTask} de ${person.name}`}
                      onClick={() => {
                        onClose()
                        onOpenTask(taskId)
                      }}
                    >
                      {dashboardCopy.dailyOpenTask}
                      <span aria-hidden="true"> →</span>
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
