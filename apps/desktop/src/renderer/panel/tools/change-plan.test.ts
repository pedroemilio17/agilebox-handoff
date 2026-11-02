import { describe, expect, it } from 'vitest'
import { MODULE_IDS, type ModuleId } from '@agilebox/core'
import { planChanges } from './change-plan'
import type { ModuleStatusInput } from './tool-draft'

/** Estados do servidor: ativos pedidos, o resto desligado (núcleo sempre ativo). */
function statusesOf(active: readonly ModuleId[]): ModuleStatusInput[] {
  return MODULE_IDS.map((moduleId): ModuleStatusInput => ({
    moduleId,
    state: active.includes(moduleId) || moduleId === 'core' ? 'active' : 'disabled',
  }))
}

/** Estados do servidor com módulos encerrando (`winding_down`) além dos ativos. */
function statusesWith(
  active: readonly ModuleId[],
  winding: readonly ModuleId[],
): ModuleStatusInput[] {
  return MODULE_IDS.map((moduleId): ModuleStatusInput => {
    if (winding.includes(moduleId)) return { moduleId, state: 'winding_down' }
    const on = active.includes(moduleId) || moduleId === 'core'
    return { moduleId, state: on ? 'active' : 'disabled' }
  })
}

describe('planChanges: módulo encerrando na cascata (B1)', () => {
  it('desligar Sprints inclui Check-ins no plano: o servidor recusaria sem ele', () => {
    const plan = planChanges(statusesWith(['backlog', 'sprints'], ['checkins']), [
      'core',
      'backlog',
    ])

    expect(plan.disable).toEqual(['sprints', 'checkins'])
    expect(plan.disableRoots).toEqual(['sprints'])
    expect(plan.disableCascaded).toEqual(['checkins'])
  })

  it('módulo encerrando que não depende do que sai fica fora do plano (continua encerrando)', () => {
    const plan = planChanges(statusesWith(['agenda', 'backlog', 'sprints'], ['checkins']), [
      'core',
      'agenda',
      'backlog',
      'sprints',
    ])

    expect(plan.isEmpty).toBe(true)
    expect(plan.disable).toEqual([])
  })
})

describe('planChanges: diferença entre rascunho e servidor', () => {
  it('sem diferença, o plano está vazio', () => {
    const plan = planChanges(statusesOf(['agenda', 'backlog']), ['core', 'agenda', 'backlog'])

    expect(plan.isEmpty).toBe(true)
    expect(plan.enable).toEqual([])
    expect(plan.disable).toEqual([])
  })

  it('ligar Sprints puxa Backlog: Sprints é a escolha e Backlog entra por dependência', () => {
    const plan = planChanges(statusesOf([]), ['core', 'backlog', 'sprints'])

    expect(plan.enable).toEqual(['backlog', 'sprints'])
    expect(plan.enableRoots).toEqual(['sprints'])
    expect(plan.enablePulled).toEqual(['backlog'])
    expect(plan.disable).toEqual([])
  })

  it('desligar Backlog leva Sprints junto: Backlog é a escolha e Sprints sai por cascata', () => {
    const plan = planChanges(statusesOf(['backlog', 'sprints']), ['core'])

    expect(plan.disable).toEqual(['backlog', 'sprints'])
    expect(plan.disableRoots).toEqual(['backlog'])
    expect(plan.disableCascaded).toEqual(['sprints'])
    expect(plan.enable).toEqual([])
  })

  it('módulo sem cartão que sai com a mudança vira raiz do plano (não some)', () => {
    const plan = planChanges(statusesOf(['agenda', 'backlog', 'estimates.points']), [
      'core',
      'agenda',
      'backlog',
    ])

    expect(plan.disable).toEqual(['estimates.points'])
    expect(plan.disableRoots).toEqual(['estimates.points'])
  })

  it('lista sempre na ordem do catálogo', () => {
    const plan = planChanges(statusesOf(['integrations', 'agenda']), ['core', 'backlog'])

    expect(plan.disable).toEqual(['agenda', 'integrations'])
    expect(plan.enable).toEqual(['backlog'])
  })
})
