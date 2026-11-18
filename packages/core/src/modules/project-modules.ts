import { getManifest } from './manifest'
import type { DisableBlock, ProjectState } from './manifest'
import { dependentsOf, resolveModuleSet } from './resolve'
import type { ResolutionReason } from './resolve'
import { MODULE_IDS } from './registry'
import type { ModuleId } from './registry'

/**
 * Ligar e desligar módulos de um projeto (ADR-10, "Dependências e regras de ligar e desligar").
 * Funções puras: não gravam nada. Quem grava (caso de uso) aplica o plano e registra na linha do
 * tempo do projeto. Desligar oculta, nunca apaga (regra 7): o plano só diz quais módulos mudam de
 * estado, e os dados de cada módulo ficam como estão.
 */

function catalogOrder(ids: Iterable<ModuleId>): ModuleId[] {
  return [...new Set(ids)].sort((a, b) => MODULE_IDS.indexOf(a) - MODULE_IDS.indexOf(b))
}

export type EnablePlan =
  | {
      readonly ok: true
      /** Conjunto ligado depois da mudança, em ordem do catálogo, com `core`. */
      readonly enabled: ModuleId[]
      /** Ligados junto por dependência, para o aviso "Sprints precisa do Backlog. Ligar os dois?". */
      readonly autoEnabled: ModuleId[]
    }
  | {
      readonly ok: false
      readonly reason: ResolutionReason
      readonly conflicts: [ModuleId, ModuleId][]
    }

/** Ligar um módulo liga junto o que ele requer. Conflito entre módulos recusa. */
export function planEnableModules(
  current: readonly ModuleId[],
  ids: readonly ModuleId[],
): EnablePlan {
  const resolution = resolveModuleSet(current, { enable: ids })
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason, conflicts: resolution.conflicts }
  }
  return { ok: true, enabled: resolution.enabled, autoEnabled: resolution.autoEnabled }
}

export interface ScheduledDisable {
  readonly moduleId: ModuleId
  readonly block: DisableBlock
}

export type DisablePlan =
  | {
      readonly ok: true
      /** Módulos que passam a desligados agora: os pedidos e os que dependiam deles. */
      readonly disableNow: ModuleId[]
      /** Só os desligados por dependência, para o aviso "serão desligados junto". */
      readonly cascadeDisabled: ModuleId[]
      /**
       * Quando algum módulo não pode ser desligado agora (`canDisable`), o pedido inteiro fica
       * agendado para o fim do bloqueio e nada é desligado: assim nenhum módulo fica sem o que
       * exige. Cada item traz o módulo e o motivo.
       */
      readonly scheduled: ScheduledDisable[]
      /** Conjunto ligado agora, em ordem do catálogo. */
      readonly enabled: ModuleId[]
    }
  | { readonly ok: false; readonly reason: ResolutionReason }

/** Módulos de `active` que ficam sem dependência ao tirar `ids`, direta ou indiretamente. */
function dependentClosure(active: readonly ModuleId[], ids: readonly ModuleId[]): ModuleId[] {
  const remaining = new Set<ModuleId>(active)
  const cascade = new Set<ModuleId>()
  const queue = [...ids]
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const dependent of dependentsOf([...remaining], next)) {
      if (cascade.has(dependent) || ids.includes(dependent)) continue
      cascade.add(dependent)
      queue.push(dependent)
    }
    remaining.delete(next)
  }
  return catalogOrder(cascade)
}

/**
 * Desligar um módulo desliga junto os que dependem dele (ligados), sem apagar dado. Se o
 * `canDisable` de algum deles recusar agora, o pedido fica agendado (ver `DisablePlan`).
 */
export function planDisableModules(
  current: readonly ModuleId[],
  ids: readonly ModuleId[],
  state: ProjectState,
): DisablePlan {
  const active = catalogOrder(['core', ...current])
  const requested = catalogOrder(ids.filter((id) => active.includes(id)))
  const cascade = dependentClosure(active, requested)
  const all = catalogOrder([...requested, ...cascade])

  const resolution = resolveModuleSet(active, { disable: all })
  if (!resolution.ok) return { ok: false, reason: resolution.reason }

  const scheduled: ScheduledDisable[] = []
  for (const moduleId of all) {
    const check = getManifest(moduleId).canDisable(state)
    if (!check.ok) scheduled.push({ moduleId, block: check.block })
  }

  if (scheduled.length > 0) {
    return { ok: true, disableNow: [], cascadeDisabled: cascade, scheduled, enabled: active }
  }
  return {
    ok: true,
    disableNow: all,
    cascadeDisabled: cascade,
    scheduled: [],
    enabled: resolution.enabled,
  }
}

/**
 * Qual módulo puxou uma mudança por dependência (histórico do projeto: "junto com Sprints").
 * Ligado por dependência: o primeiro módulo que mudou para ligado e exige este (em ordem do
 * catálogo). Desligado por dependência: o primeiro módulo exigido por este que também caiu. `null`
 * quando nenhum módulo da mesma mudança é o elo (ex.: mudança direta, sem cascata).
 */
export function cascadeAnchorOf(
  moduleId: ModuleId,
  state: 'active' | 'disabled',
  changedIds: readonly ModuleId[],
): ModuleId | null {
  if (state === 'active') {
    const dependents = catalogOrder(
      changedIds.filter((id) => id !== moduleId && getManifest(id).requires.includes(moduleId)),
    )
    return dependents[0] ?? null
  }
  return getManifest(moduleId).requires.find((id) => changedIds.includes(id)) ?? null
}
