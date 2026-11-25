import { dashboardCopy } from './dashboard-copy'
import { runFeedAction } from './updates-feed'
import type { FeedActionHandlers, FeedEntry, FeedTone } from './updates-feed'
import styles from './Dashboard.module.css'

const DOT_CLASS: Record<FeedTone, string | undefined> = {
  danger: styles.dotDanger,
  warning: styles.dotWarning,
  neutral: styles.dotNeutral,
}

export interface NeedsListProps extends FeedActionHandlers {
  readonly entries: readonly FeedEntry[]
}

/**
 * "Precisa de você": linhas sem caixa (ponto de 6px, título, meta e o link de ação). O link é o
 * botão que leva à tela certa e cobre a linha inteira.
 */
export function NeedsList({ entries, ...handlers }: NeedsListProps) {
  if (entries.length === 0) return <p className={styles.emptyLine}>{dashboardCopy.needsEmpty}</p>
  return (
    <ul aria-label={dashboardCopy.needsTitle} className={styles.attentionList}>
      {entries.map((entry) => (
        <li className={styles.attentionRow} key={entry.key}>
          <div className={styles.attentionMain}>
            <span className={styles.attentionTitle}>
              <span className={`${styles.dot} ${DOT_CLASS[entry.tone] ?? ''}`} aria-hidden="true" />
              {entry.headline}
            </span>
            <span className={styles.attentionMeta}>
              {entry.projectName} · {entry.typeLabel}
            </span>
          </div>
          <button
            type="button"
            className={styles.rowAction}
            onClick={() => runFeedAction(entry.action, handlers)}
          >
            {entry.actionLabel}
            <span aria-hidden="true"> →</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
