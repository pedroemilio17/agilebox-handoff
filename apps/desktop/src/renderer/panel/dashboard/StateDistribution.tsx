import type { DashboardDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import styles from './Dashboard.module.css'

type Distribution = DashboardDto['distribution']

/** Os 5 estados oficiais, na ordem do fluxo, com o nome que aparece na tela. */
const STATES: readonly {
  key: keyof Distribution
  label: string
  /** Classe CSS do estado (undefined só se o módulo CSS não a exportar). */
  tone: string | undefined
}[] = [
  { key: 'planning', label: 'Planejamento', tone: styles.stateTonePlanning },
  { key: 'todo', label: 'A fazer', tone: styles.stateToneTodo },
  { key: 'in_progress', label: 'Desenvolvendo', tone: styles.stateToneInProgress },
  { key: 'review', label: 'Revisar', tone: styles.stateToneReview },
  { key: 'done', label: 'Concluído', tone: styles.stateToneDone },
]

export interface StateDistributionProps {
  readonly distribution: Distribution
}

/**
 * "Tarefas por estado": barra segmentada e legenda com a porcentagem de cada estado. O total é
 * o da organização (não muda com os filtros), como no desenho. Sem tarefas, mostra o aviso vazio.
 */
export function StateDistribution({ distribution }: StateDistributionProps) {
  const total = STATES.reduce((sum, state) => sum + distribution[state.key], 0)
  return (
    <section aria-labelledby="states-title" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="states-title" className={styles.sectionTitle}>
          {panelCopy.dashboardOverview}
        </h2>
      </div>
      {total === 0 ? (
        <p className={styles.emptyLine}>{panelCopy.dashboardEmpty}</p>
      ) : (
        <>
          <div className={styles.stateBar} aria-hidden="true">
            {STATES.map((state) => (
              <span
                key={state.key}
                className={`${styles.stateSegment} ${state.tone}`}
                style={{ width: `${distribution[state.key]}%` }}
              />
            ))}
          </div>
          <ul aria-label={panelCopy.statesBar} className={styles.stateLegend}>
            {STATES.map((state) => (
              <li key={state.key} className={styles.stateItem}>
                <span className={`${styles.stateDot} ${state.tone}`} aria-hidden="true" />
                <span>{state.label}</span>
                <strong className={styles.stateValue}>{distribution[state.key]}%</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
