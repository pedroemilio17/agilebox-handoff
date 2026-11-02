import { describe, expect, it } from 'vitest'
import { API_CHANNELS, API_SCHEMA_REGISTRY } from './index'
import {
  getTeamLevelOutputSchema,
  setTeamLevelInputSchema,
  setTeamLevelOutputSchema,
} from './team-settings'

describe('schemas do nível do time', () => {
  it('aceita só os três níveis do catálogo na leitura e na gravação', () => {
    for (const level of ['basic', 'intermediate', 'advanced']) {
      expect(getTeamLevelOutputSchema.safeParse(level).success).toBe(true)
      expect(setTeamLevelOutputSchema.safeParse(level).success).toBe(true)
      expect(setTeamLevelInputSchema.safeParse({ level }).success).toBe(true)
    }
  })

  it('recusa nível desconhecido, vazio, ausente ou de outro tipo', () => {
    expect(setTeamLevelInputSchema.safeParse({ level: 'expert' }).success).toBe(false)
    expect(setTeamLevelInputSchema.safeParse({ level: '' }).success).toBe(false)
    expect(setTeamLevelInputSchema.safeParse({}).success).toBe(false)
    expect(setTeamLevelInputSchema.safeParse({ level: 2 }).success).toBe(false)
    expect(getTeamLevelOutputSchema.safeParse('constructor').success).toBe(false)
  })

  it('o canal de leitura e o de gravação estão no registro da API', () => {
    expect(API_CHANNELS).toContain('teamSettings.getLevel')
    expect(API_CHANNELS).toContain('teamSettings.setLevel')
    expect(API_SCHEMA_REGISTRY['teamSettings.setLevel'].input).toBe(setTeamLevelInputSchema)
    expect(API_SCHEMA_REGISTRY['teamSettings.getLevel'].output).toBe(getTeamLevelOutputSchema)
  })
})
