import { ProjectSwatch } from '@agilebox/ui'
import { runFeedAction } from './updates-feed'
import type { FeedActionHandlers, FeedEntry, FeedTone } from './updates-feed'
import styles from './Dashboard.module.css'

const TONE_CLASS: Record<FeedTone, string | undefined> = {
  danger: styles.toneDanger,
  warning: styles.toneWarning,
  neutral: styles.toneNeutral,
}

export interface NeedsListProps extends FeedActionHandlers {
  readonly entries: readonly FeedEntry[]
  readonly projectSwatch: (projectId: string) => number
}

/** "Precisa de você": uma linha por sinal, com o botão que leva à tela certa. */
export function NeedsList({ entries, projectSwatch, ...handlers }: NeedsListProps) {
  if (entries.length === 0)
    return <p className={styles.emptyLine}>Nenhum sinal pede decisão agora.</p>
  return (
    <ul aria-label="Precisa de você" className={styles.needList}>
      {entries.map((entry) => (
        <li className={styles.needRow} key={entry.key}>
          <span className={`${styles.needType} ${TONE_CLASS[entry.tone]}`}>
            <span className={styles.dot} />
            {entry.typeLabel}
          </span>
          <span className={styles.needProject}>
            <ProjectSwatch index={projectSwatch(entry.projectId)} name={entry.projectName} />
            {entry.projectName}
          </span>
          <span className={styles.needText}>{entry.headline}</span>
          <button
            type="button"
            className={styles.button}
            onClick={() => runFeedAction(entry.action, handlers)}
          >
            {entry.actionLabel}
          </button>
        </li>
      ))}
    </ul>
  )
}
