import { effectiveCapabilities } from '@agilebox/core'
import { describe, expect, it } from 'vitest'
import { ALL_MODULES, presetModules } from '../testing/team-tools-fixture'
import { ALLOW_ALL, buildCapabilities } from './capabilities-context'

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
