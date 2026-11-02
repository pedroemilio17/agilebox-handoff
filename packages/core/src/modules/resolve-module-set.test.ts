import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { resolveModuleSet } from './resolve-module-set'
import type { ModuleId } from './types'

const BASE: readonly ModuleId[] = ['core']

describe('resolveModuleSet', () => {
  it('ativar Sprints puxa Backlog e informa que foi automático', () => {
    expect(resolveModuleSet(BASE, { enable: ['sprints'] })).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints'],
      autoEnabled: ['backlog'],
    })
  })

  it('ativar Sprints com Backlog já ligado não puxa nada', () => {
    expect(resolveModuleSet(['core', 'backlog'], { enable: ['sprints'] })).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints'],
      autoEnabled: [],
    })
  })

  it('ativar Sprints e Backlog juntos não marca o Backlog como automático', () => {
    expect(resolveModuleSet(BASE, { enable: ['sprints', 'backlog'] })).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints'],
      autoEnabled: [],
    })
  })

  it('desligar Backlog com Sprints ativo é recusado e lista quem depende dele', () => {
    expect(resolveModuleSet(['core', 'backlog', 'sprints'], { disable: ['backlog'] })).toEqual({
      ok: false,
      conflicts: [],
      blockedBy: ['sprints'],
    })
  })

  it('a recusa por dependência é em cascata: quem depende de quem caiu também aparece', () => {
    expect(
      resolveModuleSet(['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'], {
        disable: ['backlog'],
      }),
    ).toEqual({ ok: false, conflicts: [], blockedBy: ['sprints', 'burndown'] })
  })

  it('desligar Backlog e Sprints juntos é aceito', () => {
    expect(
      resolveModuleSet(['core', 'backlog', 'sprints'], { disable: ['backlog', 'sprints'] }),
    ).toEqual({ ok: true, enabled: ['core'], autoEnabled: [] })
  })

  it('desligar Sprints com Burndown ativo é recusado', () => {
    expect(
      resolveModuleSet(['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'], {
        disable: ['sprints'],
      }),
    ).toEqual({ ok: false, conflicts: [], blockedBy: ['burndown'] })
  })

  it('ativar horas com pontos já ativo é recusado como conflito', () => {
    expect(resolveModuleSet(['core', 'estimates.points'], { enable: ['estimates.hours'] })).toEqual(
      {
        ok: false,
        conflicts: [['estimates.hours', 'estimates.points']],
        blockedBy: [],
      },
    )
  })

  it('ativar horas e pontos na mesma mudança é recusado como conflito', () => {
    expect(resolveModuleSet(BASE, { enable: ['estimates.points', 'estimates.hours'] })).toEqual({
      ok: false,
      conflicts: [['estimates.hours', 'estimates.points']],
      blockedBy: [],
    })
  })

  it('trocar horas por pontos é aceito se a mudança desliga horas', () => {
    expect(
      resolveModuleSet(['core', 'estimates.hours'], {
        enable: ['estimates.points'],
        disable: ['estimates.hours'],
      }),
    ).toEqual({ ok: true, enabled: ['core', 'estimates.points'], autoEnabled: [] })
  })

  it('um conflito já existente deixa de bloquear quando a mudança resolve o par', () => {
    expect(
      resolveModuleSet(['core', 'estimates.hours', 'estimates.points'], {
        disable: ['estimates.points'],
      }),
    ).toEqual({ ok: true, enabled: ['core', 'estimates.hours'], autoEnabled: [] })
  })

  it('burndown sozinho é recusado: exige horas OU pontos', () => {
    expect(resolveModuleSet(BASE, { enable: ['burndown'] })).toEqual({
      ok: false,
      conflicts: [],
      blockedBy: ['burndown'],
    })
  })

  it('burndown com horas ativa, puxando Sprints e Backlog', () => {
    expect(resolveModuleSet(['core', 'estimates.hours'], { enable: ['burndown'] })).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
      autoEnabled: ['backlog', 'sprints'],
    })
  })

  it('burndown com horas pedidas na mesma mudança é aceito', () => {
    expect(resolveModuleSet(BASE, { enable: ['burndown', 'estimates.hours'] })).toEqual({
      ok: true,
      enabled: ['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'],
      autoEnabled: ['backlog', 'sprints'],
    })
  })

  it('desligar horas com Burndown sem pontos é recusado', () => {
    expect(
      resolveModuleSet(['core', 'backlog', 'sprints', 'estimates.hours', 'burndown'], {
        disable: ['estimates.hours'],
      }),
    ).toEqual({ ok: false, conflicts: [], blockedBy: ['burndown'] })
  })

  it('núcleo não é desativado', () => {
    expect(resolveModuleSet(['core', 'agenda'], { disable: ['core'] })).toEqual({
      ok: false,
      conflicts: [],
      blockedBy: ['core'],
    })
  })

  it('núcleo está sempre ativo, mesmo se a lista atual vier sem ele', () => {
    expect(resolveModuleSet([], { enable: ['agenda'] })).toEqual({
      ok: true,
      enabled: ['core', 'agenda'],
      autoEnabled: [],
    })
  })

  it('mudança vazia devolve o conjunto atual sem nada automático', () => {
    expect(resolveModuleSet(['core', 'agenda'], {})).toEqual({
      ok: true,
      enabled: ['core', 'agenda'],
      autoEnabled: [],
    })
  })

  it('devolve o conjunto final na ordem do catálogo, sem repetição', () => {
    const result = resolveModuleSet(['agenda', 'core', 'agenda'], {
      enable: ['burndown', 'estimates.hours'],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.enabled).toEqual([
        'core',
        'agenda',
        'backlog',
        'sprints',
        'estimates.hours',
        'burndown',
      ])
    }
  })

  it('ativar e desativar o mesmo módulo na mesma mudança é erro de entrada', () => {
    expect(() => resolveModuleSet(BASE, { enable: ['agenda'], disable: ['agenda'] })).toThrow(
      ValidationError,
    )
  })

  it('módulo desconhecido é erro de entrada, em qualquer lista', () => {
    expect(() => resolveModuleSet(['core', 'nope' as ModuleId], {})).toThrow(ValidationError)
    expect(() => resolveModuleSet(BASE, { enable: ['nope' as ModuleId] })).toThrow(
      'Módulo desconhecido: nope',
    )
    expect(() => resolveModuleSet(BASE, { disable: ['nope' as ModuleId] })).toThrow(ValidationError)
  })
})
