import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import {
  toDeliverableId,
  toMilestoneId,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '../shared/ids'
import { MILESTONE_CRITERION_MAX_LENGTH, createMilestone, updateMilestone } from './milestone'
import type { CreateMilestoneInput } from './milestone'

const ulid = (n: number) => String(n).padStart(26, '0')

function input(overrides: Partial<CreateMilestoneInput> = {}): CreateMilestoneInput {
  return {
    id: toMilestoneId(ulid(1)),
    organizationId: toOrganizationId(ulid(2)),
    projectId: toProjectId(ulid(3)),
    title: 'Entrega à diretoria',
    dueOn: '2026-06-30',
    deliverableId: null,
    criterion: null,
    createdBy: toUserId(ulid(4)),
    createdAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('criar marco', () => {
  it('aceita título, data e vínculos opcionais; critério vazio vira nulo', () => {
    const milestone = createMilestone(input({ criterion: '   ' }))
    expect(milestone).toMatchObject({ title: 'Entrega à diretoria', dueOn: '2026-06-30' })
    expect(milestone.criterion).toBeNull()
    expect(milestone.deliverableId).toBeNull()
  })

  it('título é obrigatório e limitado a 200 caracteres', () => {
    expect(() => createMilestone(input({ title: '  ' }))).toThrow(ValidationError)
    expect(() => createMilestone(input({ title: 'a'.repeat(201) }))).toThrow(ValidationError)
    expect(createMilestone(input({ title: 'a'.repeat(200) })).title).toHaveLength(200)
  })

  it.each([
    ['formato errado', '30/06/2026'],
    ['dia inexistente', '2026-02-30'],
    ['mês zero', '2026-00-10'],
  ])('data recusada: %s', (_label, dueOn) => {
    expect(() => createMilestone(input({ dueOn }))).toThrow(ValidationError)
  })

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(createMilestone(input({ dueOn: '2028-02-29' })).dueOn).toBe('2028-02-29')
  })

  it('critério tem limite de 280 caracteres', () => {
    expect(
      createMilestone(input({ criterion: 'c'.repeat(MILESTONE_CRITERION_MAX_LENGTH) })).criterion,
    ).toHaveLength(280)
    expect(() =>
      createMilestone(input({ criterion: 'c'.repeat(MILESTONE_CRITERION_MAX_LENGTH + 1) })),
    ).toThrow(ValidationError)
  })
})

describe('atualizar marco', () => {
  it('muda só os campos informados', () => {
    const base = createMilestone(input({ criterion: 'Aprovado' }))
    const next = updateMilestone(base, { dueOn: '2026-07-15' })
    expect(next).toMatchObject({ title: base.title, dueOn: '2026-07-15', criterion: 'Aprovado' })
  })

  it('valida a data e o título novos e aceita limpar critério e vínculo', () => {
    const base = createMilestone(input({ deliverableId: toDeliverableId(ulid(9)), criterion: 'x' }))
    expect(() => updateMilestone(base, { dueOn: '2026-13-01' })).toThrow(ValidationError)
    expect(() => updateMilestone(base, { title: '' })).toThrow(ValidationError)
    const cleared = updateMilestone(base, { criterion: null, deliverableId: null })
    expect(cleared.criterion).toBeNull()
    expect(cleared.deliverableId).toBeNull()
  })
})
