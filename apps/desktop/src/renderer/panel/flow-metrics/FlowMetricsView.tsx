import { useId } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import type { FlowMetricsViewDto } from '@agilebox/contract'
import type { PanelView } from '../layout/PanelShell'
import { useFlowMetrics } from '../hooks/use-flow-metrics'
import {
  CHART,
  dayLabel,
  flowChart,
  flowMetricsCopy,
  flowSummary,
  formatCount,
  formatDays,
  headerSubtitle,
  perWeekText,
  SMALL_SAMPLE,
} from './flow-metrics-screen'
import styles from './FlowMetricsView.module.css'

export interface FlowMetricsViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Leva a outra tela (pelo painel de ajuda). */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Métricas de fluxo do projeto (ADR-10, módulo `flowMetrics`): lead time, cycle time e vazão das
 * últimas oito semanas. Só mostra o que o servidor calcula; sem valores de custo.
 */
export function FlowMetricsView({ projectId, projectName }: FlowMetricsViewProps) {
  const query = useFlowMetrics(projectId)

  if (projectId === null) {
    return (
      <section aria-label={flowMetricsCopy.title} className={styles.view}>
        <p className={styles.muted}>{flowMetricsCopy.noProject}</p>
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={flowMetricsCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {flowMetricsCopy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={flowMetricsCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{flowMetricsCopy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {flowMetricsCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const view = query.data
  const subtitle = [projectName, headerSubtitle(view)].filter(Boolean).join(' · ')

  return (
    <section aria-label={flowMetricsCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{flowMetricsCopy.title}</h2>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
      </header>

      <div className={styles.cards}>
        <section aria-label={flowMetricsCopy.leadTime} className={styles.card}>
          <p className={styles.label}>{flowMetricsCopy.leadTime}</p>
          <p className={styles.value}>{formatDays(view.leadDays)}</p>
          <p className={styles.caption}>{flowMetricsCopy.leadCaption}</p>
        </section>
        <section aria-label={flowMetricsCopy.cycleTime} className={styles.card}>
          <p className={styles.label}>{flowMetricsCopy.cycleTime}</p>
          <p className={styles.value}>{formatDays(view.cycleDays)}</p>
          <p className={styles.caption}>
            {view.cycleDays === null ? flowMetricsCopy.noCycle : flowMetricsCopy.cycleCaption}
          </p>
        </section>
        <section aria-label={flowMetricsCopy.throughput} className={styles.card}>
          <p className={styles.label}>{flowMetricsCopy.throughput}</p>
          <p className={styles.value}>{formatCount(view.completed)}</p>
          <p className={styles.caption}>
            {flowMetricsCopy.throughputCaption(perWeekText(view.completed, view.weeks.length))}
          </p>
        </section>
      </div>

      {view.completed < SMALL_SAMPLE ? (
        <p className={styles.note}>{flowMetricsCopy.sampleNote(view.completed)}</p>
      ) : null}

      <section aria-labelledby="flow-chart-title" className={styles.panel}>
        <h3 id="flow-chart-title" className={styles.panelTitle}>
          {flowMetricsCopy.chartLabel}
        </h3>
        {view.completed === 0 ? (
          <EmptyState title={flowMetricsCopy.emptyTitle} />
        ) : (
          <FlowBarChart view={view} />
        )}
      </section>
    </section>
  )
}

function FlowBarChart({ view }: { readonly view: FlowMetricsViewDto }) {
  const titleId = useId()
  const descId = useId()
  const chart = flowChart(view)
  const summary = flowSummary(view)

  return (
    <>
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={styles.svg}
      >
        <title id={titleId}>{flowMetricsCopy.chartLabel}</title>
        <desc id={descId}>{summary}</desc>
        {chart.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={CHART.left}
              x2={CHART.width - CHART.right}
              y1={tick.y}
              y2={tick.y}
              className={styles.grid}
            />
            <text x={CHART.left - 8} y={tick.y + 4} textAnchor="end" className={styles.axis}>
              {formatCount(tick.value)}
            </text>
          </g>
        ))}
        {chart.bars.map((bar) => (
          <g key={bar.start}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={3}
              className={styles.bar}
            />
            <text
              x={bar.x + bar.width / 2}
              y={bar.y - 6}
              textAnchor="middle"
              className={styles.barValue}
            >
              {bar.completed > 0 ? formatCount(bar.completed) : ''}
            </text>
            <text
              x={bar.x + bar.width / 2}
              y={CHART.height - 12}
              textAnchor="middle"
              className={styles.axis}
            >
              {bar.label}
            </text>
          </g>
        ))}
      </svg>
      <p className={styles.summary}>{summary}</p>
      <details className={styles.details}>
        <summary>{flowMetricsCopy.chartTableSummary}</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{flowMetricsCopy.week}</th>
              <th scope="col">{flowMetricsCopy.completed}</th>
            </tr>
          </thead>
          <tbody>
            {view.weeks.map((week) => (
              <tr key={week.start}>
                <td>{dayLabel(week.start)}</td>
                <td>{formatCount(week.completed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}
