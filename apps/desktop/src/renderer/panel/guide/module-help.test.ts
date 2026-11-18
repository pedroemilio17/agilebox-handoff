import { describe, expect, it } from 'vitest'
import type { ProjectModuleDto } from '@agilebox/contract'
import { EXPERIENCE_LABELS, moduleHelp } from './module-help'

function mod(id: string, state: ProjectModuleDto['state'] = 'active'): ProjectModuleDto {
  return {
    id,
    name: id,
    level: 1,
    objective: '',
    state,
    requires: [],
    enhances: [],
    config: null,
  }
}

describe('moduleHelp', () => {
  it('traz nome, nível, objetivo, por que existe e fluxo do manifesto', () => {
    const help = moduleHelp('backlog', [], 'sometimes')
    expect(help.name).toBe('Backlog')
    expect(help.levelLabel).toBe('N1 · essencial')
    expect(help.objective).toBe('Saber o que vem a seguir, em ordem.')
    expect(help.why).toBe(
      'Sem ordem, a equipe escolhe pelo que parece mais fácil. O backlog mostra o que vem a seguir.',
    )
    expect(help.flow).toEqual(['Listar', 'Ordenar', 'Levar ao quadro'])
  })

  it('usa o nome do manifesto quando ele difere do rótulo curto', () => {
    expect(moduleHelp('wbs', [], null).name).toBe('EAP (Entregas)')
    expect(moduleHelp('estimates.hours', [], null).name).toBe('Estimativa')
  })

  it('rótulos de nível N1, N2 e N3, e nenhum no núcleo', () => {
    expect(moduleHelp('wbs', [], null).levelLabel).toBe('N2 · intermediário')
    expect(moduleHelp('risks', [], null).levelLabel).toBe('N3 · avançado')
    expect(moduleHelp('core', [], null).levelLabel).toBeNull()
  })

  it('ordena os vínculos: requer, aproveita, alimenta', () => {
    // sprints requer backlog; backlog aproveita wbs; sprints aproveita estimates.hours
    const help = moduleHelp('sprints', [], 'always')
    const kinds = help.links.map((link) => link.kind)
    const firstAlimenta = kinds.indexOf('alimenta')
    const lastRequer = kinds.lastIndexOf('requer')
    const lastAproveita = kinds.lastIndexOf('aproveita')
    expect(lastRequer).toBeLessThan(kinds.indexOf('aproveita'))
    expect(lastAproveita).toBeLessThan(firstAlimenta)
    expect(help.links.find((link) => link.moduleId === 'backlog')?.kind).toBe('requer')
    expect(help.links.find((link) => link.moduleId === 'estimates.hours')?.kind).toBe('aproveita')
  })

  it('"alimenta" é calculado dos manifestos: quem requer ou aproveita este módulo', () => {
    const alimenta = moduleHelp('backlog', [], null)
      .links.filter((link) => link.kind === 'alimenta')
      .map((link) => link.moduleId)
    // sprints requer backlog (manifesto de sprints).
    expect(alimenta).toContain('sprints')
    expect(alimenta).not.toContain('backlog')
    // Ninguém requer ou aproveita o módulo de Plug-ins, então ele não alimenta nada.
    expect(moduleHelp('integrations', [], null).links.filter((l) => l.kind === 'alimenta')).toEqual(
      [],
    )
  })

  it('mostra Ligado só para módulos ativos; encerrando e ausentes contam como desligados', () => {
    const modules = [
      mod('backlog', 'active'),
      mod('wbs', 'winding_down'),
      mod('sprints', 'disabled'),
    ]
    const help = moduleHelp('sprints', modules, 'sometimes')
    const byId = Object.fromEntries(help.links.map((link) => [link.moduleId, link.on]))
    expect(byId.backlog).toBe(true)
    expect(moduleHelp('backlog', modules, null).links.find((l) => l.moduleId === 'wbs')?.on).toBe(
      false,
    )
    expect(moduleHelp('backlog', [], null).links.every((link) => !link.on)).toBe(true)
  })

  it('devolve a experiência do guia e os rótulos de cada valor', () => {
    expect(moduleHelp('backlog', [], 'always').experience).toBe('always')
    expect(moduleHelp('backlog', [], null).experience).toBeNull()
    expect(EXPERIENCE_LABELS).toEqual({
      never: 'Nunca',
      sometimes: 'Algumas vezes',
      always: 'Sempre',
    })
  })
})
