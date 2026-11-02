import { ValidationError } from '../shared/errors'
import { MODULE_REGISTRY } from './registry'
import { MODULE_IDS, isModuleId } from './types'
import type { ModuleChange, ModuleId, ModuleResolution } from './types'

/**
 * Função pura: dado o conjunto de módulos ativos de um time e uma mudança, devolve o conjunto
 * final ou o motivo da recusa. Não toca em banco nem em tela.
 *
 * - Ativar puxa as dependências `requires` (viram `autoEnabled`).
 * - Desativar recusa se algum módulo ativo ficaria sem o que precisa, em cascata.
 * - Exigências `requiresAnyOf` não são puxadas: se nenhuma alternativa estiver ativa, recusa.
 * - Conflitos são recusados no conjunto final.
 * - `core` está sempre ativo.
 */
export function resolveModuleSet(
  current: readonly ModuleId[],
  change: ModuleChange,
): ModuleResolution {
  const enableIds = change.enable ?? []
  const disableIds = change.disable ?? []
  assertKnownIds([...current, ...enableIds, ...disableIds])

  if (enableIds.some((id) => disableIds.includes(id))) {
    throw new ValidationError('Um módulo não pode ser ativado e desativado na mesma mudança')
  }
  if (disableIds.includes('core')) {
    return { ok: false, conflicts: [], blockedBy: ['core'] }
  }

  const enabled = new Set<ModuleId>([...current, 'core'])
  const pulled = new Set<ModuleId>()
  for (const id of enableIds) {
    addWithRequirements(id, enabled, pulled)
  }
  for (const id of disableIds) {
    enabled.delete(id)
  }

  const blockedBy = removeUnsatisfied(enabled)
  const conflicts = findConflicts(enabled)

  if (blockedBy.length > 0 || conflicts.length > 0) {
    return { ok: false, conflicts, blockedBy }
  }

  const enabledInOrder = MODULE_IDS.filter((id) => enabled.has(id))
  const autoEnabled = MODULE_IDS.filter((id) => pulled.has(id) && !enableIds.includes(id))
  return { ok: true, enabled: enabledInOrder, autoEnabled }
}

function assertKnownIds(ids: readonly string[]): void {
  for (const id of ids) {
    if (!isModuleId(id)) {
      throw new ValidationError(`Módulo desconhecido: ${id}`)
    }
  }
}

function addWithRequirements(id: ModuleId, enabled: Set<ModuleId>, pulled: Set<ModuleId>): void {
  if (enabled.has(id)) return
  enabled.add(id)
  for (const requirement of MODULE_REGISTRY[id].requires) {
    if (!enabled.has(requirement)) {
      pulled.add(requirement)
    }
    addWithRequirements(requirement, enabled, pulled)
  }
}

/**
 * Remove, em cascata, os módulos cujas exigências deixaram de valer.
 * Devolve os removidos na ordem do catálogo.
 */
function removeUnsatisfied(enabled: Set<ModuleId>): ModuleId[] {
  const removed = new Set<ModuleId>()
  let changed = true
  while (changed) {
    changed = false
    for (const id of [...enabled]) {
      if (!isSatisfied(id, enabled)) {
        enabled.delete(id)
        removed.add(id)
        changed = true
      }
    }
  }
  return MODULE_IDS.filter((id) => removed.has(id))
}

function isSatisfied(id: ModuleId, enabled: ReadonlySet<ModuleId>): boolean {
  const definition = MODULE_REGISTRY[id]
  if (!definition.requires.every((requirement) => enabled.has(requirement))) {
    return false
  }
  return (definition.requiresAnyOf ?? []).every((group) =>
    group.some((alternative) => enabled.has(alternative)),
  )
}

function findConflicts(enabled: ReadonlySet<ModuleId>): [ModuleId, ModuleId][] {
  const active = MODULE_IDS.filter((id) => enabled.has(id))
  const conflicts: [ModuleId, ModuleId][] = []
  for (const [index, a] of active.entries()) {
    for (const b of active.slice(index + 1)) {
      if (MODULE_REGISTRY[a].conflicts?.includes(b) || MODULE_REGISTRY[b].conflicts?.includes(a)) {
        conflicts.push([a, b])
      }
    }
  }
  return conflicts
}
