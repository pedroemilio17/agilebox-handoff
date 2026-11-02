import { isAtLeastLevel } from './experience-level'
import type { ExperienceLevel } from './experience-level'
import type { ModuleId } from './types'

/**
 * Campos da tarefa por nível de experiência (handoff M2, decisão 3; PROGRESS_2.md, M2.5).
 * - Essencial: título, estado, prazo.
 * - Padrão: + responsáveis, estimativa, linha do tempo, e os campos avançados recolhidos.
 * - Avançado: + custo por hora, dependências, critérios de aceite, etiquetas, sempre visíveis.
 */
export const TASK_FIELD_IDS = [
  'title',
  'status',
  'due',
  'assignees',
  'estimate',
  'timeline',
  'hourlyCost',
  'dependencies',
  'acceptanceCriteria',
  'labels',
] as const

export type TaskFieldId = (typeof TASK_FIELD_IDS)[number]

export interface TaskFieldDefinition {
  readonly id: TaskFieldId
  /** Nível mínimo em que o campo aparece (ao menos recolhido, no caso do Padrão). */
  readonly minLevel: ExperienceLevel
  /** Ferramenta de que o campo depende. Com ela desligada, o campo some em qualquer nível. */
  readonly module?: ModuleId
}

/** Ordem de exibição do catálogo de campos. */
export const TASK_FIELDS: readonly TaskFieldDefinition[] = [
  { id: 'title', minLevel: 'basic' },
  { id: 'status', minLevel: 'basic' },
  { id: 'due', minLevel: 'basic' },
  { id: 'assignees', minLevel: 'intermediate' },
  { id: 'estimate', minLevel: 'intermediate', module: 'estimates.hours' },
  { id: 'timeline', minLevel: 'intermediate' },
  { id: 'hourlyCost', minLevel: 'advanced' },
  { id: 'dependencies', minLevel: 'advanced' },
  { id: 'acceptanceCriteria', minLevel: 'advanced', module: 'acceptance' },
  { id: 'labels', minLevel: 'advanced' },
]

export interface TaskFieldLayout {
  readonly level: ExperienceLevel
  /** Campos mostrados direto, na ordem do catálogo. */
  readonly visible: readonly TaskFieldId[]
  /** Campos avançados dentro de "Campos avançados", recolhido. Só existe no nível Padrão. */
  readonly collapsed: readonly TaskFieldId[]
}

/**
 * Função pura: diz quais campos da tarefa aparecem para um nível, dados os módulos ativos do time.
 * Só muda visibilidade: nada é apagado, então subir de nível não perde dado.
 */
export function taskFieldLayout(
  level: ExperienceLevel,
  modules: readonly ModuleId[],
): TaskFieldLayout {
  const active = new Set<ModuleId>(modules)
  const available = (field: TaskFieldDefinition) =>
    field.module === undefined || active.has(field.module)

  const visible = TASK_FIELDS.filter(
    (field) => isAtLeastLevel(level, field.minLevel) && available(field),
  ).map((field) => field.id)

  const collapsed =
    level === 'intermediate'
      ? TASK_FIELDS.filter((field) => field.minLevel === 'advanced' && available(field)).map(
          (field) => field.id,
        )
      : []

  return { level, visible, collapsed }
}
