import { describe, expect, it } from 'vitest'
import type { ModuleId } from '@agilebox/core'
import type { Capabilities } from '../../shared/capabilities/capabilities-context'
import {
  buildProjectNavGroups,
  findActiveProjectNavGroup,
  isProjectScopedView,
} from './project-nav'

function capabilitiesWith(modules: readonly ModuleId[]): Capabilities {
  const set = new Set<ModuleId>(modules)
  return {
    known: true,
    loading: false,
    can: () => true,
    showScreen: (moduleId) => moduleId === 'core' || set.has(moduleId),
    canFetch: () => true,
    isWindingDown: () => false,
  }
}

describe('navegação consolidada do projeto', () => {
  it('Início é o primeiro item do projeto e aponta para a tela home', () => {
    const groups = buildProjectNavGroups(capabilitiesWith([]), {
      hasProject: true,
      activeSprintNumber: null,
      projectModuleCount: 0,
    })
    expect(groups[0]).toEqual(
      expect.objectContaining({ id: 'home', label: 'Início', defaultView: 'home', tabs: [] }),
    )
    expect(findActiveProjectNavGroup(groups, 'home')?.id).toBe('home')
  })

  it('sem projeto não mostra Início', () => {
    const groups = buildProjectNavGroups(capabilitiesWith([]), {
      hasProject: false,
      activeSprintNumber: null,
      projectModuleCount: null,
    })
    expect(groups.some((group) => group.id === 'home')).toBe(false)
  })

  it('preset Simples mostra apenas Quadro e Configurações (2 itens)', () => {
    const groups = buildProjectNavGroups(capabilitiesWith([]), {
      hasProject: true,
      activeSprintNumber: null,
      projectModuleCount: 0,
    })
    expect(groups.map((group) => group.label)).toEqual(['Início', 'Quadro', 'Configurações'])
    expect(groups.every((group) => group.tabs.length === 0)).toBe(true)
  })

  it('Kanban com fluxo e métricas não introduz o termo Sprint no menu', () => {
    const groups = buildProjectNavGroups(capabilitiesWith(['flowMetrics']), {
      hasProject: true,
      activeSprintNumber: null,
      projectModuleCount: 2,
    })
    expect(groups.map((group) => group.label)).toEqual([
      'Início',
      'Quadro',
      'Métricas de fluxo',
      'Configurações',
    ])

    const withImpediments = buildProjectNavGroups(
      capabilitiesWith(['flowMetrics', 'impediments']),
      { hasProject: true, activeSprintNumber: null, projectModuleCount: 3 },
    )
    const flowGroup = withImpediments.find((group) => group.id === 'sprintsGroup')
    expect(flowGroup?.label).toBe('Fluxo')
    expect(flowGroup?.tabs.map((tab) => tab.label)).toEqual(['Métricas de fluxo', 'Impedimentos'])
  })

  it('Scrum completo consolida Backlog, Sprints (com abas internas) e Configurações', () => {
    const groups = buildProjectNavGroups(
      capabilitiesWith(['backlog', 'sprints', 'burndown', 'flowMetrics', 'impediments']),
      { hasProject: true, activeSprintNumber: 4, projectModuleCount: 5 },
    )
    expect(groups.map((group) => group.label)).toEqual([
      'Início',
      'Quadro',
      'Backlog',
      'Sprints',
      'Configurações',
    ])
    const sprintsGroup = groups.find((group) => group.id === 'sprintsGroup')!
    expect(sprintsGroup.count).toBe('S4')
    expect(sprintsGroup.tabs.map((tab) => tab.label)).toEqual([
      'Sprints',
      'Burndown',
      'Métricas de fluxo',
      'Impedimentos',
    ])
  })

  it('Entregas e Cronograma saem no rail do Fluxo Preditivo; Quadro e Sprints continuam em abas', () => {
    const groups = buildProjectNavGroups(
      capabilitiesWith(['wbs', 'risks', 'schedule', 'milestones', 'baseline', 'sprints']),
      { hasProject: true, activeSprintNumber: 4, projectModuleCount: 6 },
    )
    const byId = (id: string) => groups.find((group) => group.id === id)
    expect(byId('deliverablesGroup')?.predictive).toBe(true)
    expect(byId('scheduleGroup')?.predictive).toBe(true)
    expect(byId('sprintsGroup')?.predictive).toBeUndefined()
    expect(byId('board')?.predictive).toBeUndefined()
  })

  it('Tradicional consolida Entregas (com Riscos) e Cronograma (com Acompanhamento, Marcos e Linha de base)', () => {
    const groups = buildProjectNavGroups(
      capabilitiesWith(['wbs', 'risks', 'schedule', 'milestones', 'baseline']),
      { hasProject: true, activeSprintNumber: null, projectModuleCount: 5 },
    )
    expect(groups.map((group) => group.label)).toEqual([
      'Início',
      'Quadro',
      'Entregas',
      'Cronograma',
      'Configurações',
    ])
    expect(groups[2]?.tabs.map((tab) => tab.label)).toEqual(['Entregas (EAP)', 'Riscos'])
    expect(groups[3]?.tabs.map((tab) => tab.label)).toEqual([
      'Cronograma',
      'Acompanhamento',
      'Marcos',
      'Linha de base',
    ])
  })

  it('Híbrido completo exibe no máximo 6 sub-itens e inclui planSprint no grupo Entregas', () => {
    const groups = buildProjectNavGroups(
      capabilitiesWith([
        'backlog',
        'sprints',
        'burndown',
        'flowMetrics',
        'impediments',
        'wbs',
        'risks',
        'schedule',
        'milestones',
        'baseline',
      ]),
      { hasProject: true, activeSprintNumber: 2, projectModuleCount: 10 },
    )
    expect(groups).toHaveLength(7)
    expect(groups.map((group) => group.label)).toEqual([
      'Início',
      'Quadro',
      'Backlog',
      'Sprints',
      'Entregas',
      'Cronograma',
      'Configurações',
    ])
    const activeForPlanSprint = findActiveProjectNavGroup(groups, 'planSprint')
    expect(activeForPlanSprint?.id).toBe('deliverablesGroup')
  })

  it('itens isolados de Entregas e Cronograma exibem rótulo direto sem abas internas', () => {
    const onlyMilestones = buildProjectNavGroups(capabilitiesWith(['milestones']), {
      hasProject: true,
      activeSprintNumber: null,
      projectModuleCount: 1,
    })
    expect(onlyMilestones.map((group) => group.label)).toEqual([
      'Início',
      'Quadro',
      'Marcos',
      'Configurações',
    ])
    expect(onlyMilestones[2]?.tabs).toEqual([])

    const onlyWbs = buildProjectNavGroups(capabilitiesWith(['wbs']), {
      hasProject: true,
      activeSprintNumber: null,
      projectModuleCount: 1,
    })
    expect(onlyWbs.map((group) => group.label)).toEqual([
      'Início',
      'Quadro',
      'Entregas',
      'Configurações',
    ])
    expect(onlyWbs[2]?.tabs).toEqual([])
  })

  it('sem projeto selecionado omite telas por projeto e Configurações', () => {
    const groups = buildProjectNavGroups(
      capabilitiesWith([
        'backlog',
        'sprints',
        'burndown',
        'flowMetrics',
        'impediments',
        'wbs',
        'milestones',
        'schedule',
        'baseline',
        'risks',
      ]),
      { hasProject: false, activeSprintNumber: 4, projectModuleCount: 6 },
    )
    expect(groups.map((group) => group.label)).toEqual(['Quadro', 'Backlog', 'Sprints'])
    const sprintsGroup = groups.find((group) => group.id === 'sprintsGroup')!
    expect(sprintsGroup.count).toBeNull()
    expect(sprintsGroup.tabs.map((tab) => tab.id)).toEqual(['sprints', 'impediments'])
  })

  it('identifica corretamente quais telas pertencem a um projeto no breadcrumb', () => {
    expect(isProjectScopedView('projects')).toBe(true)
    expect(isProjectScopedView('modules')).toBe(true)
    expect(isProjectScopedView('planSprint')).toBe(true)
    expect(isProjectScopedView('dashboard')).toBe(false)
    expect(isProjectScopedView('updates')).toBe(false)
    expect(isProjectScopedView('agenda')).toBe(false)
    expect(isProjectScopedView('settings')).toBe(false)
    expect(isProjectScopedView('plugins')).toBe(false)
  })
})
