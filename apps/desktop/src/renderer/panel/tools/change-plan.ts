import { MODULE_IDS, MODULE_REGISTRY, dependenciesOf, resolveModuleSet } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { ModuleStatusInput, ToolDraft } from './tool-draft'

/**
 * Plano da mudança (M2.10b): diferença entre o rascunho e o que o servidor tem como ativo.
 * `change` aceita só `enable` e `disable`, então o conjunto final vira essas duas listas.
 * Função pura: não grava nada.
 */
export interface ChangePlan {
  /** Módulos a ligar, na ordem do catálogo. */
  readonly enable: readonly ModuleId[]
  /** Módulos a desligar, na ordem do catálogo. Inclui os que saem sem cartão. */
  readonly disable: readonly ModuleId[]
  /** Ligados por escolha (não puxados por dependência de outro da lista). */
  readonly enableRoots: readonly ModuleId[]
  /** Entram por dependência de outro módulo da lista. */
  readonly enablePulled: readonly ModuleId[]
  /** Desligados por escolha (nenhum dos seus requisitos sai junto). */
  readonly disableRoots: readonly ModuleId[]
  /** Saem por dependência de outro módulo da lista. */
  readonly disableCascaded: readonly ModuleId[]
  readonly isEmpty: boolean
}

/** Todas as dependências, diretas e indiretas, de um módulo. */
function transitiveDependencies(id: ModuleId): ReadonlySet<ModuleId> {
  const seen = new Set<ModuleId>()
  const stack: ModuleId[] = [...dependenciesOf(MODULE_REGISTRY[id])]
  while (stack.length > 0) {
    const next = stack.pop()
    if (next === undefined || seen.has(next)) continue
    seen.add(next)
    stack.push(...dependenciesOf(MODULE_REGISTRY[next]))
  }
  return seen
}

/**
 * Módulos encerrando que saem junto com `removed`. O servidor resolve a mudança sobre ativos e
 * encerrando; se um encerrando ficaria sem o que precisa, a recusa só passa quando ele também está
 * na lista de desligar. Quem a gerou aqui é a mesma regra (`resolveModuleSet`).
 */
function windingCascade(
  serverSet: readonly ModuleId[],
  removed: readonly ModuleId[],
  windingDown: ReadonlySet<ModuleId>,
  wanted: ReadonlySet<ModuleId>,
): readonly ModuleId[] {
  if (removed.length === 0) return []
  const resolution = resolveModuleSet(serverSet, { disable: removed })
  if (resolution.ok) return []
  return resolution.blockedBy.filter((id) => windingDown.has(id) && !wanted.has(id))
}

export function planChanges(statuses: readonly ModuleStatusInput[], draft: ToolDraft): ChangePlan {
  const active = new Set<ModuleId>(['core'])
  const windingDown = new Set<ModuleId>()
  for (const { moduleId, state } of statuses) {
    if (state === 'active') active.add(moduleId)
    if (state === 'winding_down') windingDown.add(moduleId)
  }
  const wanted = new Set<ModuleId>(draft)

  const enable = MODULE_IDS.filter((id) => wanted.has(id) && !active.has(id))
  const removed = MODULE_IDS.filter((id) => active.has(id) && !wanted.has(id))
  // Encerrando também conta como dependência no servidor: se depender do que sai, sai junto.
  const cascadedWinding = windingCascade([...active, ...windingDown], removed, windingDown, wanted)
  const disable = MODULE_IDS.filter((id) => removed.includes(id) || cascadedWinding.includes(id))

  // Um ligado é puxado quando outro ligado da mesma mudança depende dele (direta ou indiretamente).
  const enablePulled = enable.filter((id) =>
    enable.some((other) => other !== id && transitiveDependencies(other).has(id)),
  )
  // Um desligado sai em cascata quando depende de outro que também está saindo.
  const disableCascaded = disable.filter((id) =>
    [...transitiveDependencies(id)].some((dependency) => disable.includes(dependency)),
  )

  return {
    enable,
    disable,
    enableRoots: enable.filter((id) => !enablePulled.includes(id)),
    enablePulled,
    disableRoots: disable.filter((id) => !disableCascaded.includes(id)),
    disableCascaded,
    isEmpty: enable.length === 0 && disable.length === 0,
  }
}
