import { describe, expect, it } from 'vitest'
import {
  effectiveCapabilities,
  hasCapability,
  moduleLevelWarning,
  shouldShowModuleScreen,
} from './capabilities'
import type { Capability, CapabilityInput } from './capabilities'
import { EXPERIENCE_LEVELS } from './levels'
import type { ExperienceLevel } from './levels'
import { MODULE_IDS } from './registry'
import type { ModuleId } from './registry'
import { TEAM_PRESETS } from './presets'
import type { TeamPresetId } from './presets'

const preset = (id: TeamPresetId) => {
  const found = TEAM_PRESETS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`preset ${id} inexistente`)
  return found
}

const KANBAN = preset('kanban').modules
const SCRUM = preset('scrum').modules
const SCRUM_COMPLETE = preset('scrum-complete').modules

/** Módulos do Scrum que não estão no Kanban simples. */
const SCRUM_ONLY = SCRUM.filter((id) => !KANBAN.includes(id))

function moduleCapabilities(list: readonly Capability[], id: ModuleId): Capability[] {
  return list.filter((capability) => capability.startsWith(`${id}:`))
}

describe('effectiveCapabilities: tabela por nível e preset', () => {
  it.each(EXPERIENCE_LEVELS)(
    'Kanban simples no nível %s só tem telas do Núcleo e da Agenda (basic)',
    (level) => {
      const list = effectiveCapabilities({ modules: KANBAN, level, role: 'collaborator' })
      expect(list).toContain('core:screen')
      expect(list).toContain('agenda:screen')
      for (const id of SCRUM_ONLY) {
        expect(moduleCapabilities(list, id)).toEqual([])
      }
    },
  )

  it('Kanban simples no Básico não vê nenhuma tela de Scrum', () => {
    const list = effectiveCapabilities({ modules: KANBAN, level: 'basic', role: 'manager' })
    for (const id of SCRUM_ONLY) {
      expect(hasCapability(list, `${id}:screen`)).toBe(false)
      expect(hasCapability(list, `${id}:passive`)).toBe(false)
    }
  })

  it('Scrum no Intermediário vê backlog, sprints, check-ins, impedimentos, estimativas e critérios', () => {
    const list = effectiveCapabilities({
      modules: SCRUM,
      level: 'intermediate',
      role: 'collaborator',
    })
    for (const id of [
      'backlog',
      'sprints',
      'checkins',
      'impediments',
      'estimates.hours',
      'acceptance',
    ] as const) {
      expect(hasCapability(list, `${id}:screen`), `${id}:screen`).toBe(true)
      expect(hasCapability(list, `${id}:advanced_fields`), `${id}:advanced_fields`).toBe(true)
    }
  })

  it('Scrum no Intermediário não ativa módulos avançados que a equipe não escolheu', () => {
    const list = effectiveCapabilities({
      modules: SCRUM,
      level: 'intermediate',
      role: 'collaborator',
    })
    for (const id of ['wip', 'subtasks', 'flowMetrics', 'burndown', 'reviewRetro'] as const) {
      expect(moduleCapabilities(list, id)).toEqual([])
    }
  })

  it('Scrum no Básico mantém só :passive dos módulos intermediários', () => {
    const list = effectiveCapabilities({ modules: SCRUM, level: 'basic', role: 'collaborator' })
    for (const id of SCRUM_ONLY) {
      expect(hasCapability(list, `${id}:passive`), `${id}:passive`).toBe(true)
      expect(hasCapability(list, `${id}:screen`), `${id}:screen`).toBe(false)
      expect(hasCapability(list, `${id}:advanced_fields`), `${id}:advanced_fields`).toBe(false)
    }
  })

  it('Scrum completo no Avançado vê as telas de todos os módulos ativos', () => {
    const list = effectiveCapabilities({
      modules: SCRUM_COMPLETE,
      level: 'advanced',
      role: 'manager',
    })
    for (const id of SCRUM_COMPLETE) {
      expect(hasCapability(list, `${id}:screen`), `${id}:screen`).toBe(true)
    }
  })

  it('Kanban com fluxo no Avançado ganha WIP, subtarefas e métricas de fluxo', () => {
    const list = effectiveCapabilities({
      modules: preset('kanban-flow').modules,
      level: 'advanced',
      role: 'collaborator',
    })
    for (const id of ['wip', 'subtasks', 'flowMetrics'] as const) {
      expect(hasCapability(list, `${id}:screen`)).toBe(true)
    }
    expect(moduleCapabilities(list, 'sprints')).toEqual([])
  })
})

describe('effectiveCapabilities: ferramentas por papel', () => {
  const base: Omit<CapabilityInput, 'role'> = { modules: KANBAN, level: 'basic' }

  it('colaborador não recebe tools:manage, mas vê tools:view', () => {
    const list = effectiveCapabilities({ ...base, role: 'collaborator' })
    expect(list).not.toContain('tools:manage')
    expect(list).toContain('tools:view')
  })

  it('gestor recebe tools:manage e tools:view', () => {
    const list = effectiveCapabilities({ ...base, role: 'manager' })
    expect(list).toContain('tools:manage')
    expect(list).toContain('tools:view')
  })

  it('papel não muda as capacidades dos módulos', () => {
    const asCollaborator = effectiveCapabilities({ ...base, role: 'collaborator' })
    const asManager = effectiveCapabilities({ ...base, role: 'manager' })
    expect(asManager.filter((c) => !c.startsWith('tools:'))).toEqual(
      asCollaborator.filter((c) => !c.startsWith('tools:')),
    )
  })
})

describe('effectiveCapabilities: regras do plano', () => {
  it('(a) módulo desativado não aparece em nenhum nível', () => {
    const active: readonly ModuleId[] = ['core', 'agenda']
    for (const level of EXPERIENCE_LEVELS) {
      const list = effectiveCapabilities({ modules: active, level, role: 'manager' })
      for (const id of MODULE_IDS) {
        if (active.includes(id)) continue
        expect(moduleCapabilities(list, id), `${id} no nível ${level}`).toEqual([])
      }
    }
  })

  it('(b) nível alto não ativa nada que a equipe não escolheu', () => {
    const list = effectiveCapabilities({
      modules: ['core'],
      level: 'advanced',
      role: 'manager',
    })
    expect(list).toEqual([
      'core:passive',
      'core:screen',
      'core:advanced_fields',
      'tools:view',
      'tools:manage',
    ])
  })

  it('(c) módulo ativo acima do nível da pessoa mantém só :passive', () => {
    const list = effectiveCapabilities({
      modules: ['sprints'],
      level: 'basic',
      role: 'collaborator',
    })
    expect(moduleCapabilities(list, 'sprints')).toEqual(['sprints:passive'])
  })

  it('(d) subir o nível acrescenta telas sem remover nada', () => {
    const steps: [ExperienceLevel, ExperienceLevel][] = [
      ['basic', 'intermediate'],
      ['intermediate', 'advanced'],
    ]
    for (const [lower, higher] of steps) {
      const before = effectiveCapabilities({
        modules: SCRUM_COMPLETE,
        level: lower,
        role: 'collaborator',
      })
      const after = effectiveCapabilities({
        modules: SCRUM_COMPLETE,
        level: higher,
        role: 'collaborator',
      })
      for (const capability of before) {
        expect(after, `${capability} sumiu de ${lower} para ${higher}`).toContain(capability)
      }
      expect(after.length).toBeGreaterThanOrEqual(before.length)
    }
  })

  it('(e) saída determinística, sem duplicatas e na ordem do catálogo', () => {
    const shuffled = effectiveCapabilities({
      modules: ['sprints', 'agenda', 'core', 'backlog', 'agenda'] as ModuleId[],
      level: 'intermediate',
      role: 'manager',
    })
    const sorted = effectiveCapabilities({
      modules: ['core', 'agenda', 'backlog', 'sprints'],
      level: 'intermediate',
      role: 'manager',
    })

    expect(shuffled).toEqual(sorted)
    expect(new Set(shuffled).size).toBe(shuffled.length)
    expect(shuffled).toEqual([
      'core:passive',
      'core:screen',
      'core:advanced_fields',
      'agenda:passive',
      'agenda:screen',
      'agenda:advanced_fields',
      'backlog:passive',
      'backlog:screen',
      'backlog:advanced_fields',
      'sprints:passive',
      'sprints:screen',
      'sprints:advanced_fields',
      'tools:view',
      'tools:manage',
    ])
  })

  it('(f) ids desconhecidos em modules são ignorados', () => {
    const withUnknown = effectiveCapabilities({
      modules: ['agenda', 'nao-existe' as ModuleId],
      level: 'basic',
      role: 'collaborator',
    })
    const withoutUnknown = effectiveCapabilities({
      modules: ['agenda'],
      level: 'basic',
      role: 'collaborator',
    })
    expect(withUnknown).toEqual(withoutUnknown)
    expect(withUnknown.some((c) => c.startsWith('nao-existe'))).toBe(false)
  })

  it('(g) core está sempre presente, mesmo se faltar em modules', () => {
    for (const level of EXPERIENCE_LEVELS) {
      const list = effectiveCapabilities({ modules: [], level, role: 'collaborator' })
      expect(hasCapability(list, 'core:passive')).toBe(true)
      expect(hasCapability(list, 'core:screen')).toBe(true)
    }
  })

  it('gera uma capacidade por tipo para cada módulo ativo, sem sobras', () => {
    const list = effectiveCapabilities({
      modules: MODULE_IDS,
      level: 'advanced',
      role: 'manager',
    })
    expect(list.length).toBe(MODULE_IDS.length * 3 + 2)
  })
})

describe('hasCapability e shouldShowModuleScreen', () => {
  it('hasCapability procura na lista', () => {
    const list = effectiveCapabilities({ modules: KANBAN, level: 'basic', role: 'collaborator' })
    expect(hasCapability(list, 'agenda:screen')).toBe(true)
    expect(hasCapability(list, 'sprints:screen')).toBe(false)
  })

  it('shouldShowModuleScreen segue a regra de :screen', () => {
    const input: CapabilityInput = { modules: SCRUM, level: 'basic', role: 'collaborator' }
    expect(shouldShowModuleScreen(input, 'core')).toBe(true)
    expect(shouldShowModuleScreen(input, 'agenda')).toBe(true)
    expect(shouldShowModuleScreen(input, 'sprints')).toBe(false)

    const intermediate: CapabilityInput = { ...input, level: 'intermediate' }
    expect(shouldShowModuleScreen(intermediate, 'sprints')).toBe(true)
    expect(shouldShowModuleScreen(intermediate, 'wip')).toBe(false)
  })
})

describe('moduleLevelWarning', () => {
  it('Scrum no Básico lista os módulos intermediários ativos, em ordem do catálogo', () => {
    expect(moduleLevelWarning({ modules: SCRUM, level: 'basic' })).toEqual([
      { module: 'backlog', requiredLevel: 'intermediate' },
      { module: 'sprints', requiredLevel: 'intermediate' },
      { module: 'checkins', requiredLevel: 'intermediate' },
      { module: 'impediments', requiredLevel: 'intermediate' },
      { module: 'estimates.hours', requiredLevel: 'intermediate' },
      { module: 'acceptance', requiredLevel: 'intermediate' },
    ])
  })

  it('Scrum no Básico avisa sobre os módulos avançados do Scrum completo', () => {
    const warnings = moduleLevelWarning({ modules: SCRUM_COMPLETE, level: 'intermediate' })
    expect(warnings).toEqual([
      { module: 'reviewRetro', requiredLevel: 'advanced' },
      { module: 'burndown', requiredLevel: 'advanced' },
    ])
  })

  it('não avisa quando o nível alcança todos os módulos ativos', () => {
    expect(moduleLevelWarning({ modules: SCRUM_COMPLETE, level: 'advanced' })).toEqual([])
  })

  it('não avisa sobre módulos desativados, mesmo com nível baixo', () => {
    expect(moduleLevelWarning({ modules: KANBAN, level: 'basic' })).toEqual([])
  })

  it('ignora ids desconhecidos e sempre considera o núcleo', () => {
    const warnings = moduleLevelWarning({
      modules: ['nao-existe' as ModuleId],
      level: 'basic',
    })
    expect(warnings).toEqual([])
  })
})
