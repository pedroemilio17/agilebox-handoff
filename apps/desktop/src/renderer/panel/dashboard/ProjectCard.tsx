import { ProjectSwatch } from '@agilebox/ui'
import { swatchIndexOf } from '../../shared/lib/project-swatch'
import { HEALTH_LABELS, kpiText, METHOD_NAMES, trendPaths } from './dashboard-format'
import type { ProjectCard as ProjectCardDto } from './dashboard-format'
import styles from './Dashboard.module.css'

const HEALTH_CLASS: Record<ProjectCardDto['health'], string | undefined> = {
  ok: styles.healthOk,
  attention: styles.healthAttention,
  risk: styles.healthRisk,
}

export interface ProjectCardProps {
  readonly card: ProjectCardDto
  /** Abre o quadro do projeto ("Abrir quadro →", como no desenho). */
  readonly onOpenProject: (projectId: string, screen: 'board') => void
}

/** Cartão de um projeto, medido pela metodologia dele (indicador, gráfico, situação e motivo). */
export function ProjectCard({ card, onOpenProject }: ProjectCardProps) {
  const kpi = kpiText(card.kpi)
  const paths = card.trend ? trendPaths(card.trend) : null
  const swatch = swatchIndexOf(card.id)
  return (
    <article className={styles.projectCard} aria-label={card.name}>
      <div className={styles.projectHead}>
        <ProjectSwatch index={swatch} name={card.name} />
        <h3>{card.name}</h3>
        {card.method ? <span className={styles.tag}>{METHOD_NAMES[card.method]}</span> : null}
      </div>
      <span className={`${styles.health} ${HEALTH_CLASS[card.health]}`}>
        {HEALTH_LABELS[card.health]}
      </span>
      <div className={styles.kpi}>
        <span className={styles.kpiLabel}>{kpi.label}</span>
        <span className={styles.kpiValue}>{kpi.value}</span>
        {kpi.sub ? <span className={styles.kpiSub}>{kpi.sub}</span> : null}
      </div>
      {paths ? (
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
            style={{ stroke: `var(--color-project-${(swatch % 5) + 1})` }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      <p className={styles.why}>{card.healthReason}</p>
      <button
        type="button"
        className={styles.projectOpen}
        aria-label={`Abrir quadro de ${card.name}`}
        onClick={() => onOpenProject(card.id, 'board')}
      >
        Abrir quadro →
      </button>
    </article>
  )
}
