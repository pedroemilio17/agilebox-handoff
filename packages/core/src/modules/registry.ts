import { ValidationError } from '../shared/errors'
import type { ExperienceLevel } from './levels'

export const MODULE_IDS = [
  'core',
  'agenda',
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'estimates.points',
  'acceptance',
  'wip',
  'subtasks',
  'integrations',
  'flowMetrics',
  'reviewRetro',
  'burndown',
] as const

export type ModuleId = (typeof MODULE_IDS)[number]

/** Nome de cada ferramenta na interface (pt-BR), como aparece nos presets do PLANO-2.0. */
export const MODULE_LABELS: Readonly<Record<ModuleId, string>> = {
  core: 'Núcleo',
  agenda: 'Agenda',
  backlog: 'Backlog',
  sprints: 'Sprints',
  checkins: 'Check-ins',
  impediments: 'Impedimentos',
  'estimates.hours': 'Estimativas em horas',
  'estimates.points': 'Estimativas em pontos',
  acceptance: 'Critérios de aceitação',
  wip: 'Limites de WIP',
  subtasks: 'Subtarefas e dependências',
  integrations: 'Plug-ins',
  flowMetrics: 'Métricas de fluxo',
  reviewRetro: 'Review e retro',
  burndown: 'Burndown e velocity',
}

export interface ModuleDefinition {
  id: ModuleId
  /** Dependências diretas: todas precisam estar ativas. */
  requires: readonly ModuleId[]
  /**
   * Alternativas: basta uma delas estar satisfeita. Cada alternativa é uma lista de módulos
   * que precisam estar todos ativos. Ex.: burndown com [['estimates.hours'], ['estimates.points']]
   * exige horas OU pontos.
   */
  requiresAnyOf?: readonly (readonly ModuleId[])[]
  /** Módulos que não podem estar ativos junto com este. Deve ser simétrico. */
  conflicts?: readonly ModuleId[]
  /** Nível mínimo para as telas do módulo aparecerem. */
  minLevel: ExperienceLevel
  /** Só o núcleo é obrigatório e não pode ser desativado. */
  core?: boolean
}

/**
 * Catálogo inicial de módulos, copiado da proposta do PLANO-2.0 (o diagrama original não
 * está no repositório). Para mudar uma dependência, mude a linha correspondente aqui.
 */
const DEFINITIONS: readonly ModuleDefinition[] = [
  { id: 'core', requires: [], minLevel: 'basic', core: true },
  { id: 'agenda', requires: ['core'], minLevel: 'basic' },
  { id: 'backlog', requires: ['core'], minLevel: 'intermediate' },
  { id: 'sprints', requires: ['backlog'], minLevel: 'intermediate' },
  { id: 'checkins', requires: ['core'], minLevel: 'intermediate' },
  { id: 'impediments', requires: ['core'], minLevel: 'intermediate' },
  {
    id: 'estimates.hours',
    requires: ['core'],
    conflicts: ['estimates.points'],
    minLevel: 'intermediate',
  },
  {
    id: 'estimates.points',
    requires: ['core'],
    conflicts: ['estimates.hours'],
    minLevel: 'advanced',
  },
  { id: 'acceptance', requires: ['core'], minLevel: 'intermediate' },
  { id: 'wip', requires: ['core'], minLevel: 'advanced' },
  { id: 'subtasks', requires: ['core'], minLevel: 'advanced' },
  { id: 'integrations', requires: ['core'], minLevel: 'advanced' },
  { id: 'flowMetrics', requires: ['core'], minLevel: 'advanced' },
  { id: 'reviewRetro', requires: ['sprints', 'agenda'], minLevel: 'advanced' },
  {
    id: 'burndown',
    requires: ['sprints'],
    requiresAnyOf: [['estimates.hours'], ['estimates.points']],
    minLevel: 'advanced',
  },
]

function freezeDefinition(definition: ModuleDefinition): Readonly<ModuleDefinition> {
  return Object.freeze({
    ...definition,
    requires: Object.freeze([...definition.requires]),
    ...(definition.requiresAnyOf && {
      requiresAnyOf: Object.freeze(
        definition.requiresAnyOf.map((group) => Object.freeze([...group])),
      ),
    }),
    ...(definition.conflicts && { conflicts: Object.freeze([...definition.conflicts]) }),
  })
}

/** Catálogo somente leitura. */
export const MODULE_REGISTRY: readonly Readonly<ModuleDefinition>[] = Object.freeze(
  DEFINITIONS.map(freezeDefinition),
)

const DEFINITIONS_BY_ID: ReadonlyMap<ModuleId, Readonly<ModuleDefinition>> = new Map(
  MODULE_REGISTRY.map((definition) => [definition.id, definition]),
)

export function getModule(id: ModuleId): Readonly<ModuleDefinition> {
  const definition = DEFINITIONS_BY_ID.get(id)
  if (!definition) {
    throw new ValidationError('Módulo desconhecido')
  }
  return definition
}

/**
 * Procura um ciclo nas dependências (`requires` e `requiresAnyOf`). Conflitos ficam de fora:
 * são simétricos por definição e não definem ordem de ativação.
 * Devolve o caminho do ciclo, com o primeiro id repetido no fim, ou `null` se não há ciclo.
 * Ids referenciados que não estão em `definitions` são ignorados aqui; quem valida isso é o teste do catálogo.
 */
export function findDependencyCycle(
  definitions: readonly Pick<ModuleDefinition, 'id' | 'requires' | 'requiresAnyOf'>[],
): ModuleId[] | null {
  const edges = new Map<ModuleId, ModuleId[]>()
  for (const definition of definitions) {
    edges.set(definition.id, [...definition.requires, ...(definition.requiresAnyOf ?? []).flat()])
  }

  const visited = new Set<ModuleId>()
  const inProgress = new Set<ModuleId>()
  const path: ModuleId[] = []

  const visit = (id: ModuleId): ModuleId[] | null => {
    if (visited.has(id)) return null
    if (inProgress.has(id)) {
      return [...path.slice(path.indexOf(id)), id]
    }

    inProgress.add(id)
    path.push(id)
    for (const next of edges.get(id) ?? []) {
      if (!edges.has(next)) continue
      const cycle = visit(next)
      if (cycle) return cycle
    }
    path.pop()
    inProgress.delete(id)
    visited.add(id)
    return null
  }

  for (const definition of definitions) {
    const cycle = visit(definition.id)
    if (cycle) return cycle
  }
  return null
}
