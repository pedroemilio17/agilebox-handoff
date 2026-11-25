import type { DashboardDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import { dashboardCopy } from './dashboard-copy'
import styles from './Dashboard.module.css'

type Distribution = DashboardDto['distribution']

/** Os 5 estados oficiais, na ordem do fluxo, com o nome que aparece na tela. */
const STATES: readonly {
  key: keyof Distribution
  label: string
  tone: string | undefined
}[] = [
  { key: 'planning', label: 'Planejamento', tone: styles.tonePlanning },
  { key: 'todo', label: 'A fazer', tone: styles.toneTodo },
  { key: 'in_progress', label: 'Desenvolvendo', tone: styles.toneInProgress },
  { key: 'review', label: 'Revisar', tone: styles.toneReview },
  { key: 'done', label: 'Concluído', tone: styles.toneDone },
]

export interface StateDistributionProps {
  readonly distribution: Distribution
  /** Tempo de ciclo (dias) da semana: só o Concluído tem tempo; os outros estados ainda não têm dado. */
  readonly cycleDays?: number | null | undefined
}

/**
 * "Tarefas por estado": barra segmentada de 5px e uma linha por estado (ponto, mini-barra,
 * porcentagem e tempo). O total é o da organização. O contrato traz só a porcentagem de cada
 * estado, sem contagem nem tempo médio por etapa (pendência registrada).
 */
export function StateDistribution({ distribution, cycleDays }: StateDistributionProps) {
  const total = STATES.reduce((sum, state) => sum + distribution[state.key], 0)
  const max = Math.max(1, ...STATES.map((state) => distribution[state.key]))
  return (
    <section aria-labelledby="states-title">
      <div className={styles.secHead}>
        <h2 id="states-title" className={styles.secTitle}>
          {dashboardCopy.statesTitle}
        </h2>
        <span className={styles.secMeta}>{dashboardCopy.statesMeta}</span>
      </div>
      {total === 0 ? (
        <p className={styles.emptyLine}>{panelCopy.dashboardEmpty}</p>
      ) : (
        <>
          <div className={styles.stateBar} aria-hidden="true">
            {STATES.map((state) => (
              <span
                key={state.key}
                className={`${styles.stateSeg} ${state.tone ?? ''}`}
                style={{ width: `${distribution[state.key]}%` }}
              />
            ))}
          </div>
          <ul aria-label={panelCopy.statesBar} className={styles.catList}>
            {STATES.map((state) => {
              const value = distribution[state.key]
              const time =
                state.key === 'done' && cycleDays != null ? `ciclo ${compactDays(cycleDays)}` : '—'
              return (
                <li key={state.key} className={styles.catRow}>
                  <span className={styles.catName}>
                    <span
                      className={`${styles.statusDot} ${state.tone ?? ''}`}
                      aria-hidden="true"
                    />
                    {state.label}
                  </span>
                  <span className={styles.catTrack} aria-hidden="true">
                    <span className={styles.catFill} style={{ width: `${(value / max) * 100}%` }} />
                  </span>
                  <span className={styles.catNum}>{value}%</span>
                  <span className={styles.catTime}>{time}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

/** "2,1d", como no desenho. */
function compactDays(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}d`
}
