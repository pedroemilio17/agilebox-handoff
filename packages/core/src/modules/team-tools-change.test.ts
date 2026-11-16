import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId, toUserId } from '../shared/ids'
import { canManageTeamTools } from '../policies/access-policy'
import { MODULE_IDS, MODULE_LABELS } from './registry'
import type { ModuleId } from './registry'
import {
  defaultTeamTools,
  moduleStateOf,
  applyTeamToolsUpdate,
  auditRecordsFor,
} from './team-tools'
import type { ModuleState, TeamToolsSettings } from './team-tools'
import { planCompleteWindDown, planModuleChange, planPreset } from './team-tools-change'
import { moduleImpact } from './team-tools-impact'
import type { TeamToolsUsage } from './team-tools-impact'

const organizationId = toOrganizationId('00000000000000000000000001')

/** Padrão de código (sem linhas gravadas) com alguns estados trocados. */
function settingsWith(states: Partial<Record<ModuleId, ModuleState>>): TeamToolsSettings {
  const base = defaultTeamTools(organizationId)
  return {
    level: base.level,
    modules: MODULE_IDS.map((moduleId) => ({
      organizationId,
      moduleId,
      state: states[moduleId] ?? moduleStateOf(base.modules, moduleId),
      changedBy: null,
      changedAt: null,
    })),
  }
}

function stateAfter(settings: TeamToolsSettings, plan: ReturnType<typeof planModuleChange>) {
  if (!plan.ok) throw new Error('o pedido deveria ser aceito')
  const next = new Map(settings.modules.map((module) => [module.moduleId, module.state]))
  for (const update of plan.updates) next.set(update.moduleId, update.state)
  return next
}

describe('ativar e desativar (regras 1 e 2)', () => {
  it('ativar Sprints sem Backlog ativa os dois e informa o aviso', () => {
    const settings = settingsWith({ backlog: 'disabled', sprints: 'disabled' })
    const plan = planModuleChange(settings, { enable: ['sprints'] })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.autoEnabled).toEqual(['backlog'])
    expect(plan.activated).toEqual(['backlog', 'sprints'])
    const after = stateAfter(settings, plan)
    expect(after.get('backlog')).toBe('active')
    expect(after.get('sprints')).toBe('active')
  })

  it('desligar Backlog com Sprints ativo é recusado e diz quem depende', () => {
    const plan = planModuleChange(settingsWith({}), { disable: ['backlog'] })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.reason).toBe('blocked_by_dependents')
    expect(plan.blockedBy).toEqual(['sprints'])
    expect(plan.dependents).toEqual([{ module: 'backlog', requiredBy: ['sprints'] }])
    expect(plan.message).toContain(MODULE_LABELS.sprints)
    expect(plan.message).toContain(MODULE_LABELS.backlog)
  })

  it('desligar Backlog junto com Sprints é aceito e os dois entram em encerramento', () => {
    // Revisão e retro e Burndown dependem de Sprints: sem eles desligados, o pedido seria recusado.
    const settings = settingsWith({ reviewRetro: 'disabled', burndown: 'disabled' })
    const plan = planModuleChange(settings, { disable: ['backlog', 'sprints'] })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.windingDown).toEqual(['backlog', 'sprints'])
    expect(plan.disabled).toEqual([])
  })

  it('horas e pontos juntos é recusado por conflito', () => {
    const plan = planModuleChange(settingsWith({ 'estimates.hours': 'active' }), {
      enable: ['estimates.points'],
    })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.reason).toBe('conflict')
    expect(plan.conflicts).toEqual([['estimates.hours', 'estimates.points']])
    expect(plan.message).toContain(MODULE_LABELS['estimates.hours'])
    expect(plan.message).toContain(MODULE_LABELS['estimates.points'])
  })

  it('o núcleo não pode ser desligado', () => {
    const plan = planModuleChange(settingsWith({}), { disable: ['core'] })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.reason).toBe('core_required')
  })

  it('ferramenta desconhecida no pedido é recusada com o id, sem gravar nada', () => {
    const plan = planModuleChange(settingsWith({}), {
      enable: ['inexistente'] as unknown as ModuleId[],
    })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.reason).toBe('unknown_module')
    expect(plan.unknownIds).toEqual(['inexistente'])
  })

  it('finalize só vale para o que está em disable', () => {
    expect(() => planModuleChange(settingsWith({}), { finalize: ['wip'] })).toThrow(ValidationError)
  })
})

describe('encerramento (winding_down) e reativação', () => {
  it('desligar entra em winding_down; finalize leva direto a disabled', () => {
    const settings = settingsWith({})
    const gradual = planModuleChange(settings, { disable: ['wip'] })
    const direct = planModuleChange(settings, { disable: ['wip'], finalize: ['wip'] })

    expect(gradual.ok && gradual.windingDown).toEqual(['wip'])
    expect(direct.ok && direct.disabled).toEqual(['wip'])
  })

  it('reativar uma ferramenta em encerramento a devolve a active, junto com o que ela exige', () => {
    const settings = settingsWith({ backlog: 'winding_down', sprints: 'winding_down' })
    const plan = planModuleChange(settings, { enable: ['sprints'] })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const after = stateAfter(settings, plan)
    expect(after.get('sprints')).toBe('active')
    expect(after.get('backlog')).toBe('active')
  })

  it('completeWindDown leva winding_down a disabled', () => {
    const settings = settingsWith({ wip: 'winding_down' })
    expect(planCompleteWindDown(settings, 'wip')).toEqual([{ moduleId: 'wip', state: 'disabled' }])
  })

  it('completeWindDown recusa ferramenta que não está encerrando', () => {
    expect(() => planCompleteWindDown(settingsWith({}), 'wip')).toThrow(ValidationError)
  })

  it('completeWindDown recusa enquanto outra ferramenta ligada ainda depende dela', () => {
    const settings = settingsWith({ backlog: 'winding_down' })
    expect(() => planCompleteWindDown(settings, 'backlog')).toThrow(/Sprints/)
  })
})

describe('presets', () => {
  it('aplicar Scrum liga as ferramentas dele e encerra as que saem', () => {
    const settings = settingsWith({ 'estimates.hours': 'disabled', wip: 'active' })
    const { request, suggestedLevel } = planPreset(settings, 'scrum')
    const plan = planModuleChange(settings, request)

    expect(suggestedLevel).toBe('intermediate')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.activated).toContain('estimates.hours')
    expect(plan.windingDown).toEqual(['wip', 'subtasks', 'flowMetrics', 'reviewRetro', 'burndown'])
  })
})

describe('contagem de impacto', () => {
  const usage: TeamToolsUsage = {
    subtasks: 3,
    openImpediments: 1,
    impediments: 2,
    wipLimits: 2,
    retroActions: 0,
    checkins: 1,
    meetings: 4,
    backlogItems: 5,
    acceptanceCriteria: 6,
    estimatedTasks: 7,
    openSprints: 2,
    sprintItems: 3,
  }

  it('usa o que o código consegue contar e zero para o que ainda não tem dados', () => {
    expect(moduleImpact('subtasks', usage)).toMatchObject({ count: 3 })
    expect(moduleImpact('impediments', usage)).toMatchObject({ count: 1 })
    expect(moduleImpact('impediments', usage).description).toBe(
      '1 impedimento aberto e 2 impedimentos registrados',
    )
    expect(moduleImpact('wip', usage)).toMatchObject({ count: 2 })
    expect(moduleImpact('reviewRetro', usage)).toMatchObject({ count: 0 })
    expect(moduleImpact('agenda', usage)).toMatchObject({ count: 4 })
    expect(moduleImpact('backlog', usage)).toMatchObject({ count: 5 })
    expect(moduleImpact('acceptance', usage)).toMatchObject({ count: 6 })
    expect(moduleImpact('estimates.hours', usage)).toMatchObject({ count: 7 })
    expect(moduleImpact('sprints', usage)).toMatchObject({ count: 5 })
    expect(moduleImpact('estimates.points', usage)).toMatchObject({ count: 0 })
  })

  it('frases em pt-BR no singular e no plural', () => {
    expect(moduleImpact('backlog', { ...usage, backlogItems: 1 }).description).toBe(
      '1 item de backlog',
    )
    expect(moduleImpact('backlog', usage).description).toBe('5 itens de backlog')
    expect(moduleImpact('acceptance', { ...usage, acceptanceCriteria: 1 }).description).toBe(
      '1 critério de aceitação em tarefa não arquivada',
    )
    expect(moduleImpact('estimates.hours', usage).description).toBe(
      '7 tarefas com estimativa em horas',
    )
  })

  it('sprints: frase com sprints não encerradas e itens em sprint, no singular e no plural', () => {
    expect(moduleImpact('sprints', usage).description).toBe(
      '2 sprints não encerradas e 3 itens em sprint',
    )
    expect(moduleImpact('sprints', { ...usage, openSprints: 1, sprintItems: 0 }).description).toBe(
      '1 sprint não encerrada e 0 itens em sprint',
    )
  })

  it('escreve no singular quando há um item', () => {
    expect(moduleImpact('checkins', usage).description).toBe('1 check-in gravado')
    expect(moduleImpact('subtasks', usage).description).toBe(
      '3 subtarefas em tarefas não arquivadas',
    )
  })
})

describe('auditoria de preset e papel', () => {
  it('aplicar um preset grava uma linha de auditoria do tipo preset, junto com as mudanças', () => {
    const settings = settingsWith({})
    const { request } = planPreset(settings, 'kanban')
    const plan = planModuleChange(settings, request)
    if (!plan.ok) throw new Error('o preset deveria ser aceito')

    const stamp = {
      organizationId,
      actorId: toUserId('00000000000000000000000002'),
      at: '2026-11-16T10:00:00.000Z',
    }
    const { changes } = applyTeamToolsUpdate(
      settings,
      { level: 'basic', modules: plan.updates, preset: 'kanban' },
      stamp,
    )
    const records = auditRecordsFor(changes, stamp)

    expect(records[0]).toMatchObject({ kind: 'preset', moduleId: null, after: 'kanban' })
    expect(records.some((record) => record.kind === 'level')).toBe(true)
  })

  it('só o gestor gerencia as ferramentas', () => {
    const base = { organizationId, userId: toUserId('00000000000000000000000002') }
    expect(canManageTeamTools({ ...base, role: 'manager' })).toBe(true)
    expect(canManageTeamTools({ ...base, role: 'collaborator' })).toBe(false)
  })
})
