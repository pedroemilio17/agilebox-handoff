import { dashboardCopy } from './dashboard-copy'
import { brl, days } from './dashboard-format'
import type { DashboardInsights } from './dashboard-format'
import styles from './Dashboard.module.css'

interface Kpi {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly sub: string
}

/**
 * Indicadores da faixa, só com o que o contrato traz. "Tarefas ativas" e "Horas lançadas" não têm
 * total agregado, e o custo cobre só os projetos que medem custo (pendência registrada).
 */
export function kpisOf(data: DashboardInsights): Kpi[] {
  const kpis: Kpi[] = []

  if (data.leadDays != null || data.cycleDays != null) {
    const main = data.leadDays ?? data.cycleDays ?? null
    kpis.push({
      key: 'time',
      label: 'Tempo médio',
      value: days(main),
      sub:
        data.leadDays != null && data.cycleDays != null
          ? `${days(data.cycleDays)} em execução`
          : data.leadDays != null
            ? 'do pedido à entrega'
            : 'em execução',
    })
  }

  const weeks = data.weeks ?? []
  const index = weeks.findIndex((week) => week.start === data.weekStart)
  const current = index >= 0 ? weeks[index] : undefined
  const done = current?.throughput ?? data.throughput
  if (done !== undefined) {
    const previous = index > 0 ? weeks[index - 1] : undefined
    const delta = previous ? done - previous.throughput : null
    kpis.push({
      key: 'done',
      label: 'Concluídas (sem.)',
      value: String(done),
      sub: delta === null ? 'na semana' : `${delta > 0 ? '+' : ''}${delta} vs. semana anterior`,
    })
  }

  const withCost = data.projects.flatMap((project) =>
    project.kpi.kind === 'progress' && project.kpi.spentCost !== null
      ? [project.kpi.spentCost]
      : [],
  )
  if (withCost.length > 0) {
    const total = withCost.reduce((sum, value) => sum + value, 0)
    kpis.push({
      key: 'cost',
      label: 'Custo dos projetos',
      value: brl(total),
      sub: `${withCost.length} de ${data.projects.length} projetos com custo · Visão exclusiva Gestor`,
    })
  }
  return kpis
}

export interface KpiStripProps {
  readonly kpis: readonly Kpi[]
}

/** Faixa de indicadores em 100% da largura, com divisórias de 1px. Sem dado, não aparece. */
export function KpiStrip({ kpis }: KpiStripProps) {
  if (kpis.length === 0) return null
  return (
    <section
      className={styles.kpiStrip}
      aria-label={dashboardCopy.kpiLabel}
      style={{ ['--kpi-count' as string]: Math.min(kpis.length, 5) }}
    >
      {kpis.map((kpi) => (
        <div className={styles.kpiCell} key={kpi.key}>
          <span className={styles.kpiLabel}>{kpi.label}</span>
          <span className={styles.kpiValue}>{kpi.value}</span>
          <span className={styles.kpiSub} title={kpi.sub}>
            {kpi.sub}
          </span>
        </div>
      ))}
    </section>
  )
}
