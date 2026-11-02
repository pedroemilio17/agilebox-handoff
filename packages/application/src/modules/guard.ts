import {
  canAcceptNewItems,
  canUseExistingItems,
  MODULE_IDS,
  MODULE_LABELS,
  ValidationError,
} from '@agilebox/core'
import type { ModuleId, ModuleState, OrganizationId } from '@agilebox/core'
import type { AppDeps } from '../deps'
import type { TeamModule } from '../ports'

/**
 * Módulos que um time ganha sem nunca ter gravado nada: núcleo e agenda, o que o time já tinha
 * antes de haver ferramentas. Não é um preset (os presets estão em `core`); só garante que a agenda
 * não some para times antigos.
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

/** Módulo do backlog (M3.5): ordem do time, levar ao quadro, devolver e criar no backlog. */
export const BACKLOG_MODULE: ModuleId = 'backlog'

/** Módulo de critérios de aceite (M3.6, B5 A: nível Avançado). Exige o Backlog (registro, M3.4). */
export const ACCEPTANCE_MODULE: ModuleId = 'acceptance'

/** Módulo de estimativa em horas (M3.7, ADR-07). Fica fora do preset Scrum (B6). */
export const ESTIMATES_HOURS_MODULE: ModuleId = 'estimates.hours'

/**
 * `new`: criar itens. Exige módulo ativo.
 * `existing`: ler, editar e excluir o que já existe. Aceita módulo encerrando; recusa só se desativado.
 */
export type ModuleAccess = 'new' | 'existing'

/** Estado efetivo de um módulo no time (desativado quando nunca foi gravado). Não recusa nada. */
export async function readModuleState(
  deps: AppDeps,
  organizationId: OrganizationId,
  moduleId: ModuleId,
): Promise<ModuleState> {
  const stored = await deps.unitOfWork.run(organizationId, ({ teamModules }) =>
    teamModules.list(organizationId),
  )
  return effectiveModuleStates(stored).get(moduleId) ?? 'disabled'
}

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
  const state = await readModuleState(deps, organizationId, moduleId)
  const allowed = access === 'new' ? canAcceptNewItems(state) : canUseExistingItems(state)
  if (allowed) return
  // Mensagem para a pessoa: nome da interface (MODULE_LABELS). Id fora do catálogo cai no próprio id.
  const name = Object.hasOwn(MODULE_LABELS, moduleId) ? MODULE_LABELS[moduleId] : moduleId
  if (state === 'disabled') {
    throw new ValidationError(`O módulo ${name} está desativado neste time`)
  }
  throw new ValidationError(`O módulo ${name} está encerrando e não aceita itens novos`)
}
