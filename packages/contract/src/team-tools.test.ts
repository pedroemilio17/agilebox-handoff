import { describe, expect, it } from 'vitest'
import { API_CHANNELS, API_SCHEMA_REGISTRY } from './index'
import {
  applyTeamPresetInputSchema,
  previewTeamToolsChangeInputSchema,
  setTeamLevelInputSchema,
  teamToolsChangeInputSchema,
} from './team-tools'

const TEAM_TOOL_CHANNELS = [
  'teamTools.get',
  'teamTools.previewChange',
  'teamTools.applyChange',
  'teamTools.completeWindDown',
  'teamTools.setLevel',
  'teamTools.applyPreset',
] as const

describe('contrato das ferramentas da equipe', () => {
  it('registra cada canal teamTools.* com schemas de entrada e saída', () => {
    for (const channel of TEAM_TOOL_CHANNELS) {
      expect(API_CHANNELS).toContain(channel)
      expect(API_SCHEMA_REGISTRY[channel].input).toBeDefined()
      expect(API_SCHEMA_REGISTRY[channel].output).toBeDefined()
    }
  })

  it('aceita listas de ferramentas e descarta userId e tenantId forjados', () => {
    expect(
      teamToolsChangeInputSchema.parse({
        disable: ['wip'],
        userId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      }),
    ).toEqual({ disable: ['wip'] })
  })

  it('a prévia recusa preset junto com ajustes de ferramenta', () => {
    expect(() =>
      previewTeamToolsChangeInputSchema.parse({ presetId: 'kanban', enable: ['wip'] }),
    ).toThrow()
    expect(previewTeamToolsChangeInputSchema.parse({ presetId: 'kanban' })).toEqual({
      presetId: 'kanban',
    })
  })

  it('recusa id de ferramenta fora do formato e mais de 20 ferramentas por pedido', () => {
    expect(() => teamToolsChangeInputSchema.parse({ enable: ['wip; drop'] })).toThrow()
    expect(() => teamToolsChangeInputSchema.parse({ enable: [''] })).toThrow()
    const tooMany = Array.from({ length: 21 }, (_, index) => `modulo${index}`)
    expect(() => teamToolsChangeInputSchema.parse({ enable: tooMany })).toThrow()
  })

  it('recusa nível e preset desconhecidos', () => {
    expect(() => setTeamLevelInputSchema.parse({ level: 'expert' })).toThrow()
    expect(() => applyTeamPresetInputSchema.parse({ presetId: 'custom' })).toThrow()
    expect(
      applyTeamPresetInputSchema.parse({ presetId: 'scrum', applySuggestedLevel: true }),
    ).toEqual({ presetId: 'scrum', applySuggestedLevel: true })
  })
})
