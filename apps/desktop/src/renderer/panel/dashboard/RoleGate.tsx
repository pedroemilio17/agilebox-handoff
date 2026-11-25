import { dashboardCopy } from './dashboard-copy'
import styles from './Dashboard.module.css'

export interface RoleGateProps {
  readonly onOpenBoard?: (() => void) | undefined
}

/** Guarda educativa do colaborador: explica por que o dashboard é do gestor e leva ao Quadro. */
export function RoleGate({ onOpenBoard }: RoleGateProps) {
  return (
    <div className={styles.roleGate} aria-live="polite">
      <span className={styles.badgeManager}>{dashboardCopy.gateBadge}</span>
      <h2>{dashboardCopy.gateTitle}</h2>
      <p>{dashboardCopy.gateText}</p>
      <ul className={styles.roleGatePoints}>
        <li>{dashboardCopy.gatePointBoard}</li>
        <li>{dashboardCopy.gatePointRate}</li>
      </ul>
      {onOpenBoard ? (
        <div className={styles.roleGateActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onOpenBoard}
          >
            {dashboardCopy.gateAction}
          </button>
        </div>
      ) : null}
    </div>
  )
}
