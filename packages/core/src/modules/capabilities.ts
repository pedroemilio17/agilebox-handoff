import { ValidationError } from '../shared/errors'
import type { UserRole } from '../values/role'
import { isAtLeastLevel } from './experience-level'
import type { ExperienceLevel } from './experience-level'
import { MODULE_REGISTRY } from './registry'
import { MODULE_IDS, isModuleId } from './types'
import type { ModuleId } from './types'

export interface EffectiveCapabilitiesInput {
  /** Módulos ativos no time (já resolvidos por `resolveModuleSet`). */
  readonly modules: readonly ModuleId[]
  readonly level: ExperienceLevel
  readonly role: UserRole
}

export interface EffectiveCapabilities {
  readonly role: UserRole
  readonly level: ExperienceLevel
  /**
   * Módulos efetivos, na ordem do catálogo. Efeitos passivos (ex.: "Sprint 4" no card) aparecem
   * para qualquer um destes, em qualquer nível.
   */
  readonly modules: readonly ModuleId[]
  /** Subconjunto de `modules` cujas telas aparecem: o nível da pessoa alcança `minLevel`. */
  readonly screens: readonly ModuleId[]
}

/**
 * Função pura: decide o que aparece para uma pessoa dentro de um time. Não concede permissão:
 * quem pode o quê continua em `policies/access-policy.ts`, e o `role` só é devolvido junto.
 *
 * - Módulo desativado não aparece em nenhum nível.
 * - Nível não ativa módulo: só filtra as telas.
 */
export function effectiveCapabilities(input: EffectiveCapabilitiesInput): EffectiveCapabilities {
  const received: readonly string[] = input.modules
  for (const id of received) {
    if (!isModuleId(id)) {
      throw new ValidationError(`Módulo desconhecido: ${id}`)
    }
  }

  const active = new Set<ModuleId>(input.modules)
  const modules = MODULE_IDS.filter((id) => active.has(id))
  const screens = modules.filter((id) => isAtLeastLevel(input.level, MODULE_REGISTRY[id].minLevel))

  return { role: input.role, level: input.level, modules, screens }
}
