import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from '../entities/timeline-event'
import { toEventId, toImpedimentId, toOrganizationId, toTaskId, toUserId } from '../shared/ids'
import { describeEvent } from './timeline'

const id = (n: number) => String(n).padStart(26, '0')
const names = {
  organizationId: toOrganizationId(id(9)),
  user: (userId: string) => (userId === id(1) ? 'Ana' : userId === id(2) ? 'Bia' : 'Usuário'),
  contributor: () => 'Entidade',
}
const manager = {
  userId: toUserId(id(5)),
  organizationId: toOrganizationId(id(9)),
  role: 'manager' as const,
}
const base = {
  id: toEventId(id(20)),
  taskId: toTaskId(id(3)),
  at: '2026-01-02T10:00:00.000Z',
  actorUserId: toUserId(id(1)),
  asManager: false,
}

describe('linha do tempo dos impedimentos', () => {
  it('descreve a atribuição de responsável com o nome, em pt-BR', () => {
    const impedimentId = toImpedimentId(id(7))
    const define: TimelineEvent = {
      ...base,
      type: 'impediment_assigned',
      payload: { impedimentId, before: null, after: toUserId(id(2)) },
    }
    const change: TimelineEvent = {
      ...base,
      type: 'impediment_assigned',
      payload: { impedimentId, before: toUserId(id(1)), after: toUserId(id(2)) },
    }
    const clear: TimelineEvent = {
      ...base,
      type: 'impediment_assigned',
      payload: { impedimentId, before: toUserId(id(2)), after: null },
    }
    expect(describeEvent(define, manager, names)).toBe(
      'definiu Bia como responsável pelo impedimento',
    )
    expect(describeEvent(change, manager, names)).toBe(
      'alterou o responsável pelo impedimento de Ana para Bia',
    )
    expect(describeEvent(clear, manager, names)).toBe('removeu o responsável pelo impedimento')
  })

  it('o desbloqueio mostra a nota de resolução quando há, e segue igual sem ela', () => {
    const withNote: TimelineEvent = {
      ...base,
      type: 'unblocked',
      payload: { reason: 'Rede', resolution: 'Acesso liberado' },
    }
    const legacy: TimelineEvent = { ...base, type: 'unblocked', payload: { reason: 'Rede' } }
    expect(describeEvent(withNote, manager, names)).toBe('desbloqueou a tarefa: Acesso liberado')
    expect(describeEvent(legacy, manager, names)).toBe('desbloqueou a tarefa')
  })
})
