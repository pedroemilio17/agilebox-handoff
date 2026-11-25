import { swatchIndexOf } from '../../shared/lib/project-swatch'
import { dashboardCopy } from './dashboard-copy'
import { brl, HEALTH_LABELS, kpiText, METHOD_NAMES, trendPaths } from './dashboard-format'
import type { ProjectCard as ProjectCardDto } from './dashboard-format'
import styles from './Dashboard.module.css'

const HEALTH_DOT: Record<ProjectCardDto['health'], string | undefined> = {
  ok: styles.dotOk,
  attention: styles.dotWarning,
  risk: styles.dotDanger,
}

export interface ProjectCardProps {
  readonly card: ProjectCardDto
  /** Abre o quadro do projeto ("Abrir quadro →", como no desenho). */
  readonly onOpenProject: (projectId: string, screen: 'board') => void
}

/**
 * Coluna de um projeto (sem caixa): nome com quadrado de 9px e o indicador da metodologia à direita,
 * linha de apoio com a situação, barra de 4px, motivo e rodapé com custo e "Abrir quadro →".
 * Indicador, subtítulo e barra dependem da metodologia (o contrato não traz a contagem por estado).
 */
export function ProjectCard({ card, onOpenProject }: ProjectCardProps) {
  const kpi = kpiText(card.kpi)
  const paths = card.trend ? trendPaths(card.trend) : null
  const color = `var(--color-project-${(swatchIndexOf(card.id) % 5) + 1})`
  const progress =
    card.kpi.kind === 'progress' || card.kpi.kind === 'milestone' ? card.kpi.percent : null
  const sub =
    card.kpi.kind === 'progress'
      ? `${card.kpi.done} de ${card.kpi.total} tarefas concluídas`
      : kpi.label
  const cost = card.kpi.kind === 'progress' ? card.kpi.spentCost : null
  return (
    <article className={styles.projectCol} aria-label={card.name}>
      <div className={styles.projectHead}>
        <h3 className={styles.projectName}>
          <span className={styles.projDot} style={{ background: color }} aria-hidden="true" />
          <span>{card.name}</span>
        </h3>
        <span className={styles.projectPct}>{kpi.value}</span>
      </div>
      <div className={styles.projectSub}>
        <span>{card.method ? `${METHOD_NAMES[card.method]} · ${sub}` : sub}</span>
        <span className={styles.projectHealth}>
          <span className={`${styles.dot} ${HEALTH_DOT[card.health] ?? ''}`} aria-hidden="true" />
          {HEALTH_LABELS[card.health]}
        </span>
      </div>
      {progress !== null ? (
        <div className={styles.projectBar} aria-hidden="true">
          <span className={styles.toneDone} style={{ width: `${progress}%`, opacity: 0.72 }} />
        </div>
      ) : paths ? (
        <svg
          className={styles.trend}
          viewBox="0 0 260 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {paths.reference ? (
            <path
              className={styles.trendReference}
              d={paths.reference}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            className={styles.trendActual}
            d={paths.actual}
            style={{ stroke: color }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      <p className={styles.projectWhy}>{card.healthReason}</p>
      <div className={styles.projectFoot}>
        <span className={styles.projectCost}>{cost !== null ? brl(cost) : ''}</span>
        <button
          type="button"
          className={styles.rowAction}
          aria-label={`Abrir quadro de ${card.name}`}
          onClick={() => onOpenProject(card.id, 'board')}
        >
          {dashboardCopy.openBoard}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </article>
  )
}
