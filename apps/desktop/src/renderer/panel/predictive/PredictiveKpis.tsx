import { useTracking } from '../hooks/use-tracking'
import { costValue } from '../tracking/tracking-screen'
import { budgetUsedText, tasksProgressText } from './predictive-rules'
import styles from './PredictiveKpis.module.css'

const copy = {
  label: 'Indicadores do projeto',
  done: 'Concluído',
  cost: 'Realizado / Planejado',
  costBadge: 'Gestor',
} as const

export interface PredictiveKpisProps {
  readonly projectId: string
}

/**
 * Faixa de indicadores do topo do cronograma (protótipo `preditivo.html`). Usa o mesmo acompanhamento
 * da tela Acompanhamento (mesma consulta). O custo só existe para o gestor: sem ele, o servidor manda
 * nulo e o indicador não aparece.
 */
export function PredictiveKpis({ projectId }: PredictiveKpisProps) {
  const query = useTracking(projectId)
  const data = query.data
  if (!data) return null

  const { summary } = data
  const showCost = data.costEnabled && summary.realizedCost !== null
  const realized = summary.realizedCost ?? 0
  const planned = summary.plannedCost
  const plannedText = planned === null ? '' : ` / ${costValue(planned)}`

  return (
    <section aria-label={copy.label} className={styles.strip}>
      <div className={styles.cell}>
        <span className={styles.label}>{copy.done}</span>
        <span className={styles.value}>{summary.progress}%</span>
        <span className={styles.sub}>
          {tasksProgressText(summary.tasks.done, summary.tasks.total)}
        </span>
      </div>
      {showCost ? (
        <div className={styles.cell}>
          <span className={styles.label}>
            {copy.cost}
            <span className={styles.badge}>{copy.costBadge}</span>
          </span>
          <span className={styles.value}>
            {costValue(realized)}
            {plannedText}
          </span>
          {budgetUsedText(realized, planned) ? (
            <span className={styles.sub}>{budgetUsedText(realized, planned)}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
