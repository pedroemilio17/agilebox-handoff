import { getModule, MODULE_IDS } from './registry'
import type { ModuleDefinition, ModuleId } from './registry'

/** Pedido de mudança: o que ligar e o que desligar. Módulos já no estado pedido são ignorados. */
export interface ModuleChange {
  enable?: readonly ModuleId[]
  disable?: readonly ModuleId[]
}

/**
 * Motivo da recusa.
 * - `unknown_module`: id fora do catálogo no pedido (`unknownIds`).
 * - `conflicting_request`: o mesmo módulo pedido para ligar e desligar, ou ligar um módulo
 *   que exige outro que o pedido manda desligar.
 * - `core_required`: tentativa de desligar o núcleo.
 * - `conflict`: depois da mudança, dois módulos em conflito ficariam ativos juntos.
 * - `blocked_by_dependents`: desligar deixaria módulos ativos sem a dependência.
 */
export type ResolutionReason =
  'unknown_module' | 'conflicting_request' | 'core_required' | 'conflict' | 'blocked_by_dependents'

/** Módulo desligado e os módulos ativos que o exigiam (só os que não estão sendo desligados). */
export interface DependentsOfModule {
  module: ModuleId
  requiredBy: ModuleId[]
}

export type Resolution =
  | {
      ok: true
      /** Conjunto final, em ordem do catálogo `MODULE_IDS`, sem duplicatas, sempre com `core`. */
      enabled: ModuleId[]
      /** Ativados por dependência (não pedidos), em ordem do catálogo. */
      autoEnabled: ModuleId[]
    }
  | {
      ok: false
      reason: ResolutionReason
      conflicts: [ModuleId, ModuleId][]
      /** Módulos que impedem a mudança: dependentes ativos, `['core']` ou os módulos em conflito. */
      blockedBy: ModuleId[]
      dependents: DependentsOfModule[]
      /** Ids do pedido que não existem no catálogo. */
      unknownIds: string[]
    }

type Refusal = Extract<Resolution, { ok: false }>

function refusal(
  reason: ResolutionReason,
  fields: Partial<Omit<Refusal, 'ok' | 'reason'>> = {},
): Refusal {
  return {
    ok: false,
    reason,
    conflicts: [],
    blockedBy: [],
    dependents: [],
    unknownIds: [],
    ...fields,
  }
}

function isKnown(id: string): id is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(id)
}

function catalogOrder(ids: Iterable<ModuleId>): ModuleId[] {
  return [...new Set(ids)].sort((a, b) => MODULE_IDS.indexOf(a) - MODULE_IDS.indexOf(b))
}

/** Uma definição está satisfeita quando todas as `requires` estão ativas e (se houver) uma alternativa também está. */
function isSatisfied(
  definition: Readonly<ModuleDefinition>,
  active: ReadonlySet<ModuleId>,
): boolean {
  if (!definition.requires.every((id) => active.has(id))) return false
  const alternatives = definition.requiresAnyOf ?? []
  return (
    alternatives.length === 0 ||
    alternatives.some((alternative) => alternative.every((id) => active.has(id)))
  )
}

function referencesModule(definition: Readonly<ModuleDefinition>, id: ModuleId): boolean {
  return (
    definition.requires.includes(id) ||
    (definition.requiresAnyOf ?? []).some((alternative) => alternative.includes(id))
  )
}

function conflictsBetween(a: ModuleId, b: ModuleId): boolean {
  return (
    getModule(a).conflicts?.includes(b) === true || getModule(b).conflicts?.includes(a) === true
  )
}

/**
 * Quem, entre `modules`, ficaria sem dependência ao desligar `id`. A lista é direta: não
 * inclui dependentes de dependentes. Ids fora do catálogo são ignorados.
 */
export function dependentsOf(modules: readonly ModuleId[], id: ModuleId): ModuleId[] {
  const before = new Set(modules.filter(isKnown))
  const after = new Set(before)
  after.delete(id)

  return catalogOrder(
    [...before].filter(
      (other) =>
        other !== id &&
        isSatisfied(getModule(other), before) &&
        !isSatisfied(getModule(other), after),
    ),
  )
}

/**
 * Calcula o conjunto de módulos depois de uma mudança, sem efeitos colaterais.
 *
 * Ordem das regras: pedido inválido (desconhecido, ligar e desligar o mesmo módulo, desligar
 * o núcleo), depois a mudança com as dependências puxadas, depois conflitos e dependentes
 * bloqueados. Só o que o pedido causa é avaliado: uma inconsistência que já estava em
 * `current` não recusa uma mudança que não tem relação com ela.
 */
export function resolveModuleSet(current: readonly ModuleId[], change: ModuleChange): Resolution {
  const enableRequest = change.enable ?? []
  const disableRequest = change.disable ?? []

  const unknownIds = [
    ...new Set([...enableRequest, ...disableRequest].filter((id) => !isKnown(id))),
  ]
  if (unknownIds.length > 0) {
    return refusal('unknown_module', { unknownIds })
  }

  const enableSet = new Set(enableRequest)
  const disableSet = new Set(disableRequest)

  // Ativar e desativar o mesmo módulo no mesmo pedido é erro de quem pede, não ordem de execução.
  if ([...enableSet].some((id) => disableSet.has(id))) {
    return refusal('conflicting_request')
  }

  if (disableSet.has('core')) {
    return refusal('core_required', { blockedBy: ['core'] })
  }

  // Ids de `current` fora do catálogo são dados antigos: não entram no conjunto.
  const before = new Set<ModuleId>(current.filter(isKnown))
  before.add('core')

  // Desligar algo que já está desligado não muda nada.
  const removed = catalogOrder(disableRequest.filter((id) => before.has(id)))
  const remaining = new Set([...before].filter((id) => !removed.includes(id)))

  // Ligar algo já ativo não muda nada; só o que entra de fato é processado.
  const explicitlyAdded = catalogOrder(enableRequest.filter((id) => !before.has(id)))
  const active = new Set(remaining)
  for (const id of explicitlyAdded) active.add(id)

  // Fecho das dependências: `requires` entra sempre; `requiresAnyOf` escolhe a primeira
  // alternativa que não conflita com o que está ativo, se nenhuma já estiver satisfeita.
  const autoEnabled: ModuleId[] = []
  let requestConflicts = false
  const queue: ModuleId[] = [...explicitlyAdded]

  const activate = (id: ModuleId): void => {
    active.add(id)
    autoEnabled.push(id)
    queue.push(id)
  }

  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const definition = getModule(next)

    for (const required of definition.requires) {
      if (active.has(required)) continue
      // O pedido manda desligar o que este módulo exige: não há como satisfazer ambos.
      if (disableSet.has(required)) {
        requestConflicts = true
        continue
      }
      activate(required)
    }

    const alternatives = definition.requiresAnyOf ?? []
    if (alternatives.length > 0 && !alternatives.some((alt) => alt.every((id) => active.has(id)))) {
      const allowed = alternatives.filter((alt) => alt.every((id) => !disableSet.has(id)))
      if (allowed.length === 0) {
        requestConflicts = true
        continue
      }
      const pick =
        allowed.find((alt) =>
          alt.every(
            (id) => ![...active].some((other) => other !== id && conflictsBetween(id, other)),
          ),
        ) ?? allowed[0]
      for (const id of pick ?? []) {
        if (!active.has(id)) activate(id)
      }
    }
  }

  if (requestConflicts) {
    return refusal('conflicting_request')
  }

  // Dependentes bloqueados: estavam satisfeitos antes da mudança e ficaram sem dependência.
  const blocked = [...remaining].filter(
    (id) => isSatisfied(getModule(id), before) && !isSatisfied(getModule(id), active),
  )
  // Pares em conflito que envolvem algo que esta mudança acrescentou. Pares antigos não contam.
  const added = new Set<ModuleId>([...explicitlyAdded, ...autoEnabled])
  const conflicts: [ModuleId, ModuleId][] = []
  for (let i = 0; i < MODULE_IDS.length; i++) {
    for (let j = i + 1; j < MODULE_IDS.length; j++) {
      const a = MODULE_IDS[i]
      const b = MODULE_IDS[j]
      if (a === undefined || b === undefined) continue
      if (!active.has(a) || !active.has(b)) continue
      if (!added.has(a) && !added.has(b)) continue
      if (conflictsBetween(a, b)) conflicts.push([a, b])
    }
  }
  if (conflicts.length > 0) {
    return refusal('conflict', { conflicts })
  }

  if (blocked.length > 0) {
    const dependents: DependentsOfModule[] = []
    for (const id of removed) {
      const requiredBy = catalogOrder(
        blocked.filter((other) => referencesModule(getModule(other), id)),
      )
      if (requiredBy.length > 0) dependents.push({ module: id, requiredBy })
    }
    return refusal('blocked_by_dependents', {
      blockedBy: catalogOrder(blocked),
      dependents,
    })
  }

  return {
    ok: true,
    enabled: catalogOrder(active),
    autoEnabled: catalogOrder(autoEnabled),
  }
}
