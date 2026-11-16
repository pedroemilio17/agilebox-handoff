import { useId } from 'react'
import type { GetTaskDto } from '@agilebox/contract'
import { formatDate } from '../../shared/lib/format-date'
import { impedimentCopy } from '../impediments/impediment-copy'
import styles from './TaskDetailView.module.css'

export interface ImpedimentHistoryCardProps {
  readonly task: GetTaskDto
}

/**
 * Histórico de impedimentos da tarefa: abertos e resolvidos, com responsável, datas e nota. Só
 * aparece com a tela de impedimentos; quem chama decide.
 */
export function ImpedimentHistoryCard({ task }: ImpedimentHistoryCardProps) {
  const headingId = useId()
  const history = task.impedimentHistory ?? []
  return (
    <section aria-labelledby={headingId} className={styles.card}>
      <header className={styles.checklistHeader}>
        <h3 id={headingId} className={styles.cardTitle}>
          {impedimentCopy.historyTitle}
        </h3>
      </header>
      {history.length === 0 ? (
        <p className={styles.historyMeta}>{impedimentCopy.historyEmpty}</p>
      ) : (
        <ol className={styles.historyList}>
          {history.map((item) => (
            <li key={item.id} className={styles.historyItem}>
              <span>
                {item.reason}
                {item.status === 'open'
                  ? ` · ${impedimentCopy.open}`
                  : ` · ${impedimentCopy.resolved}`}
              </span>
              <span className={styles.historyMeta}>
                {item.ownerName ?? impedimentCopy.noOwner} ·{' '}
                {impedimentCopy.historyOpened(formatDate(new Date(item.openedAt)))}
                {item.resolvedAt
                  ? ` · ${impedimentCopy.historyResolved(formatDate(new Date(item.resolvedAt)))}`
                  : ''}
              </span>
              {item.resolution ? (
                <span className={styles.historyMeta}>
                  {impedimentCopy.resolutionNote(item.resolution)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
