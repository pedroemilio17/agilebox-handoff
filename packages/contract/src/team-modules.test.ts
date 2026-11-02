import { describe, expect, it } from 'vitest'
import {
  changeTeamModulesInputSchema,
  changeTeamModulesOutputSchema,
  finishTeamModuleWindingDownInputSchema,
  getTeamModulesOutputSchema,
  previewTeamModuleImpactInputSchema,
  previewTeamModuleImpactOutputSchema,
  teamModuleIdSchema,
  TEAM_MODULE_IDS,
} from './team-modules'
import { API_SCHEMA_REGISTRY } from './api'

const status = { moduleId: 'agenda', state: 'active' }
const impact = {
  moduleId: 'agenda',
  counts: { tasks: 0, projects: 0, participations: 0, meetings: 2 },
  items: [{ kind: 'meetings', destination: 'hidden', count: 2 }],
}

describe('schemas de ferramentas do time', () => {
  it('recusa id de módulo desconhecido em todas as entradas', () => {
    expect(changeTeamModulesInputSchema.safeParse({ enable: ['marte'] }).success).toBe(false)
    expect(changeTeamModulesInputSchema.safeParse({ disable: ['marte'] }).success).toBe(false)
    expect(previewTeamModuleImpactInputSchema.safeParse({ disable: ['marte'] }).success).toBe(false)
    expect(finishTeamModuleWindingDownInputSchema.safeParse({ moduleId: 'marte' }).success).toBe(
      false,
    )
    expect(teamModuleIdSchema.safeParse('estimates.points').success).toBe(true)
  })

  it('aceita ids do catálogo e listas vazias ou ausentes', () => {
    expect(
      changeTeamModulesInputSchema.parse({ enable: ['backlog'], disable: ['agenda'] }),
    ).toEqual({ enable: ['backlog'], disable: ['agenda'] })
    expect(changeTeamModulesInputSchema.parse({})).toEqual({})
    expect(previewTeamModuleImpactInputSchema.parse({ disable: [] })).toEqual({ disable: [] })
  })

  it('recusa estado fora de active, winding_down e disabled na saída', () => {
    const payload = (statuses: unknown) => ({
      level: 'intermediate',
      screens: ['projects'],
      statuses,
    })
    expect(getTeamModulesOutputSchema.safeParse(payload([status])).success).toBe(true)
    expect(
      getTeamModulesOutputSchema.safeParse(payload([{ moduleId: 'agenda', state: 'encerrado' }]))
        .success,
    ).toBe(false)
  })

  it('a saída de get traz nível, telas do menu e estados; recusa tela ou nível desconhecidos', () => {
    const ok = { level: 'advanced', screens: ['tools', 'backlog'], statuses: [status] }
    expect(getTeamModulesOutputSchema.parse(ok)).toEqual(ok)
    expect(getTeamModulesOutputSchema.safeParse({ ...ok, screens: ['plugins'] }).success).toBe(
      false,
    )
    expect(getTeamModulesOutputSchema.safeParse({ ...ok, level: 'expert' }).success).toBe(false)
  })

  it('aceita prévia e mudança com a forma que a aplicação devolve', () => {
    expect(previewTeamModuleImpactOutputSchema.parse([impact])).toEqual([impact])
    expect(
      changeTeamModulesOutputSchema.parse({ statuses: [status], windingDown: [impact] }),
    ).toEqual({ statuses: [status], windingDown: [impact] })
  })

  it('recusa contagem negativa ou fracionada na prévia', () => {
    const broken = { ...impact, counts: { ...impact.counts, meetings: -1 } }
    expect(previewTeamModuleImpactOutputSchema.safeParse([broken]).success).toBe(false)
  })

  it('lista os 15 ids do catálogo, sem repetição', () => {
    // A igualdade com `MODULE_IDS` do core é testada em apps/desktop (o contrato não importa core).
    expect(TEAM_MODULE_IDS).toHaveLength(15)
    expect(new Set(TEAM_MODULE_IDS).size).toBe(TEAM_MODULE_IDS.length)
  })

  it('associa os quatro canais de ferramentas a schemas de entrada e saída', () => {
    for (const channel of [
      'teamModules.get',
      'teamModules.previewImpact',
      'teamModules.change',
      'teamModules.finishWindingDown',
    ] as const) {
      expect(API_SCHEMA_REGISTRY[channel].input).toBeDefined()
      expect(API_SCHEMA_REGISTRY[channel].output).toBeDefined()
    }
  })
})
