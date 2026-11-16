import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toOrganizationId, toUserId } from '../shared/ids'
import { TEAM_PRESETS } from './presets'
import { MODULE_IDS } from './registry'
import type { ModuleId } from './registry'
import {
  applyTeamToolsUpdate,
  auditRecordsFor,
  createTeamToolsSettings,
  DEFAULT_TEAM_MODULE_IDS,
  defaultTeamTools,
  teamToolsUpdateFromPreset,
  toActiveModuleIds,
  validateTeamModuleSet,
} from './team-tools'
import { resolveModuleSet } from './resolve'
import type { ModuleState, TeamModuleSetting, TeamToolsSettings } from './team-tools'

const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const actorId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX')
const at = '2026-11-16T10:00:00.000Z'
const stamp = { organizationId, actorId, at }

function row(moduleId: ModuleId, state: ModuleState = 'active'): TeamModuleSetting {
  return { organizationId, moduleId, state, changedBy: null, changedAt: null }
}

function settingsOf(
  level: TeamToolsSettings['level'],
  entries: readonly [ModuleId, ModuleState][],
): TeamToolsSettings {
  return { level, modules: entries.map(([moduleId, state]) => row(moduleId, state)) }
}

/** Padrão transitório: todo o catálogo, menos estimates.points e integrations (ver team-tools.ts). */
const DEFAULT_IDS: ModuleId[] = [
  'core',
  'agenda',
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'acceptance',
  'wip',
  'subtasks',
  'flowMetrics',
  'reviewRetro',
  'burndown',
]

describe('estados e conjunto ativo', () => {
  it('conta active e winding_down como existentes e ignora disabled, em ordem do catálogo', () => {
    const ids = toActiveModuleIds([
      row('burndown', 'winding_down'),
      row('core'),
      row('wip', 'disabled'),
      row('agenda'),
    ])
    expect(ids).toEqual(['core', 'agenda', 'burndown'])
  })

  it('não repete módulo e devolve lista vazia quando tudo está desligado', () => {
    expect(toActiveModuleIds([row('core'), row('core')])).toEqual(['core'])
    expect(toActiveModuleIds([row('core', 'disabled')])).toEqual([])
  })
})

describe('validação do conjunto de ferramentas', () => {
  it('recusa conjunto sem o Núcleo ativo', () => {
    expect(() => validateTeamModuleSet([row('agenda')])).toThrow(ValidationError)
    expect(() => validateTeamModuleSet([row('core', 'disabled')])).toThrow('Núcleo')
  })

  it('recusa estimativa em horas e em pontos ativas juntas (conflito)', () => {
    expect(() =>
      validateTeamModuleSet([row('core'), row('estimates.hours'), row('estimates.points')]),
    ).toThrow(/estimates\.hours e estimates\.points/u)
  })

  it('recusa módulo ativo cuja dependência está desligada', () => {
    expect(() => validateTeamModuleSet([row('core'), row('sprints')])).toThrow(ValidationError)
    expect(() =>
      validateTeamModuleSet([row('core'), row('backlog', 'disabled'), row('sprints')]),
    ).toThrow(ValidationError)
  })

  it('aceita burndown com horas (alternativa satisfeita) e com pontos', () => {
    expect(() =>
      validateTeamModuleSet([
        row('core'),
        row('agenda'),
        row('backlog'),
        row('sprints'),
        row('estimates.hours'),
        row('burndown'),
      ]),
    ).not.toThrow()
    expect(() =>
      validateTeamModuleSet([
        row('core'),
        row('backlog'),
        row('sprints'),
        row('estimates.points'),
        row('burndown'),
      ]),
    ).not.toThrow()
  })

  it('recusa burndown sem nenhuma estimativa ativa', () => {
    expect(() =>
      validateTeamModuleSet([row('core'), row('backlog'), row('sprints'), row('burndown')]),
    ).toThrow(ValidationError)
  })

  it('aceita módulo em encerramento como existente para a dependência', () => {
    expect(() =>
      validateTeamModuleSet([row('core'), row('backlog', 'winding_down'), row('sprints')]),
    ).not.toThrow()
  })
})

describe('criação e normalização dos ajustes', () => {
  it('ordena pelo catálogo e aceita configuração JSON simples', () => {
    const settings = createTeamToolsSettings({
      level: 'intermediate',
      modules: [
        row('agenda'),
        { ...row('core') },
        { ...row('checkins'), config: { reminder: 'segunda', hours: [9, 10], extra: null } },
      ],
    })
    expect(settings.modules.map((module) => module.moduleId)).toEqual([
      'core',
      'agenda',
      'checkins',
    ])
    expect(settings.modules[2]?.config).toEqual({
      reminder: 'segunda',
      hours: [9, 10],
      extra: null,
    })
  })

  it('recusa nível desconhecido, módulo repetido e configuração que não é JSON simples', () => {
    expect(() =>
      createTeamToolsSettings({
        level: 'expert' as TeamToolsSettings['level'],
        modules: [row('core')],
      }),
    ).toThrow(ValidationError)
    expect(() =>
      createTeamToolsSettings({ level: 'basic', modules: [row('core'), row('core')] }),
    ).toThrow('repetida')
    expect(() =>
      createTeamToolsSettings({
        level: 'basic',
        modules: [{ ...row('core'), config: [1, 2] as unknown as Record<string, never> }],
      }),
    ).toThrow(ValidationError)
    expect(() =>
      createTeamToolsSettings({
        level: 'basic',
        modules: [
          { ...row('core'), config: { when: new Date() } as unknown as Record<string, never> },
        ],
      }),
    ).toThrow(ValidationError)
  })
})

describe('padrão e presets', () => {
  it('padrão sem linhas gravadas é todo o catálogo menos estimates.points e integrations, no nível Avançado, válido e sem autoria', () => {
    const settings = defaultTeamTools(organizationId)
    expect(settings.level).toBe('advanced')
    expect(settings.modules.map((module) => module.moduleId)).toEqual(DEFAULT_IDS)
    expect(DEFAULT_TEAM_MODULE_IDS).toEqual(DEFAULT_IDS)
    expect(settings.modules.every((module) => module.state === 'active')).toBe(true)
    expect(settings.modules.every((module) => module.changedBy === null)).toBe(true)
    expect(settings.modules.every((module) => module.changedAt === null)).toBe(true)
    expect(() => createTeamToolsSettings(settings)).not.toThrow()
  })

  it('padrão contém os recursos que já existem hoje (WIP, subtarefas, métricas, retro, burndown, backlog, sprints)', () => {
    const ids = defaultTeamTools(organizationId).modules.map((module) => module.moduleId)
    for (const id of [
      'wip',
      'subtasks',
      'flowMetrics',
      'reviewRetro',
      'burndown',
      'backlog',
      'sprints',
    ] as const) {
      expect(ids).toContain(id)
    }
  })

  it('padrão não contém estimates.points (conflita com horas) nem integrations (fora do MVP)', () => {
    const ids = defaultTeamTools(organizationId).modules.map((module) => module.moduleId)
    expect(ids).not.toContain('estimates.points')
    expect(ids).not.toContain('integrations')
    expect(ids).toContain('estimates.hours')
  })

  it('padrão passa pela validação de conjunto e pelo resolvedor de dependências sem erro', () => {
    const settings = defaultTeamTools(organizationId)
    expect(() => validateTeamModuleSet(settings.modules)).not.toThrow()
    const active = toActiveModuleIds(settings.modules)
    const resolution = resolveModuleSet([], { enable: active })
    expect(resolution.ok).toBe(true)
    if (resolution.ok) expect(resolution.autoEnabled).toEqual([])
  })

  it('cada preset do catálogo, aplicado sobre o Núcleo, dá um conjunto válido', () => {
    for (const preset of TEAM_PRESETS) {
      const update = teamToolsUpdateFromPreset(preset.id)
      const result = applyTeamToolsUpdate(settingsOf('basic', [['core', 'active']]), update, stamp)
      expect(toActiveModuleIds(result.settings.modules)).toEqual(
        MODULE_IDS.filter((id) => preset.modules.includes(id)),
      )
      expect(result.settings.level).toBe(preset.suggestedLevel)
    }
  })
})

describe('gravação de ajustes', () => {
  const current = defaultTeamTools(organizationId)

  it('desligar uma ferramenta gera uma diferença de estado com antes e depois', () => {
    const { settings, changes } = applyTeamToolsUpdate(
      current,
      { level: 'advanced', modules: [{ moduleId: 'impediments', state: 'disabled' }] },
      stamp,
    )
    expect(changes).toEqual([
      { kind: 'module_state', moduleId: 'impediments', before: 'active', after: 'disabled' },
    ])
    expect(settings.modules.find((module) => module.moduleId === 'impediments')).toMatchObject({
      state: 'disabled',
      changedBy: actorId,
      changedAt: at,
    })
  })

  it('carimba só as linhas que mudaram e mantém a autoria das demais', () => {
    const previousStamp = {
      changedBy: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAY'),
      changedAt: '2026-01-01T00:00:00.000Z',
    }
    const withHistory: TeamToolsSettings = {
      level: 'advanced',
      modules: current.modules.map((module) =>
        module.moduleId === 'agenda' ? { ...module, ...previousStamp } : module,
      ),
    }
    const { settings } = applyTeamToolsUpdate(
      withHistory,
      { level: 'advanced', modules: [{ moduleId: 'impediments', state: 'disabled' }] },
      stamp,
    )
    expect(settings.modules.find((module) => module.moduleId === 'agenda')).toMatchObject(
      previousStamp,
    )
  })

  it('pedido parcial deixa as demais ferramentas como estavam', () => {
    const { settings } = applyTeamToolsUpdate(
      current,
      { level: 'advanced', modules: [{ moduleId: 'burndown', state: 'disabled' }] },
      stamp,
    )
    expect(settings.modules).toHaveLength(DEFAULT_IDS.length)
    expect(settings.modules.find((module) => module.moduleId === 'sprints')?.state).toBe('active')
  })

  it('mudança de nível gera diferença de nível, mesmo sem mudança de ferramenta', () => {
    const { changes } = applyTeamToolsUpdate(current, { level: 'basic', modules: [] }, stamp)
    expect(changes).toEqual([{ kind: 'level', before: 'advanced', after: 'basic' }])
  })

  it('pedido sem mudança não gera diferença nem carimba nada', () => {
    const { settings, changes } = applyTeamToolsUpdate(
      current,
      { level: 'advanced', modules: [{ moduleId: 'agenda', state: 'active' }] },
      stamp,
    )
    expect(changes).toEqual([])
    expect(settings.modules.every((module) => module.changedBy === null)).toBe(true)
  })

  it('recusa o pedido inteiro quando o conjunto resultante é inválido', () => {
    expect(() =>
      applyTeamToolsUpdate(
        current,
        { level: 'advanced', modules: [{ moduleId: 'backlog', state: 'disabled' }] },
        stamp,
      ),
    ).toThrow(ValidationError)
  })

  it('recusa nível desconhecido, estado desconhecido e módulo fora do catálogo', () => {
    expect(() =>
      applyTeamToolsUpdate(current, { level: 'x' as 'basic', modules: [] }, stamp),
    ).toThrow(ValidationError)
    expect(() =>
      applyTeamToolsUpdate(
        current,
        { level: 'advanced', modules: [{ moduleId: 'wip', state: 'paused' as ModuleState }] },
        stamp,
      ),
    ).toThrow(ValidationError)
    expect(() =>
      applyTeamToolsUpdate(
        current,
        { level: 'advanced', modules: [{ moduleId: 'inexistente' as ModuleId, state: 'active' }] },
        stamp,
      ),
    ).toThrow(ValidationError)
  })

  it('recusa módulo repetido no pedido', () => {
    expect(() =>
      applyTeamToolsUpdate(
        current,
        {
          level: 'advanced',
          modules: [
            { moduleId: 'wip', state: 'active' },
            { moduleId: 'wip', state: 'disabled' },
          ],
        },
        stamp,
      ),
    ).toThrow('repetida')
  })

  it('winding_down aparece como mudança de estado e continua contando como existente', () => {
    const { settings, changes } = applyTeamToolsUpdate(
      current,
      { level: 'advanced', modules: [{ moduleId: 'sprints', state: 'winding_down' }] },
      stamp,
    )
    expect(changes).toEqual([
      { kind: 'module_state', moduleId: 'sprints', before: 'active', after: 'winding_down' },
    ])
    expect(toActiveModuleIds(settings.modules)).toContain('sprints')
  })

  it('gera registros de auditoria com ator, data, antes e depois', () => {
    const { changes } = applyTeamToolsUpdate(
      current,
      {
        level: 'basic',
        modules: [{ moduleId: 'burndown', state: 'disabled' }],
      },
      stamp,
    )
    expect(auditRecordsFor(changes, stamp)).toEqual([
      {
        organizationId,
        actorId,
        kind: 'level',
        moduleId: null,
        before: 'advanced',
        after: 'basic',
        createdAt: at,
      },
      {
        organizationId,
        actorId,
        kind: 'module_state',
        moduleId: 'burndown',
        before: 'active',
        after: 'disabled',
        createdAt: at,
      },
    ])
  })
})
