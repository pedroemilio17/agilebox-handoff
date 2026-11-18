/**
 * Situação de um projeto no dashboard: Em dia, Atenção ou Risco, sempre com o motivo.
 *
 * REGRA PROVISÓRIA (pendência do Pedro, `docs/laco/pendencias-do-pedro.md`): o design mostra os três
 * estados, mas nenhum documento define quando cada um vale. Esta ordem usa só sinais que o domínio já
 * calcula: risco quando há vencida, marco em risco ou coluna acima do limite de WIP; atenção quando há
 * tarefa parada há mais de 4 dias, bloqueada ou com fim previsto depois da linha de base.
 */

export type ProjectHealth = 'ok' | 'attention' | 'risk'

export interface HealthSignals {
  readonly overdueCount: number
  readonly atRiskMilestones: number
  readonly overWipColumns: number
  readonly agingCount: number
  readonly blockedCount: number
  /** Dias do fim atual frente à linha de base (positivo = atrasou). Nulo sem foto. */
  readonly endDeviationDays: number | null
}

export interface ProjectHealthResult {
  readonly health: ProjectHealth
  readonly reason: string
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function projectHealth(signals: HealthSignals): ProjectHealthResult {
  if (signals.overdueCount > 0)
    return {
      health: 'risk',
      reason: plural(signals.overdueCount, 'tarefa vencida', 'tarefas vencidas'),
    }
  if (signals.atRiskMilestones > 0)
    return {
      health: 'risk',
      reason: plural(signals.atRiskMilestones, 'marco em risco', 'marcos em risco'),
    }
  if (signals.overWipColumns > 0)
    return {
      health: 'risk',
      reason: plural(signals.overWipColumns, 'coluna acima do limite', 'colunas acima do limite'),
    }
  if (signals.agingCount > 0)
    return {
      health: 'attention',
      reason: `${plural(signals.agingCount, 'tarefa parada', 'tarefas paradas')} há mais de 4 dias`,
    }
  if (signals.blockedCount > 0)
    return {
      health: 'attention',
      reason: plural(signals.blockedCount, 'tarefa bloqueada', 'tarefas bloqueadas'),
    }
  if (signals.endDeviationDays !== null && signals.endDeviationDays > 0)
    return {
      health: 'attention',
      reason: `Fim previsto ${plural(signals.endDeviationDays, 'dia', 'dias')} depois da linha de base`,
    }
  return { health: 'ok', reason: 'Nenhum sinal de atenção.' }
}
