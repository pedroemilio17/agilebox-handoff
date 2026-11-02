import type { ExperienceLevel } from './experience-level'

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

export function isModuleId(value: string): value is ModuleId {
  return MODULE_IDS.some((id) => id === value)
}

export interface ModuleDefinition {
  readonly id: ModuleId
  /** Todas precisam estar ativas. */
  readonly requires: readonly ModuleId[]
  /** Pelo menos uma de cada grupo precisa estar ativa (ex.: burndown exige horas OU pontos). */
  readonly requiresAnyOf?: readonly (readonly ModuleId[])[]
  /** Duas ferramentas conflitantes nunca ficam ativas juntas. A relação é declarada nos dois lados. */
  readonly conflicts?: readonly ModuleId[]
  /** Nível mínimo das telas do módulo. */
  readonly minLevel: ExperienceLevel
  /** Núcleo: não pode ser desativado. */
  readonly core?: boolean
}

export interface ModuleChange {
  readonly enable?: readonly ModuleId[]
  readonly disable?: readonly ModuleId[]
}

export type ModuleResolution =
  | {
      readonly ok: true
      /** Conjunto final, na ordem do catálogo. */
      readonly enabled: readonly ModuleId[]
      /** Dependências puxadas automaticamente pela ativação (não pedidas explicitamente). */
      readonly autoEnabled: readonly ModuleId[]
    }
  | {
      readonly ok: false
      readonly conflicts: readonly (readonly [ModuleId, ModuleId])[]
      /**
       * Módulos que impedem a mudança: os dependentes que ficariam sem o que precisam
       * (inclusive em cascata) ou o próprio módulo cuja exigência não se cumpre.
       */
      readonly blockedBy: readonly ModuleId[]
    }
