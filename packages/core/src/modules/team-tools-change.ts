import { ValidationError } from '../shared/errors'
import { getModule, MODULE_IDS, MODULE_LABELS } from './registry'
import type { ModuleId } from './registry'
import { dependentsOf, resolveModuleSet } from './resolve'
import type { DependentsOfModule, ResolutionReason } from './resolve'
import { TEAM_PRESETS } from './presets'
import type { TeamPresetId } from './presets'
import { moduleStateOf, toActiveModuleIds } from './team-tools'
import type { ModuleState, TeamModuleUpdate, TeamToolsSettings } from './team-tools'

/**
 * Pedido de mudança nas ferramentas (PLANO-2.0, "Mudar ferramentas sem quebrar o que está em
 * andamento"):
 * - `enable`: ligar. Puxa as dependências que faltam (ativação imediata).
 * - `disable`: desligar. Entra em `winding_down`, ou em `disabled` se estiver em `finalize`.
 * - `finalize`: o gestor antecipa o fim de um encerramento. Tem de estar também em `disable`.
 */
export interface ModuleChangeRequest {
  readonly enable?: readonly ModuleId[]
  readonly disable?: readonly ModuleId[]
  readonly finalize?: readonly ModuleId[]
}

/** Recusa de um pedido, com a mensagem pronta para a interface (pt-BR). */
export interface ModuleChangeRefusal {
  readonly reason: ResolutionReason
  readonly message: string
  readonly conflicts: [ModuleId, ModuleId][]
  readonly blockedBy: ModuleId[]
  readonly dependents: DependentsOfModule[]
  readonly unknownIds: string[]
}

export type ModuleChangePlan =
  | {
      readonly ok: true
      /** Só as linhas cujo estado muda. As demais ficam como estavam. */
      readonly updates: TeamModuleUpdate[]
      /** Ferramentas ligadas sem terem sido pedidas (dependências), em ordem do catálogo. */
      readonly autoEnabled: ModuleId[]
      /** Ferramentas que passam a `active` nesta mudança (pedidas ou dependências). */
      readonly activated: ModuleId[]
      readonly windingDown: ModuleId[]
      readonly disabled: ModuleId[]
    }
  | ({ readonly ok: false } & ModuleChangeRefusal)

function unique<T>(values: readonly T[] | undefined): T[] {
  return [...new Set(values ?? [])]
}

function labelOf(id: ModuleId): string {
  return MODULE_LABELS[id]
}

function list(ids: readonly ModuleId[]): string {
  return ids.map(labelOf).join(', ')
}

/** Frase de recusa para a interface. Cada motivo de `resolveModuleSet` tem a sua. */
function refusalMessage(
  reason: ResolutionReason,
  parts: {
    conflicts: [ModuleId, ModuleId][]
    dependents: DependentsOfModule[]
    unknownIds: string[]
  },
): string {
  switch (reason) {
    case 'unknown_module':
      return 'Ferramenta desconhecida no pedido'
    case 'conflicting_request':
      return 'A mesma ferramenta não pode ser ligada e desligada no mesmo pedido'
    case 'core_required':
      return 'O Núcleo é obrigatório e não pode ser desligado'
    case 'conflict': {
      const pairs = parts.conflicts.map(([a, b]) => `${labelOf(a)} e ${labelOf(b)}`).join('; ')
      return `Não dá para ter ferramentas em conflito ativas juntas: ${pairs}. Escolha só uma delas`
    }
    case 'blocked_by_dependents': {
      const removed = parts.dependents.map(({ module }) => labelOf(module))
      const details = parts.dependents
        .map(({ module, requiredBy }) =>
          requiredBy.length === 1
            ? `${list(requiredBy)} depende de ${labelOf(module)}`
            : `${list(requiredBy)} dependem de ${labelOf(module)}`,
        )
        .join('; ')
      return `Não dá para desligar ${removed.join(', ')}: ${details}. Desligue as dependentes junto, ou mantenha a ferramenta ligada`
    }
  }
}

/**
 * Calcula o que muda nas ferramentas da equipe para um pedido, sem gravar nada. Função pura:
 * quem chama decide se grava (`applyTeamToolsUpdate` valida de novo na gravação).
 *
 * Regras:
 * - Ligar puxa dependências (`requires`) que não estão `active`, inclusive as que estão encerrando.
 *   Ferramenta que estava `winding_down` e é religada volta a `active`, junto com o que ela exige.
 * - Desligar usa as regras de `resolveModuleSet`: conflito e dependente ativo são recusados com a
 *   lista de quem depende. Desligar vai para `winding_down`, ou para `disabled` se estiver em `finalize`.
 * - Pedido com ferramenta desconhecida, ligar e desligar a mesma, ou `finalize` fora de `disable`
 *   é erro de quem pede: lança `ValidationError`, sem recusa de regra.
 */
export function planModuleChange(
  current: TeamToolsSettings,
  request: ModuleChangeRequest,
): ModuleChangePlan {
  const enable = unique(request.enable)
  const disable = unique(request.disable)
  const finalize = unique(request.finalize)

  if (finalize.some((id) => !disable.includes(id)))
    throw new ValidationError(
      'Só dá para encerrar de uma vez uma ferramenta que está sendo desligada',
    )

  const unknownIds = [...enable, ...disable].filter(
    (id) => !(MODULE_IDS as readonly string[]).includes(id),
  )
  if (unknownIds.length > 0) {
    const message = refusalMessage('unknown_module', { conflicts: [], dependents: [], unknownIds })
    return {
      ok: false,
      reason: 'unknown_module',
      message,
      conflicts: [],
      blockedBy: [],
      dependents: [],
      unknownIds,
    }
  }

  const before = toActiveModuleIds(current.modules)
  const state = (id: ModuleId): ModuleState => moduleStateOf(current.modules, id)

  // Ferramentas que precisam estar `active` depois do pedido: as pedidas que não estão ativas e,
  // por fechamento, tudo o que elas exigem e não está ativo (inclusive o que encerrava).
  const activation = new Set<ModuleId>()
  const pending: ModuleId[] = enable.filter((id) => state(id) !== 'active')
  while (pending.length > 0) {
    const next = pending.shift()!
    if (activation.has(next)) continue
    activation.add(next)
    for (const required of getModule(next).requires) {
      if (state(required) !== 'active' && !activation.has(required)) pending.push(required)
    }
  }

  // Pedir para ligar e desligar a mesma ferramenta (direto ou por dependência) é erro de pedido.
  const clash = [...activation].some((id) => disable.includes(id))
  if (enable.some((id) => disable.includes(id)) || clash) {
    const message = refusalMessage('conflicting_request', {
      conflicts: [],
      dependents: [],
      unknownIds: [],
    })
    return {
      ok: false,
      reason: 'conflicting_request',
      message,
      conflicts: [],
      blockedBy: [],
      dependents: [],
      unknownIds: [],
    }
  }

  // O resolvedor ignora o que já está em `before`: tira o que será religado para ele tratar como
  // "entra agora" e aplicar as mesmas regras de conflito e de dependência.
  const withoutActivation = before.filter((id) => !activation.has(id))
  const resolution = resolveModuleSet(withoutActivation, {
    enable: [...activation],
    disable,
  })

  if (!resolution.ok) {
    const message = refusalMessage(resolution.reason, {
      conflicts: resolution.conflicts,
      dependents: resolution.dependents,
      unknownIds: resolution.unknownIds,
    })
    return {
      ok: false,
      reason: resolution.reason,
      message,
      conflicts: resolution.conflicts,
      blockedBy: resolution.blockedBy,
      dependents: resolution.dependents,
      unknownIds: resolution.unknownIds,
    }
  }

  // Dependências ligadas sem terem sido pedidas: ativadas pelo fechamento ou pelo resolvedor.
  const autoEnabled = MODULE_IDS.filter(
    (id) => (activation.has(id) && !enable.includes(id)) || resolution.autoEnabled.includes(id),
  )

  const removed = disable.filter((id) => before.includes(id))
  const updates: TeamModuleUpdate[] = []
  const activated: ModuleId[] = []
  const windingDown: ModuleId[] = []
  const disabled: ModuleId[] = []

  for (const id of MODULE_IDS) {
    const previous = state(id)
    let next: ModuleState = previous
    if (activation.has(id) || autoEnabled.includes(id)) {
      next = 'active'
    } else if (removed.includes(id)) {
      next = finalize.includes(id) ? 'disabled' : 'winding_down'
    }
    if (next === previous) continue
    updates.push({ moduleId: id, state: next })
    if (next === 'active') activated.push(id)
    if (next === 'winding_down') windingDown.push(id)
    if (next === 'disabled') disabled.push(id)
  }

  return { ok: true, updates, autoEnabled, activated, windingDown, disabled }
}

/**
 * Encerramento concluído: `winding_down` vira `disabled`. Recusado se outra ferramenta ligada ainda
 * depende desta (ela precisa encerrar antes, ou ser desligada junto).
 */
export function planCompleteWindDown(
  current: TeamToolsSettings,
  moduleId: ModuleId,
): TeamModuleUpdate[] {
  getModule(moduleId)
  if (moduleStateOf(current.modules, moduleId) !== 'winding_down')
    throw new ValidationError(`${labelOf(moduleId)} não está encerrando`)
  const dependents = dependentsOf(toActiveModuleIds(current.modules), moduleId)
  if (dependents.length > 0)
    throw new ValidationError(
      `Não dá para concluir o encerramento de ${labelOf(moduleId)}: ${list(dependents)} ainda depende dela`,
    )
  return [{ moduleId, state: 'disabled' }]
}

/**
 * Pedido de um preset: liga as ferramentas do preset e desliga (com encerramento) as que não estão
 * nele. O núcleo nunca entra no desligamento. Devolve também o nível sugerido.
 */
export function planPreset(
  current: TeamToolsSettings,
  presetId: TeamPresetId,
): { request: ModuleChangeRequest; suggestedLevel: TeamToolsSettings['level'] } {
  const preset = TEAM_PRESETS.find((candidate) => candidate.id === presetId)
  if (!preset) throw new ValidationError('Preset desconhecido')
  const enable = preset.modules.filter((id) => moduleStateOf(current.modules, id) !== 'active')
  const disable = toActiveModuleIds(current.modules).filter(
    (id) => id !== 'core' && !preset.modules.includes(id),
  )
  return { request: { enable, disable }, suggestedLevel: preset.suggestedLevel }
}
