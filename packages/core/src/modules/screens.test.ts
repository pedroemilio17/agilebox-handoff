import { describe, expect, it } from 'vitest'
import { effectiveCapabilities } from './capabilities'
import { EXPERIENCE_LEVELS } from './experience-level'
import type { ExperienceLevel } from './experience-level'
import { SIDEBAR_SCREEN_IDS, sidebarScreens } from './screens'
import { TEAM_PRESETS } from './presets'
import type { ModuleId } from './types'

/** Time com todas as ferramentas que existem hoje ligadas (Completo, handoff decisão 4). */
const EVERYTHING: readonly ModuleId[] = TEAM_PRESETS.completo

function screensFor(
  level: ExperienceLevel,
  role: 'manager' | 'collaborator',
  modules: readonly ModuleId[] = EVERYTHING,
) {
  return sidebarScreens(effectiveCapabilities({ modules, level, role }))
}

describe('telas do menu lateral', () => {
  it('colaborador não vê Ferramentas em nenhum nível', () => {
    for (const level of EXPERIENCE_LEVELS) {
      expect(screensFor(level, 'collaborator'), level).not.toContain('tools')
    }
  })

  it('gestor vê Ferramentas só no nível Avançado', () => {
    expect(screensFor('basic', 'manager')).not.toContain('tools')
    expect(screensFor('intermediate', 'manager')).not.toContain('tools')
    expect(screensFor('advanced', 'manager')).toContain('tools')
  })

  it('Essencial não vê Backlog, Sprints nem Dashboard', () => {
    const screens = screensFor('basic', 'manager')
    expect(screens).toEqual(['projects', 'agenda'])
  })

  it('Padrão mostra Backlog, Sprints e Dashboard, sem Impedimentos nem Integrações', () => {
    expect(screensFor('intermediate', 'manager')).toEqual([
      'projects',
      'agenda',
      'backlog',
      'sprints',
      'dashboard',
    ])
  })

  it('colaborador no Padrão não vê Dashboard', () => {
    expect(screensFor('intermediate', 'collaborator')).not.toContain('dashboard')
  })

  it('Avançado mostra Impedimentos e Integrações, e Ferramentas só para gestor', () => {
    expect(screensFor('advanced', 'manager')).toEqual([...SIDEBAR_SCREEN_IDS])
    expect(screensFor('advanced', 'collaborator')).toEqual(
      SIDEBAR_SCREEN_IDS.filter((screen) => screen !== 'tools' && screen !== 'dashboard'),
    )
  })

  it('módulo desligado não aparece, em nenhum nível', () => {
    for (const level of EXPERIENCE_LEVELS) {
      const screens = screensFor(
        level,
        'manager',
        EVERYTHING.filter((id) => id !== 'agenda'),
      )
      expect(screens, level).not.toContain('agenda')
    }
  })

  it('Backlog desligado some do Padrão, mesmo com o nível liberando', () => {
    const modules = EVERYTHING.filter((id) => id !== 'backlog' && id !== 'sprints')
    const screens = screensFor('intermediate', 'manager', modules)
    expect(screens).not.toContain('backlog')
    expect(screens).not.toContain('sprints')
    expect(screens).toContain('dashboard')
  })

  it('Dashboard não depende de módulo: aparece para gestor mesmo sem ferramentas', () => {
    const screens = screensFor('intermediate', 'manager', [])
    expect(screens).toEqual(['dashboard'])
  })

  it('as ferramentas do Quadro simples aparecem só até o nível que liberam', () => {
    const modules = TEAM_PRESETS.quadroSimples
    expect(screensFor('basic', 'manager', modules)).toEqual(['projects', 'agenda'])
    expect(screensFor('intermediate', 'manager', modules)).toEqual([
      'projects',
      'agenda',
      'backlog',
      'dashboard',
    ])
  })

  it('devolve as telas na ordem fixa do menu', () => {
    const screens = screensFor('advanced', 'manager')
    const order = screens.map((screen) => SIDEBAR_SCREEN_IDS.indexOf(screen))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})
