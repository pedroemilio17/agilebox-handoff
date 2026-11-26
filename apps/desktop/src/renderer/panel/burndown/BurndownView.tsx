import { useId } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import type { BurndownViewDto, VelocitySprintDto } from '@agilebox/contract'
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
  VELOCITY_CHART,
  velocityBars,
  xAt,
  yAt,
} from './burndown-screen'
import styles from './BurndownView.module.css'

export interface BurndownViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  /** Leva a outra tela (pelo painel de ajuda). */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Burndown e velocidade (ADR-10, módulo `burndown`): horas restantes da sprint por dia, contra a
 * linha ideal, e a velocidade das últimas sprints encerradas. Só mostra o que o servidor calcula.
 */
export function BurndownView({ projectId }: BurndownViewProps) {
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
  const subtitle = headerSubtitle(view)

  return (
    <section aria-label={burndownCopy.title} className={styles.view}>
      <header className={styles.header}>
        <h2 className={styles.title}>{burndownCopy.title}</h2>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </header>

      {view.sprint === null ? (
        <section aria-label={burndownCopy.title} className={styles.panel}>
          <EmptyState title={burndownCopy.noSprint} />
        </section>
      ) : (
        <>
          <div className={styles.cards}>
            <RemainingCard view={view} />
          </div>
          <div className={styles.grid}>
            <BurndownChart view={view} />
            <VelocityPanel velocity={view.velocity} />
          </div>
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
        {burndownCopy.committedCaption(hoursText(view.totalHours))} · {view.doneTasks} de{' '}
        {view.scopeTasks} tarefas concluídas
      </p>
      {view.unestimatedTasks > 0 ? (
        <p className={styles.caption}>{burndownCopy.unestimated(view.unestimatedTasks)}</p>
      ) : null}
    </section>
  )
}

function VelocityPanel({ velocity }: { readonly velocity: BurndownViewDto['velocity'] }) {
  const sprints = velocity.sprints
  return (
    <section aria-labelledby="burndown-velocity-title" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 id="burndown-velocity-title" className={styles.panelTitle}>
          {burndownCopy.velocity}
        </h3>
        {velocity.average === null ? null : (
          <span className={styles.average}>
            {burndownCopy.averageLabel(hoursText(velocity.average))}
          </span>
        )}
      </div>
      {sprints.length === 0 ? (
        <p className={styles.muted}>{burndownCopy.noVelocity}</p>
      ) : (
        <VelocityChart sprints={sprints} average={velocity.average} />
      )}
    </section>
  )
}

function VelocityChart({
  sprints,
  average,
}: {
  readonly sprints: readonly VelocitySprintDto[]
  readonly average: number | null
}) {
  const titleId = useId()
  const { bars, averageY } = velocityBars(sprints, average)
  const summary = sprints
    .map((sprint) => `Sprint ${sprint.number}: ${hoursText(sprint.hours)}`)
    .join('; ')

  return (
    <>
      <svg
        viewBox={`0 0 ${VELOCITY_CHART.width} ${VELOCITY_CHART.height}`}
        role="img"
        aria-labelledby={titleId}
        className={styles.svg}
      >
        <title id={titleId}>
          {burndownCopy.velocityChartLabel}. {summary}.
        </title>
        {averageY === null ? null : (
          <line
            x1={0}
            x2={VELOCITY_CHART.width}
            y1={averageY}
            y2={averageY}
            className={styles.averageLine}
          />
        )}
        {bars.map((bar) => (
          <g key={bar.name}>
            <rect
              x={bar.x}
              y={bar.y}
              width={VELOCITY_CHART.barWidth}
              height={bar.height}
              rx={4}
              className={styles.velocityBar}
            />
            <text x={bar.centerX} y={bar.labelY} textAnchor="middle" className={styles.valueText}>
              {bar.value}
            </text>
            <text
              x={bar.centerX}
              y={VELOCITY_CHART.height - 8}
              textAnchor="middle"
              className={styles.axis}
            >
              {bar.name}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatchDone} /> {burndownCopy.doneLegend}
        </span>
      </div>
      <details className={styles.details}>
        <summary>{burndownCopy.velocityTableSummary}</summary>
        <ol className={styles.velocityList}>
          {sprints.map((sprint) => (
            <li key={sprint.sprintId} className={styles.velocityRow}>
              <span>Sprint {sprint.number}</span>
              <span>{hoursText(sprint.hours)}</span>
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}

function BurndownChart({ view }: { readonly view: BurndownViewDto }) {
  const titleId = useId()
  const descId = useId()
  const summary = burndownSummary(view)
  const series = chartSeries(view)
  const count = view.days.length
  // Rótulo de data a cada N dias, para não embolar em sprints longas.
  const every = Math.max(1, Math.ceil(count / 10))
  const todayIndex = view.days.findIndex((day) => day.date === view.today)
  const today = todayIndex >= 0 ? view.days[todayIndex] : undefined
  const todayPoint =
    today && today.remainingHours !== null
      ? {
          x: xAt(todayIndex, count),
          y: yAt(today.remainingHours, series.max),
          label: `${burndownCopy.todayLabel} · ${hoursText(today.remainingHours)}`,
        }
      : null
  const endX = count > 0 ? xAt(count - 1, count) : null

  return (
    <section aria-labelledby="burndown-chart-title" className={`${styles.panel} ${styles.wide}`}>
      <div className={styles.panelHeader}>
        <h3 id="burndown-chart-title" className={styles.panelTitle}>
          {burndownCopy.chartTitle}
        </h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.swatchActual} /> {burndownCopy.actualLegend}
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchIdeal} /> {burndownCopy.idealLegend}
          </span>
        </div>
      </div>
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
          <g key={tick.y}>
            <line
              x1={CHART.left}
              x2={CHART.width - CHART.right}
              y1={tick.y}
              y2={tick.y}
              className={styles.gridLine}
            />
            <text x={CHART.left - 10} y={tick.y + 4} textAnchor="end" className={styles.axis}>
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
        {endX === null ? null : (
          <>
            <line
              x1={endX}
              x2={endX}
              y1={CHART.top}
              y2={CHART.height - CHART.bottom}
              className={styles.endLine}
            />
            <text x={endX - 8} y={CHART.top + 12} textAnchor="end" className={styles.endLabel}>
              {burndownCopy.sprintEnd}
            </text>
          </>
        )}
        <path d={series.idealPath} className={styles.ideal} fill="none" />
        <path d={series.actualPath} className={styles.actual} fill="none" />
        {todayPoint === null ? null : (
          <>
            <circle cx={todayPoint.x} cy={todayPoint.y} r={5} className={styles.todayDot} />
            <text x={todayPoint.x + 10} y={todayPoint.y - 10} className={styles.todayLabel}>
              {todayPoint.label}
            </text>
          </>
        )}
      </svg>
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
