import { useState } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { dashboardCopy } from './dashboard-copy'
import type { DashboardInsights } from './dashboard-format'
import styles from './Dashboard.module.css'

type Update = DashboardInsights['updates'][number]
type Person = DashboardInsights['team'][number]['user']

const ALL = 'all'

/** "Hoje, 10:15", "Ontem, 17:45" ou "03/11, 16:30". */
export function whenLabel(at: string): string {
  const date = parseISO(at)
  const time = format(date, 'HH:mm')
  if (isToday(date)) return `Hoje, ${time}`
  if (isYesterday(date)) return `Ontem, ${time}`
  return `${format(date, 'dd/MM')}, ${time}`
}

export interface UpdatesTabProps {
  readonly updates: readonly Update[]
  readonly people: readonly Person[]
  readonly onOpenTask: (taskId: string) => void
  /** Tela completa de atualizações, com filtros por tipo, projeto e visão. */
  readonly onOpenAdvanced?: (() => void) | undefined
}

/**
 * Aba "Atualizações": feed da equipe nos últimos sete dias, com chips por pessoa. Edições do
 * gestor levam o selo Gestor. Largura máxima de 820px, como no desenho.
 */
export function UpdatesTab({ updates, people, onOpenTask, onOpenAdvanced }: UpdatesTabProps) {
  const [personId, setPersonId] = useState<string>(ALL)
  const items = updates.filter((update) => personId === ALL || update.actorUserId === personId)
  return (
    <div>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle}>{dashboardCopy.feedTitle}</h2>
        <span className={styles.secMeta}>
          {onOpenAdvanced ? (
            <button type="button" className={styles.rowActionInline} onClick={onOpenAdvanced}>
              {dashboardCopy.feedAdvanced}
              <span aria-hidden="true"> →</span>
            </button>
          ) : null}{' '}
          {dashboardCopy.feedCount(items.length)}
        </span>
      </div>
      <div className={styles.feedWrap}>
        <div className={styles.filterChips} role="group" aria-label={dashboardCopy.feedFilterLabel}>
          {[{ id: ALL, name: dashboardCopy.feedAll }, ...people].map((person) => (
            <button
              key={person.id}
              type="button"
              aria-pressed={personId === person.id}
              className={`${styles.filterChip} ${personId === person.id ? styles.filterChipActive : ''}`}
              onClick={() => setPersonId(person.id)}
            >
              {person.name}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <p className={styles.emptyLine}>{dashboardCopy.feedEmpty}</p>
        ) : (
          <ul className={styles.feedList} aria-label={dashboardCopy.feedTitle}>
            {items.map((update) => (
              <li className={styles.feedRow} key={update.id}>
                <div className={styles.feedMain}>
                  <div className={styles.feedHead}>
                    <strong>{update.actorName}</strong>
                    {update.asManager ? <span className={styles.badgeManager}>Gestor</span> : null}
                    <span>{update.text}</span>
                    <span className={styles.feedTime}>{whenLabel(update.at)}</span>
                  </div>
                  <p className={styles.feedDetail}>
                    {update.taskTitle} · {update.projectName}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.rowActionInline}
                  aria-label={`${dashboardCopy.feedOpen} ${update.taskTitle}`}
                  onClick={() => onOpenTask(update.taskId)}
                >
                  {dashboardCopy.feedOpen}
                  <span aria-hidden="true"> →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
