import { format, parseISO } from 'date-fns'
import type { DashboardDto } from '@agilebox/contract'

export type DashboardInsights = NonNullable<DashboardDto['insights']>
export type ProjectCard = DashboardInsights['projects'][number]
export type ProjectKpi = ProjectCard['kpi']

/** Nomes da metodologia nos cartões (como no design: "Tradicional", não "Trad."). */
export const METHOD_NAMES: Readonly<Record<NonNullable<ProjectCard['method']>, string>> = {
  simples: 'Simples',
  kanban: 'Kanban',
  agil: 'Ágil',
  tradicional: 'Tradicional',
  hibrido: 'Híbrido',
}

export const HEALTH_LABELS: Readonly<Record<ProjectCard['health'], string>> = {
  ok: 'Em dia',
  attention: 'Atenção',
  risk: 'Risco',
}

export function hours(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function days(value: number | null): string {
  if (value === null) return '—'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${value === 1 ? 'dia' : 'dias'}`
}

export function reais(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

/** Valor em reais com centavos ("R$ 9.840,00"). */
export function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Dia e mês curtos ("12/11"), como nos prazos do painel. */
export function shortDate(value: string): string {
  return format(parseISO(value), 'dd/MM')
}

export interface KpiText {
  readonly label: string
  readonly value: string
  readonly sub: string
}

/** Texto do indicador principal de um cartão, na forma da metodologia. */
export function kpiText(kpi: ProjectKpi): KpiText {
  switch (kpi.kind) {
    case 'sprint':
      return {
        label: `Sprint ${kpi.sprint.number} · dia ${kpi.sprint.day} de ${kpi.sprint.totalDays}`,
        value: `${hours(kpi.sprint.remainingHours)} h restantes`,
        sub: `termina em ${shortDate(kpi.sprint.endsOn)}`,
      }
    case 'progress': {
      const parts = [
        kpi.week ? `semana ${kpi.week.current} de ${kpi.week.total}` : null,
        kpi.spentCost !== null ? `${reais(kpi.spentCost)} gastos` : null,
      ].filter((part): part is string => part !== null)
      return {
        label: kpi.baselineDeviationDays !== null ? 'Concluído contra a base' : 'Concluído',
        value: `${kpi.percent}%`,
        sub: parts.length > 0 ? parts.join(' · ') : `${kpi.done} de ${kpi.total} tarefas`,
      }
    }
    case 'milestone': {
      const when =
        kpi.daysLeft > 0
          ? `marco em ${kpi.daysLeft} ${kpi.daysLeft === 1 ? 'dia' : 'dias'}`
          : kpi.daysLeft === 0
            ? 'marco hoje'
            : `marco venceu há ${-kpi.daysLeft} ${kpi.daysLeft === -1 ? 'dia' : 'dias'}`
      return {
        label: `${kpi.title} · ${when}`,
        value: `${kpi.percent}% feito`,
        sub: kpi.sprint
          ? `Sprint ${kpi.sprint.number} · dia ${kpi.sprint.day} de ${kpi.sprint.totalDays} · ${hours(kpi.sprint.remainingHours)} h restantes`
          : '',
      }
    }
    case 'flow':
      return {
        label: 'Lead time médio',
        value: days(kpi.leadDays),
        sub: `${kpi.completedLastWeek} ${kpi.completedLastWeek === 1 ? 'tarefa concluída' : 'tarefas concluídas'} na semana`,
      }
  }
}

export interface TrendPaths {
  /** Linha de referência (tracejada), ou nula. */
  readonly reference: string | null
  /** Linha real. Valores nulos quebram a linha (dias ainda sem medida). */
  readonly actual: string
}

const TREND_WIDTH = 260
const TREND_HEIGHT = 40

/**
 * Caminhos SVG do gráfico pequeno do cartão: mesma escala do desenho (x distribuído em 260 unidades,
 * y de 38 até 4 conforme o maior valor da série).
 */
export function trendPaths(trend: NonNullable<ProjectCard['trend']>): TrendPaths {
  const reference = trend.reference
  const values = [...(reference ?? []), ...trend.actual.filter((v): v is number => v !== null)]
  const max = Math.max(1, ...values)
  const point = (index: number, count: number, value: number) => {
    const x = count <= 1 ? 0 : (index * TREND_WIDTH) / (count - 1)
    const y = TREND_HEIGHT - 2 - (value / max) * 34
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  }
  const line = (series: readonly (number | null)[]) => {
    let path = ''
    let open = false
    series.forEach((value, index) => {
      if (value === null) {
        open = false
        return
      }
      path += `${open ? 'L' : 'M'}${point(index, series.length, value)} `
      open = true
    })
    return path.trim()
  }
  return {
    reference: reference ? line(reference) : null,
    actual: line(trend.actual),
  }
}
