import { effectiveCapabilities } from '@agilebox/core'
import { describe, expect, it } from 'vitest'
import { ALL_MODULES, presetModules } from '../testing/team-tools-fixture'
import { ALLOW_ALL, buildCapabilities, moduleStatesOf } from './capabilities-context'
import type { ModuleScope } from './capabilities-context'

describe('buildCapabilities', () => {
  it('sem lista (carregando ou erro) trata tudo como permitido e marca como não conhecido', () => {
    const capabilities = buildCapabilities(undefined)

    expect(capabilities).toBe(ALLOW_ALL)
    expect(capabilities.known).toBe(false)
    expect(capabilities.can('impediments:passive')).toBe(true)
    expect(capabilities.showScreen('agenda')).toBe(true)
  })

  it('enquanto carrega, a tela segue permissiva mas não pede dados de módulo', () => {
    const capabilities = buildCapabilities(undefined, true)

    expect(capabilities.loading).toBe(true)
    expect(capabilities.can('wip:screen')).toBe(true)
    expect(capabilities.canFetch('flowMetrics:screen')).toBe(false)
  })

  it('erro (sem lista e fora do carregamento) segue permissivo e pode buscar', () => {
    const capabilities = buildCapabilities(undefined, false)

    expect(capabilities.loading).toBe(false)
    expect(capabilities.canFetch('flowMetrics:screen')).toBe(true)
  })

  it('com lista, só libera o que está nela', () => {
    const capabilities = buildCapabilities(['core:passive', 'core:screen'])

    expect(capabilities.known).toBe(true)
    expect(capabilities.can('core:screen')).toBe(true)
    expect(capabilities.can('impediments:passive')).toBe(false)
    expect(capabilities.showScreen('agenda')).toBe(false)
  })

  it('lista vazia esconde os módulos sem quebrar a leitura', () => {
    const capabilities = buildCapabilities([])

    expect(capabilities.known).toBe(true)
    expect(capabilities.can('wip:screen')).toBe(false)
    expect(capabilities.showScreen('wip')).toBe(false)
  })

  it('showScreen consulta a capacidade `:screen` do módulo', () => {
    const capabilities = buildCapabilities(['agenda:passive', 'agenda:screen'])

    expect(capabilities.showScreen('agenda')).toBe(true)
    expect(capabilities.showScreen('reviewRetro')).toBe(false)
  })
})

describe('ferramenta em encerramento', () => {
  it('a leitura marca o módulo como encerrando e nada além dele; sem a lista, ninguém encerra', () => {
    const granted = buildCapabilities(['backlog:screen', 'core:screen'], false, ['backlog'])
    expect(granted.isWindingDown('backlog')).toBe(true)
    expect(granted.isWindingDown('acceptance')).toBe(false)
    expect(granted.showScreen('backlog')).toBe(true)
    expect(ALLOW_ALL.isWindingDown('backlog')).toBe(false)
    expect(buildCapabilities(undefined, true).isWindingDown('backlog')).toBe(false)
  })
})

describe('capacidades do servidor por nível e ferramentas', () => {
  it('nível abaixo do mínimo deixa só o efeito passivo do módulo ativo', () => {
    const capabilities = buildCapabilities(
      effectiveCapabilities({
        modules: presetModules('scrum'),
        level: 'basic',
        role: 'collaborator',
      }),
    )

    expect(capabilities.can('impediments:passive')).toBe(true)
    expect(capabilities.can('impediments:screen')).toBe(false)
    expect(capabilities.can('impediments:advanced_fields')).toBe(false)
    expect(capabilities.can('wip:passive')).toBe(false)
  })

  it('nível abaixo do mínimo não esconde a tela: o módulo ativo segue na barra (ADR-10)', () => {
    const capabilities = buildCapabilities(
      effectiveCapabilities({
        modules: presetModules('scrum'),
        level: 'basic',
        role: 'collaborator',
      }),
    )

    expect(capabilities.showScreen('impediments')).toBe(true)
    expect(capabilities.showScreen('sprints')).toBe(true)
  })

  it('módulo desligado não tem nenhum efeito, nem passivo', () => {
    const capabilities = buildCapabilities(
      effectiveCapabilities({ modules: ['core'], level: 'advanced', role: 'manager' }),
    )

    expect(capabilities.can('impediments:passive')).toBe(false)
    expect(capabilities.can('impediments:screen')).toBe(false)
    expect(capabilities.can('subtasks:passive')).toBe(false)
  })

  it('subir o nível só acrescenta capacidades', () => {
    const basic = effectiveCapabilities({ modules: ALL_MODULES, level: 'basic', role: 'manager' })
    const advanced = effectiveCapabilities({
      modules: ALL_MODULES,
      level: 'advanced',
      role: 'manager',
    })

    expect(basic.filter((capability) => !advanced.includes(capability))).toEqual([])
    expect(advanced.length).toBeGreaterThan(basic.length)
  })
})

/** Escopo de um projeto (ou da organização) com os módulos dados; os demais contam como desligados. */
function scopeWith(
  states: Record<string, 'active' | 'winding_down' | 'disabled'>,
  level: ModuleScope['level'] = 'advanced',
): ModuleScope {
  return {
    modules: moduleStatesOf(Object.entries(states).map(([id, state]) => ({ id, state }))),
    level,
  }
}

describe('visibilidade pelo projeto selecionado (ADR-10)', () => {
  it('tela segue o estado do módulo no projeto, e o núcleo está sempre visível', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen', 'sprints:passive', 'sprints:screen'],
      false,
      [],
      scopeWith({ sprints: 'active', backlog: 'disabled' }),
    )

    expect(capabilities.showScreen('sprints')).toBe(true)
    expect(capabilities.showScreen('backlog')).toBe(false)
    expect(capabilities.showScreen('core')).toBe(true)
  })

  it('o módulo do projeto vale mesmo quando a equipe não o tem', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen'],
      false,
      [],
      scopeWith({ sprints: 'active' }),
    )

    expect(capabilities.showScreen('sprints')).toBe(true)
    expect(capabilities.canFetch('sprints:screen')).toBe(true)
  })

  it('o módulo da equipe não vale quando o projeto o desliga', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen', 'sprints:passive', 'sprints:screen'],
      false,
      [],
      scopeWith({ sprints: 'disabled' }),
    )

    expect(capabilities.showScreen('sprints')).toBe(false)
    expect(capabilities.canFetch('sprints:screen')).toBe(false)
    expect(capabilities.can('sprints:passive')).toBe(false)
  })

  it('encerrando: a tela e o efeito passivo seguem, e isWindingDown marca o módulo', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen', 'backlog:passive', 'backlog:screen'],
      false,
      [],
      scopeWith({ backlog: 'winding_down' }),
    )

    expect(capabilities.showScreen('backlog')).toBe(true)
    expect(capabilities.can('backlog:passive')).toBe(true)
    expect(capabilities.isWindingDown('backlog')).toBe(true)
    expect(capabilities.isWindingDown('sprints')).toBe(false)
  })

  it('o nível não esconde tela: no Básico a tela aparece, e ação e campo avançado seguem o nível', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen', 'impediments:passive'],
      false,
      [],
      scopeWith({ impediments: 'active' }, 'basic'),
    )

    expect(capabilities.showScreen('impediments')).toBe(true)
    expect(capabilities.can('impediments:passive')).toBe(true)
    expect(capabilities.can('impediments:screen')).toBe(false)
    expect(capabilities.canFetch('impediments:screen')).toBe(false)
    expect(capabilities.can('impediments:advanced_fields')).toBe(false)
  })

  it('o nível do escopo libera ação e campo avançado a partir do mínimo do módulo', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen', 'impediments:passive', 'impediments:advanced_fields'],
      false,
      [],
      scopeWith({ impediments: 'active' }, 'intermediate'),
    )

    expect(capabilities.can('impediments:screen')).toBe(true)
    expect(capabilities.can('impediments:advanced_fields')).toBe(true)
  })

  it('ferramentas (tools:*) seguem a lista da equipe, mesmo com escopo de projeto', () => {
    const withManage = buildCapabilities(
      ['core:passive', 'core:screen', 'tools:view', 'tools:manage'],
      false,
      [],
      scopeWith({}),
    )
    const viewOnly = buildCapabilities(
      ['core:passive', 'core:screen', 'tools:view'],
      false,
      [],
      scopeWith({}),
    )

    expect(withManage.can('tools:manage')).toBe(true)
    expect(viewOnly.can('tools:manage')).toBe(false)
    expect(viewOnly.can('tools:view')).toBe(true)
  })

  it('o escopo é a fonte: a lista de encerramento da equipe não vale junto', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen', 'backlog:passive', 'backlog:screen'],
      false,
      ['backlog'],
      scopeWith({ backlog: 'active' }),
    )

    expect(capabilities.isWindingDown('backlog')).toBe(false)
  })
})

describe('visibilidade pela organização (sem projeto selecionado)', () => {
  it('com escopo da organização, vale o estado agregado dos módulos', () => {
    const capabilities = buildCapabilities(
      ['core:passive', 'core:screen'],
      false,
      [],
      scopeWith({ sprints: 'winding_down' }),
    )

    expect(capabilities.showScreen('sprints')).toBe(true)
    expect(capabilities.isWindingDown('sprints')).toBe(true)
    expect(capabilities.showScreen('agenda')).toBe(false)
  })

  it('sem escopo, a equipe segue valendo: a tela aparece com o passivo, sem o nível', () => {
    const capabilities = buildCapabilities(['core:passive', 'agenda:passive'], false, [])

    expect(capabilities.showScreen('agenda')).toBe(true)
    expect(capabilities.can('agenda:screen')).toBe(false)
  })
})

describe('carregamento e erro com escopo', () => {
  it('carregando (sem lista da equipe) é permissivo e não pede dados de módulo', () => {
    const capabilities = buildCapabilities(undefined, true, [], scopeWith({}))

    expect(capabilities.loading).toBe(true)
    expect(capabilities.showScreen('sprints')).toBe(true)
    expect(capabilities.canFetch('sprints:screen')).toBe(false)
  })

  it('erro sem lista da equipe cai em ALLOW_ALL, mesmo com escopo', () => {
    expect(buildCapabilities(undefined, false, [], scopeWith({}))).toBe(ALLOW_ALL)
  })
})

describe('moduleStatesOf', () => {
  it('converte a lista em mapa de estados, e módulo ausente conta como desligado', () => {
    const states = moduleStatesOf([
      { id: 'sprints', state: 'active' },
      { id: 'backlog', state: 'winding_down' },
    ])

    expect(states.sprints).toBe('active')
    expect(states.backlog).toBe('winding_down')
    expect(states.agenda).toBeUndefined()
  })
})
