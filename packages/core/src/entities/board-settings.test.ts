import { describe, expect, it } from 'vitest'
import { toBoardSettingsId, toOrganizationId, toUserId } from '../shared/ids'
import { ValidationError } from '../shared/errors'
import { createBoardSettings, validateWipLimits } from './board-settings'

const base = {
  id: toBoardSettingsId('00000000000000000000000001'),
  organizationId: toOrganizationId('00000000000000000000000002'),
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: toUserId('00000000000000000000000003'),
}

describe('limites de WIP', () => {
  it('aceita limites inteiros de 1 a 99 em Desenvolvendo e Revisar', () => {
    expect(validateWipLimits({ in_progress: 1, review: 99 })).toEqual({
      in_progress: 1,
      review: 99,
    })
    expect(validateWipLimits({ in_progress: 3 })).toEqual({ in_progress: 3 })
  })

  it('trata coluna sem limite (ausente ou undefined) como sem limite', () => {
    expect(validateWipLimits({})).toEqual({})
    expect(validateWipLimits({ review: undefined })).toEqual({})
  })

  it('rejeita limite 0, 100, negativo, fracionado e não numérico', () => {
    for (const value of [0, 100, -1, 2.5, Number.NaN]) {
      expect(() => validateWipLimits({ in_progress: value })).toThrow(ValidationError)
    }
  })

  it('rejeita limite em estado que não é de WIP', () => {
    for (const status of ['planning', 'todo', 'done'] as const) {
      expect(() => validateWipLimits({ [status]: 3 })).toThrow(ValidationError)
    }
  })

  it('cria a configuração do quadro já validada', () => {
    const settings = createBoardSettings({ ...base, wipLimits: { review: 2 } })
    expect(settings.wipLimits).toEqual({ review: 2 })
    expect(() => createBoardSettings({ ...base, wipLimits: { done: 1 } })).toThrow(ValidationError)
  })
})
