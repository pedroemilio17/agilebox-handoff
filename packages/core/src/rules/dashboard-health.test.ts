import { describe, expect, it } from 'vitest'
import { projectHealth } from './dashboard-health'

const none = {
  overdueCount: 0,
  atRiskMilestones: 0,
  overWipColumns: 0,
  agingCount: 0,
  blockedCount: 0,
  endDeviationDays: null,
}

describe('projectHealth (regra provisória)', () => {
  it('sem sinais é Em dia', () => {
    expect(projectHealth(none)).toEqual({ health: 'ok', reason: 'Nenhum sinal de atenção.' })
  })

  it('vencida, marco em risco ou WIP acima do limite é Risco, com o motivo do primeiro sinal', () => {
    expect(projectHealth({ ...none, overdueCount: 2, agingCount: 1 })).toEqual({
      health: 'risk',
      reason: '2 tarefas vencidas',
    })
    expect(projectHealth({ ...none, atRiskMilestones: 1 })).toEqual({
      health: 'risk',
      reason: '1 marco em risco',
    })
    expect(projectHealth({ ...none, overWipColumns: 1 })).toEqual({
      health: 'risk',
      reason: '1 coluna acima do limite',
    })
  })

  it('parada há mais de 4 dias, bloqueada ou atrasada frente à base é Atenção', () => {
    expect(projectHealth({ ...none, agingCount: 3 })).toEqual({
      health: 'attention',
      reason: '3 tarefas paradas há mais de 4 dias',
    })
    expect(projectHealth({ ...none, blockedCount: 1 })).toEqual({
      health: 'attention',
      reason: '1 tarefa bloqueada',
    })
    expect(projectHealth({ ...none, endDeviationDays: 1 })).toEqual({
      health: 'attention',
      reason: 'Fim previsto 1 dia depois da linha de base',
    })
  })

  it('adiantado ou no prazo da base não é atenção', () => {
    expect(projectHealth({ ...none, endDeviationDays: 0 }).health).toBe('ok')
    expect(projectHealth({ ...none, endDeviationDays: -3 }).health).toBe('ok')
  })
})
