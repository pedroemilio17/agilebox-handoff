import { MODULE_IDS } from './types'
import type { ModuleDefinition, ModuleId } from './types'

/**
 * Catálogo fixo de ferramentas (plano 2.0, seção "Camada nova: ferramentas da equipe").
 * Arestas que não aparecem no texto do plano (o diagrama é imagem) estão marcadas com "inferido":
 * conferir com o diagrama antes de liberar o M2.
 */
export const MODULE_REGISTRY: Readonly<Record<ModuleId, ModuleDefinition>> = {
  core: { id: 'core', requires: [], minLevel: 'basic', core: true },
  agenda: { id: 'agenda', requires: [], minLevel: 'basic' },
  backlog: { id: 'backlog', requires: [], minLevel: 'intermediate' },
  sprints: { id: 'sprints', requires: ['backlog'], minLevel: 'intermediate' },
  // inferido: check-ins e impedimentos existem para acompanhar a sprint
  checkins: { id: 'checkins', requires: ['sprints'], minLevel: 'intermediate' },
  impediments: { id: 'impediments', requires: ['sprints'], minLevel: 'intermediate' },
  'estimates.hours': {
    id: 'estimates.hours',
    requires: [],
    conflicts: ['estimates.points'],
    minLevel: 'intermediate',
  },
  // Só entra em teste de conflito até o ADR-07 mudar (pontos é módulo futuro).
  'estimates.points': {
    id: 'estimates.points',
    requires: [],
    conflicts: ['estimates.hours'],
    minLevel: 'intermediate',
  },
  // inferido: critérios de aceitação são de itens do backlog (M3)
  acceptance: { id: 'acceptance', requires: ['backlog'], minLevel: 'intermediate' },
  wip: { id: 'wip', requires: [], minLevel: 'advanced' },
  subtasks: { id: 'subtasks', requires: [], minLevel: 'advanced' },
  // inferido: nível mínimo não aparece no plano; Avançado por não estar em preset básico
  integrations: { id: 'integrations', requires: [], minLevel: 'advanced' },
  flowMetrics: { id: 'flowMetrics', requires: [], minLevel: 'advanced' },
  // inferido: retro acontece ao fim da sprint
  reviewRetro: { id: 'reviewRetro', requires: ['sprints'], minLevel: 'advanced' },
  burndown: {
    id: 'burndown',
    requires: ['sprints'],
    requiresAnyOf: [['estimates.hours', 'estimates.points']],
    minLevel: 'advanced',
  },
}

/** Dependências diretas de um módulo: `requires` e todas as alternativas de `requiresAnyOf`. */
export function dependenciesOf(definition: ModuleDefinition): ModuleId[] {
  return [...definition.requires, ...(definition.requiresAnyOf ?? []).flat()]
}

/**
 * Devolve um ciclo de dependências (ex.: ['a', 'b', 'a']) ou null se o registro for acíclico.
 */
export function findDependencyCycle(
  registry: Readonly<Record<ModuleId, ModuleDefinition>>,
): ModuleId[] | null {
  const state = new Map<ModuleId, 'visiting' | 'done'>()
  const path: ModuleId[] = []

  const visit = (id: ModuleId): ModuleId[] | null => {
    const known = state.get(id)
    if (known === 'done') return null
    if (known === 'visiting') return [...path.slice(path.indexOf(id)), id]

    state.set(id, 'visiting')
    path.push(id)
    for (const dependency of dependenciesOf(registry[id])) {
      const cycle = visit(dependency)
      if (cycle) return cycle
    }
    path.pop()
    state.set(id, 'done')
    return null
  }

  for (const id of MODULE_IDS) {
    const cycle = visit(id)
    if (cycle) return cycle
  }
  return null
}
