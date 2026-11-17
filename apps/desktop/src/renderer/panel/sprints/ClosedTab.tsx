import { useState } from 'react'
import { sprintLabel } from '@agilebox/core'
import type { SprintDto, SprintHistoryRowDto } from '@agilebox/contract'
import { Button, EmptyState, TaskKey } from '@agilebox/ui'
import { todayDateOnly } from '../../shared/lib/today'
import { refusalMessage } from '../backlog/refusal-message'
import { shortDate, formatRange } from './DraftsTab'
import { sprintCopy } from './sprint-copy'
import { replanDates } from './sprint-rules'
import { useCreateSprint, useSprintDetail } from './use-sprints'
import styles from './SprintsView.module.css'

export interface ClosedTabProps {
  readonly projectId: string
  readonly closed: readonly SprintDto[]
  readonly windingDown: boolean
  readonly onReplanned: (draftId: string) => void
  readonly onNotify: (message: string) => void
}

/** Aba Encerradas: histórico somente leitura de cada sprint e o atalho para replanejar. */
export function ClosedTab({
  projectId,
  closed,
  windingDown,
  onReplanned,
  onNotify,
}: ClosedTabProps) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const selectedId = closed.find((sprint) => sprint.id === chosenId)?.id ?? closed[0]?.id ?? null
  const detail = useSprintDetail(selectedId)
  const create = useCreateSprint(projectId)
  const [replanError, setReplanError] = useState<string | null>(null)

  if (closed.length === 0) {
    return <EmptyState title={sprintCopy.closedEmpty} />
  }

  const sprint = detail.data?.sprint
  const history = detail.data?.history ?? []

  const replan = () => {
    if (!sprint) return
    setReplanError(null)
    create.mutate(replanDates(sprint, todayDateOnly()), {
      onSuccess: (created) => {
        onNotify(sprintCopy.replanned)
        onReplanned(created.sprint.id)
      },
      onError: (error) => setReplanError(refusalMessage(error, sprintCopy.replanError)),
    })
  }

  return (
    <div className={styles.tab}>
      <ul className={styles.draftList} aria-label={sprintCopy.closedTitle}>
        {closed.map((closedSprint) => (
          <li key={closedSprint.id}>
            <button
              type="button"
              className={styles.draftButton}
              aria-pressed={closedSprint.id === selectedId}
              aria-label={sprintCopy.draftSelect(closedSprint.label)}
              onClick={() => setChosenId(closedSprint.id)}
            >
              <span className={styles.itemTitle}>{closedSprint.name}</span>
              <span className={styles.meta}>
                {closedSprint.label} ·{' '}
                {formatRange(closedSprint.plannedStart, closedSprint.plannedEnd)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {sprint ? (
        <section className={styles.panel} aria-label={sprint.name}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{sprintLabel(sprint.number)}</p>
              <h3 className={styles.sprintName}>{sprint.name}</h3>
              {sprint.goal ? <p className={styles.goal}>{sprint.goal}</p> : null}
              <p className={styles.meta}>
                {formatRange(sprint.plannedStart, sprint.plannedEnd)}
                {sprint.closedAt ? ` · ${sprintCopy.closed} ${shortDate(sprint.closedAt)}` : ''}
              </p>
              <p className={styles.hint}>{sprintCopy.readOnly}</p>
            </div>
            {windingDown ? null : (
              <div className={styles.actions}>
                <Button type="button" onClick={replan} disabled={create.isPending}>
                  {sprintCopy.replan}
                </Button>
              </div>
            )}
          </header>
          {replanError ? (
            <p role="alert" className={styles.error}>
              {replanError}
            </p>
          ) : null}
          <p className={styles.hint}>{sprintCopy.replanHelp}</p>

          <h4 className={styles.sectionTitle}>{sprintCopy.closedHistory}</h4>
          {history.length === 0 ? (
            <p className={styles.hint}>{sprintCopy.historyEmpty}</p>
          ) : (
            <ul className={styles.list}>
              {history.map((row) => (
                <HistoryRow key={`${row.taskId}-${row.addedAt}`} row={row} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

function HistoryRow({ row }: { readonly row: SprintHistoryRowDto }) {
  return (
    <li className={styles.itemRow}>
      <div className={styles.itemText}>
        <div className={styles.itemTop}>
          <TaskKey value={row.taskKey} />
          <span className={styles.itemTitle}>{row.taskTitle}</span>
        </div>
        <div className={styles.meta}>
          <span className={styles.outcome} data-outcome={row.outcome}>
            {sprintCopy.outcome[row.outcome]}
          </span>
          <span>{sprintCopy.historyAdded(shortDate(row.addedAt))}</span>
          {row.removedAt ? (
            <span>{sprintCopy.historyRemoved(shortDate(row.removedAt))}</span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
