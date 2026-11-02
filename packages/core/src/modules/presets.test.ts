import { describe, expect, it } from 'vitest'
import { PRESET_IDS, TEAM_PRESETS } from './presets'
import { resolveModuleSet } from './resolve-module-set'
import { MODULE_IDS } from './types'
import type { ModuleId } from './types'

/** Módulos que dependem do M10 e, por isso, ficam fora de todo preset até lá. */
const M10_MODULES: readonly ModuleId[] = [
  'wip',
  'subtasks',
  'flowMetrics',
  'reviewRetro',
  'burndown',
  'estimates.points',
]

describe('presets de ferramentas', () => {
  it('há três presets: Quadro simples, Scrum do time e Completo', () => {
    expect(PRESET_IDS).toEqual(['quadroSimples', 'scrumDoTime', 'completo'])
  })

  it.each(PRESET_IDS)(
    '%s resolve a partir de vazio, sem conflito nem dependência faltando',
    (id) => {
      const resolution = resolveModuleSet([], { enable: TEAM_PRESETS[id] })

      expect(resolution.ok).toBe(true)
      if (!resolution.ok) return
      expect(resolution.enabled).toEqual(
        MODULE_IDS.filter((moduleId) => TEAM_PRESETS[id].includes(moduleId)),
      )
      expect(resolution.autoEnabled).toEqual([])
    },
  )

  it('Quadro simples é Núcleo, Agenda e Backlog', () => {
    expect(resolveModuleSet([], { enable: TEAM_PRESETS.quadroSimples })).toEqual({
      ok: true,
      enabled: ['core', 'agenda', 'backlog'],
      autoEnabled: [],
    })
  })

  it('Scrum do time soma Sprints, check-ins e impedimentos, sem retro nem estimativas e critérios', () => {
    const { scrumDoTime } = TEAM_PRESETS
    expect(scrumDoTime).toEqual(
      expect.arrayContaining(['backlog', 'sprints', 'checkins', 'impediments']),
    )
    expect(scrumDoTime).not.toContain('reviewRetro')
    expect(scrumDoTime).not.toContain('estimates.hours')
    expect(scrumDoTime).not.toContain('acceptance')
    expect(scrumDoTime).not.toContain('integrations')
  })

  it('Completo tem tudo o que existe antes do M10, com Integrações', () => {
    const { completo } = TEAM_PRESETS
    expect(completo).toContain('integrations')
    expect(completo).toEqual(
      expect.arrayContaining([
        'sprints',
        'checkins',
        'impediments',
        'estimates.hours',
        'acceptance',
      ]),
    )
  })

  it('nenhum preset cita módulo do M10', () => {
    for (const id of PRESET_IDS) {
      for (const moduleId of M10_MODULES) {
        expect(TEAM_PRESETS[id]).not.toContain(moduleId)
      }
    }
  })

  it('Integrações começa desligada: fica fora de Quadro simples e Scrum do time', () => {
    expect(TEAM_PRESETS.quadroSimples).not.toContain('integrations')
    expect(TEAM_PRESETS.scrumDoTime).not.toContain('integrations')
  })

  it('Scrum do time resolve sem estimativa em horas e sem critérios de aceite (B6)', () => {
    const resolution = resolveModuleSet([], { enable: TEAM_PRESETS.scrumDoTime })
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) return
    expect(resolution.enabled).not.toContain('estimates.hours')
    expect(resolution.enabled).not.toContain('acceptance')
  })

  it('Completo resolve com estimativa em horas e critérios de aceite (B6)', () => {
    const resolution = resolveModuleSet([], { enable: TEAM_PRESETS.completo })
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) return
    expect(resolution.enabled).toEqual(expect.arrayContaining(['estimates.hours', 'acceptance']))
  })

  it('no Scrum do time, desligar só Backlog é recusado e lista Sprints, check-ins e impedimentos', () => {
    const scrum = resolveModuleSet([], { enable: TEAM_PRESETS.scrumDoTime })
    if (!scrum.ok) throw new Error('Scrum do time deveria resolver')

    expect(resolveModuleSet(scrum.enabled, { disable: ['backlog'] })).toEqual({
      ok: false,
      conflicts: [],
      blockedBy: ['sprints', 'checkins', 'impediments'],
    })
  })

  it('no Scrum do time, desligar Backlog junto com Sprints, check-ins e impedimentos é aceito', () => {
    const scrum = resolveModuleSet([], { enable: TEAM_PRESETS.scrumDoTime })
    if (!scrum.ok) throw new Error('Scrum do time deveria resolver')

    expect(
      resolveModuleSet(scrum.enabled, {
        disable: ['backlog', 'sprints', 'checkins', 'impediments'],
      }),
    ).toEqual({ ok: true, enabled: ['core', 'agenda'], autoEnabled: [] })
  })
})
