import { Button } from '@agilebox/ui'
import { trayCopy } from '../copy'
import styles from './Daily.module.css'

export interface DailyInviteCardProps {
  readonly onStart: () => void
  readonly onLater: () => void
}

/** Convite da daily na tela inicial. Não toma o foco ao aparecer e não tem animação. */
export function DailyInviteCard({ onStart, onLater }: DailyInviteCardProps) {
  return (
    <section className={styles.invite} aria-labelledby="daily-invite-title">
      <div className={styles.inviteHead}>
        <span className={styles.inviteIcon} aria-hidden="true">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 12l5 5L20 6" />
          </svg>
        </span>
        <div className={styles.inviteText}>
          <h3 id="daily-invite-title" className={styles.inviteTitle}>
            {trayCopy.dailyInviteTitle}
          </h3>
          <p className={styles.inviteBody}>{trayCopy.dailyInviteBody}</p>
        </div>
      </div>
      <div className={styles.inviteActions}>
        <Button type="button" variant="primary" onClick={onStart}>
          {trayCopy.dailyStart}
        </Button>
        <Button type="button" onClick={onLater}>
          {trayCopy.dailyLater}
        </Button>
      </div>
    </section>
  )
}
