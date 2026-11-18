import { useId } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import type { BurndownViewDto, VelocitySprintDto } from '@agilebox/contract'
import { ModuleEmptyState } from '../guide/ModuleEmptyState'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { useBurndown } from '../hooks/use-burndown'
import {
  burndownCopy,
  burndownSummary,
  CHART,
  chartSeries,
  dayLabel,
  formatHours,
  headerSubtitle,
  hoursText,
  xAt,
} from './burndown-screen'
import styles from './BurndownView.module.css'

export interface BurndownViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Leva a outra tela (pelo painel de ajuda). */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Burndown e velocidade (ADR-10, módulo `burndown`): horas restantes da sprint por dia, contra a
 * linha ideal, e a velocidade das últimas sprints encerradas. Só mostra o que o servidor calcula.
 */
export function BurndownView({ projectId, projectName, onNavigate }: BurndownViewProps) {
  const query = useBurndown(projectId)

  if (projectId === null) {
    return (
      <section aria-label={burndownCopy.title} className={styles.view}>
        <EmptyState title={burndownCopy.noProject} />
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={burndownCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {burndownCopy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={burndownCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{burndownCopy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {burndownCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const view = query.data
  const subtitle = [projectName, headerSubtitle(view)].filter(Boolean).join(' · ')

  return (
    <section aria-label={burndownCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{burndownCopy.title}</h2>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
          <ModuleHelpButton
            moduleId="burndown"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
        </div>
      </header>

      {view.sprint === null ? (
        <section aria-label={burndownCopy.title} className={styles.panel}>
          <ModuleEmptyState
            moduleId="burndown"
            projectId={projectId}
            fallbackTitle={burndownCopy.noSprint}
          />
        </section>
      ) : (
        <>
          <div className={styles.cards}>
            <RemainingCard view={view} />
            <VelocityCard velocity={view.velocity} />
          </div>
          <BurndownChart view={view} />
        </>
      )}
    </section>
  )
}

function RemainingCard({ view }: { readonly view: BurndownViewDto }) {
  return (
    <section aria-label={burndownCopy.remaining} className={styles.card}>
      <p className={styles.label}>{burndownCopy.remaining}</p>
      <p className={styles.value}>{hoursText(view.remainingHours)}</p>
      <p className={styles.caption}>
        de {hoursText(view.totalHours)} estimadas · {view.doneTasks} de {view.scopeTasks} tarefas
        concluídas
      </p>
      {view.unestimatedTasks > 0 ? (
        <p className={styles.caption}>{burndownCopy.unestimated(view.unestimatedTasks)}</p>
      ) : null}
    </section>
  )
}

function VelocityCard({ velocity }: { readonly velocity: BurndownViewDto['velocity'] }) {
  const sprints = velocity.sprints
  return (
    <section aria-label={burndownCopy.velocity} className={styles.card}>
      <p className={styles.label}>{burndownCopy.velocity}</p>
      <p className={styles.value}>{hoursText(velocity.average)}</p>
      <p className={styles.caption}>
        {sprints.length === 0
          ? burndownCopy.noVelocity
          : burndownCopy.velocityCaption(sprints.length)}
      </p>
      {sprints.length > 0 ? <VelocityList sprints={sprints} /> : null}
    </section>
  )
}

function VelocityList({ sprints }: { readonly sprints: readonly VelocitySprintDto[] }) {
  const max = Math.max(1, ...sprints.map((sprint) => sprint.hours))
  return (
    <ol aria-label={burndownCopy.velocityList} className={styles.velocityList}>
      {sprints.map((sprint) => (
        <li key={sprint.sprintId} className={styles.velocityRow}>
          <span className={styles.velocityName}>Sprint {sprint.number}</span>
          <span aria-hidden="true" className={styles.velocityTrack}>
            <span
              className={styles.velocityFill}
              style={{ width: `${(sprint.hours / max) * 100}%` }}
            />
          </span>
          <span className={styles.velocityValue}>{hoursText(sprint.hours)}</span>
        </li>
      ))}
    </ol>
  )
}

function BurndownChart({ view }: { readonly view: BurndownViewDto }) {
  const titleId = useId()
  const descId = useId()
  const summary = burndownSummary(view)
  const series = chartSeries(view)
  // Rótulo de data a cada N dias, para não embolar em sprints longas.
  const every = Math.max(1, Math.ceil(view.days.length / 10))
  const todayX =
    view.days.findIndex((day) => day.date === view.today) >= 0
      ? xAt(
          view.days.findIndex((day) => day.date === view.today),
          view.days.length,
        )
      : null

  return (
    <section aria-labelledby="burndown-chart-title" className={styles.panel}>
      <h3 id="burndown-chart-title" className={styles.panelTitle}>
        {burndownCopy.chartLabel}
      </h3>
      {view.scopeTasks === 0 ? <p className={styles.muted}>{burndownCopy.noScope}</p> : null}
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={styles.svg}
      >
        <title id={titleId}>{burndownCopy.chartLabel}</title>
        <desc id={descId}>{summary}</desc>
        {series.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={CHART.left}
              x2={CHART.width - CHART.right}
              y1={tick.y}
              y2={tick.y}
              className={styles.grid}
            />
            <text x={CHART.left - 8} y={tick.y + 4} textAnchor="end" className={styles.axis}>
              {formatHours(tick.value)}
            </text>
          </g>
        ))}
        {series.labels
          .filter((_, index) => index % every === 0)
          .map((item) => (
            <text
              key={item.x}
              x={item.x}
              y={CHART.height - 12}
              textAnchor="middle"
              className={styles.axis}
            >
              {item.label}
            </text>
          ))}
        {todayX !== null ? (
          <line
            x1={todayX}
            x2={todayX}
            y1={CHART.top}
            y2={CHART.height - CHART.bottom}
            className={styles.today}
          />
        ) : null}
        <path d={series.idealPath} className={styles.ideal} fill="none" />
        <path d={series.actualPath} className={styles.actual} fill="none" />
        {series.actualPoints.map((point, index) =>
          point === null ? null : (
            <circle key={index} cx={point.x} cy={point.y} r={3} className={styles.dot} />
          ),
        )}
      </svg>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.swatchIdeal} /> {burndownCopy.idealLegend}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchActual} /> {burndownCopy.actualLegend}
        </span>
      </div>
      <p className={styles.summary}>{summary}</p>
      <details className={styles.details}>
        <summary>{burndownCopy.chartTableSummary}</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{burndownCopy.day}</th>
              <th scope="col">{burndownCopy.ideal} (h)</th>
              <th scope="col">{burndownCopy.actual} (h)</th>
            </tr>
          </thead>
          <tbody>
            {view.days.map((day) => (
              <tr key={day.date}>
                <td>{dayLabel(day.date)}</td>
                <td>{formatHours(day.idealHours)}</td>
                <td>
                  {day.remainingHours === null
                    ? burndownCopy.noValue
                    : formatHours(day.remainingHours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
