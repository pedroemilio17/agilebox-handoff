import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toDeliverableId, toOrganizationId, toProjectId, toRiskId, toUserId } from '../shared/ids'
import {
  createRisk,
  RISK_DESCRIPTION_MAX_LENGTH,
  RISK_RESPONSE_MAX_LENGTH,
  RISK_TITLE_MAX_LENGTH,
  updateRisk,
  validateRiskDescription,
  validateRiskResponse,
  validateRiskTitle,
  type CreateRiskInput,
} from './risk'

const ulid = (n: number) => String(n).padStart(26, '0')
const at = '2026-11-10T09:00:00.000Z'
const later = '2026-11-11T09:00:00.000Z'

function input(overrides: Partial<CreateRiskInput> = {}): CreateRiskInput {
  return {
    id: toRiskId(ulid(1)),
    organizationId: toOrganizationId(ulid(2)),
    projectId: toProjectId(ulid(3)),
    title: '  Fornecedor atrasa a entrega  ',
    description: null,
    probability: 2,
    impact: 3,
    response: null,
    ownerId: null,
    deliverableId: null,
    createdBy: toUserId(ulid(4)),
    createdAt: at,
    ...overrides,
  }
}

describe('createRisk', () => {
  it('nasce aberto, com título aparado e updatedAt igual ao createdAt', () => {
    const risk = createRisk(input())
    expect(risk.title).toBe('Fornecedor atrasa a entrega')
    expect(risk.status).toBe('open')
    expect(risk.updatedAt).toBe(at)
    expect(risk.probability).toBe(2)
    expect(risk.impact).toBe(3)
  })

  it('texto vazio de descrição e resposta vira nulo', () => {
    const risk = createRisk(input({ description: '   ', response: '' }))
    expect(risk.description).toBeNull()
    expect(risk.response).toBeNull()
  })

  it('aceita dono e entrega opcionais preenchidos', () => {
    const risk = createRisk(
      input({ ownerId: toUserId(ulid(5)), deliverableId: toDeliverableId(ulid(6)) }),
    )
    expect(risk.ownerId).toBe(toUserId(ulid(5)))
    expect(risk.deliverableId).toBe(toDeliverableId(ulid(6)))
  })

  it('recusa título vazio e probabilidade ou impacto fora de 1 a 3', () => {
    expect(() => createRisk(input({ title: '   ' }))).toThrow(ValidationError)
    expect(() => createRisk(input({ probability: 0 }))).toThrow(ValidationError)
    expect(() => createRisk(input({ impact: 4 }))).toThrow(ValidationError)
  })
})

describe('textos do risco', () => {
  it('título aceita o limite e recusa um caractere a mais', () => {
    expect(validateRiskTitle('a'.repeat(RISK_TITLE_MAX_LENGTH))).toHaveLength(RISK_TITLE_MAX_LENGTH)
    expect(() => validateRiskTitle('a'.repeat(RISK_TITLE_MAX_LENGTH + 1))).toThrow(ValidationError)
  })

  it('descrição e resposta têm seus limites', () => {
    expect(validateRiskDescription('d'.repeat(RISK_DESCRIPTION_MAX_LENGTH))).not.toBeNull()
    expect(() => validateRiskDescription('d'.repeat(RISK_DESCRIPTION_MAX_LENGTH + 1))).toThrow(
      ValidationError,
    )
    expect(validateRiskResponse('r'.repeat(RISK_RESPONSE_MAX_LENGTH))).not.toBeNull()
    expect(() => validateRiskResponse('r'.repeat(RISK_RESPONSE_MAX_LENGTH + 1))).toThrow(
      ValidationError,
    )
  })
})

describe('updateRisk', () => {
  it('campo ausente não muda e updatedAt é carimbado', () => {
    const risk = createRisk(input({ response: 'Trocar de fornecedor' }))
    const updated = updateRisk(risk, { impact: 1 }, later)
    expect(updated.impact).toBe(1)
    expect(updated.response).toBe('Trocar de fornecedor')
    expect(updated.title).toBe(risk.title)
    expect(updated.updatedAt).toBe(later)
    expect(updated.createdAt).toBe(at)
  })

  it('nulo desliga dono, entrega, resposta e descrição', () => {
    const risk = createRisk(
      input({
        description: 'Contrato assinado em março',
        response: 'Negociar',
        ownerId: toUserId(ulid(5)),
        deliverableId: toDeliverableId(ulid(6)),
      }),
    )
    const cleared = updateRisk(
      risk,
      { description: null, response: null, ownerId: null, deliverableId: null },
      later,
    )
    expect(cleared.description).toBeNull()
    expect(cleared.response).toBeNull()
    expect(cleared.ownerId).toBeNull()
    expect(cleared.deliverableId).toBeNull()
  })

  it('muda a situação e recusa situação desconhecida', () => {
    const risk = createRisk(input())
    expect(updateRisk(risk, { status: 'mitigated' }, later).status).toBe('mitigated')
    expect(() => updateRisk(risk, { status: 'arquivado' as never }, later)).toThrow(ValidationError)
  })

  it('valida os campos editados como na criação', () => {
    const risk = createRisk(input())
    expect(() => updateRisk(risk, { title: '' }, later)).toThrow(ValidationError)
    expect(() => updateRisk(risk, { probability: 9 }, later)).toThrow(ValidationError)
  })
})
