import { canAcceptNewItems, canUseExistingItems, MODULE_IDS, ValidationError } from '@agilebox/core'
import type { ModuleId, ModuleState, OrganizationId } from '@agilebox/core'
import type { AppDeps } from '../deps'
import type { TeamModule } from '../ports'

/**
 * Módulos que um time ganha sem nunca ter gravado nada (preset "Kanban simples": núcleo e agenda).
 * É o que o time já tinha antes de haver ferramentas, então a agenda não some para times antigos.
 */
const DEFAULT_ACTIVE_MODULES: readonly ModuleId[] = ['core', 'agenda']

/** Estado de cada módulo como o time o vê, na ordem do catálogo. */
export function effectiveModuleStates(
  stored: readonly TeamModule[],
): ReadonlyMap<ModuleId, ModuleState> {
  const states = new Map<ModuleId, ModuleState>(
    MODULE_IDS.map((moduleId) => [
      moduleId,
      DEFAULT_ACTIVE_MODULES.includes(moduleId) ? 'active' : 'disabled',
    ]),
  )
  for (const teamModule of stored) states.set(teamModule.moduleId, teamModule.state)
  return states
}

/**
 * `new`: criar itens. Exige módulo ativo.
 * `existing`: ler, editar e excluir o que já existe. Aceita módulo encerrando; recusa só se desativado.
 */
export type ModuleAccess = 'new' | 'existing'

/**
 * Guard de módulo (M1.8). Lê o estado do módulo no time e recusa com `ValidationError` quando o
 * uso não é permitido. Vale para todos os papéis: nem o gestor usa módulo desativado.
 */
export async function requireModuleAccess(
  deps: AppDeps,
  organizationId: OrganizationId,
  moduleId: ModuleId,
  access: ModuleAccess,
): Promise<void> {
  const stored = await deps.unitOfWork.run(organizationId, ({ teamModules }) =>
    teamModules.list(organizationId),
  )
  const state = effectiveModuleStates(stored).get(moduleId) ?? 'disabled'
  const allowed = access === 'new' ? canAcceptNewItems(state) : canUseExistingItems(state)
  if (allowed) return
  if (state === 'disabled') {
    throw new ValidationError(`O módulo ${moduleId} está desativado neste time`)
  }
  throw new ValidationError(`O módulo ${moduleId} está encerrando e não aceita itens novos`)
}
