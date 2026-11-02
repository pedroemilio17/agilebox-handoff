import {
  MODULE_IDS,
  MODULE_REGISTRY,
  PRESET_IDS,
  TEAM_PRESETS,
  resolveModuleSet,
} from '@agilebox/core'
import type {
  ModuleChange,
  ModuleId,
  ModuleResolution,
  ModuleState,
  PresetId,
} from '@agilebox/core'

/**
 * Rascunho da tela Ferramentas (M2.10a): dado local, nada é gravado aqui. A regra de dependência
 * é a do core (`resolveModuleSet`), a mesma que o servidor aplica em `ChangeTeamModules`.
 */

/**
 * Ferramentas com cartão nesta tela. Ficam de fora: estimativa por pontos (D8, escondida) e os
 * módulos do M10 (WIP, subtarefas, métricas, burndown e retro), que ainda não existem.
 */
export const TOOL_IDS: readonly ModuleId[] = [
  'core',
  'agenda',
  'backlog',
  'sprints',
  'checkins',
  'impediments',
  'estimates.hours',
  'acceptance',
  'integrations',
]

/** Módulos ligados no rascunho, na ordem do catálogo. O núcleo está sempre presente. */
export type ToolDraft = readonly ModuleId[]

export interface ModuleStatusInput {
  readonly moduleId: ModuleId
  readonly state: ModuleState
}

/**
 * Rascunho de partida: tudo o que está `active` no servidor, inclusive módulo sem cartão, para a
 * prévia (M2.10b) comparar com o gravado. Um módulo em encerramento começa desligado no rascunho,
 * porque é isso que o gestor está tirando do time.
 */
export function draftFromStatuses(statuses: readonly ModuleStatusInput[]): ToolDraft {
  const on = new Set<ModuleId>(['core'])
  for (const { moduleId, state } of statuses) {
    if (state === 'active') on.add(moduleId)
  }
  return MODULE_IDS.filter((id) => on.has(id))
}

export type ToggleResult =
  | {
      readonly ok: true
      readonly draft: ToolDraft
      /** Ligadas por dependência, sem terem sido pedidas. */
      readonly pulled: readonly ModuleId[]
      /** Saem junto por dependência, sem terem sido pedidas. */
      readonly leaving: readonly ModuleId[]
    }
  | {
      readonly ok: false
      /** Ferramentas que conflitam com a pedida. */
      readonly conflicts: readonly ModuleId[]
      /** Exigências que não se cumprem (ex.: alternativa de `requiresAnyOf`). */
      readonly missing: readonly ModuleId[]
    }

/**
 * Liga ou desliga uma ferramenta no rascunho.
 * - Ligar puxa as dependências (`pulled`). Conflito recusa, exceto com módulo sem cartão, que sai
 *   do rascunho sem aviso (ver `resolveDroppingHidden`).
 * - Desligar tira junto os dependentes que ficariam sem o que precisam (`leaving`). O servidor
 *   só aceita essa cascata na mesma mudança, então o rascunho já a monta. Dependentes sem cartão
 *   saem junto, mas não aparecem em `leaving`.
 * `pulled` e `leaving` só listam ferramentas com cartão.
 */
export function toggleTool(draft: ToolDraft, id: ModuleId, wanted: boolean): ToggleResult {
  if (wanted) {
    const result = resolveDroppingHidden(draft, { enable: [id] })
    if (!result.ok) {
      const conflicts = result.conflicts.flat().filter((other) => other !== id)
      return {
        ok: false,
        conflicts: visibleOnly(unique(conflicts)),
        missing: visibleOnly(result.blockedBy),
      }
    }
    return {
      ok: true,
      draft: result.enabled,
      pulled: visibleOnly(result.autoEnabled),
      leaving: [],
    }
  }

  if (id === 'core') return { ok: false, conflicts: [], missing: ['core'] }
  const alone = resolveModuleSet(draft, { disable: [id] })
  if (alone.ok) return { ok: true, draft: alone.enabled, pulled: [], leaving: [] }

  const withDependents = resolveModuleSet(draft, { disable: [id, ...alone.blockedBy] })
  if (!withDependents.ok) {
    return { ok: false, conflicts: [], missing: visibleOnly(alone.blockedBy) }
  }
  return {
    ok: true,
    draft: withDependents.enabled,
    pulled: [],
    leaving: visibleOnly(alone.blockedBy),
  }
}

/** Rascunho que resulta de aplicar um preset (o preset substitui o rascunho inteiro). */
export function applyPreset(presetId: PresetId): ToolDraft {
  const result = resolveModuleSet([], { enable: TEAM_PRESETS[presetId] })
  // Presets são conjuntos válidos por construção (sem conflito nem exigência em falta).
  if (!result.ok) throw new Error(`Preset inválido: ${presetId}`)
  return result.enabled
}

/** Preset cujo conjunto é exatamente o do rascunho, ou null se o rascunho é personalizado. */
export function presetMatching(draft: ToolDraft): PresetId | null {
  const on = new Set(draft)
  return (
    PRESET_IDS.find((presetId) => {
      const expected = applyPreset(presetId)
      return expected.length === on.size && expected.every((id) => on.has(id))
    }) ?? null
  )
}

/** Sinal de estado da ferramenta. Sempre vai junto com texto e ícone, nunca só cor. */
export type ToolSignal = 'on' | 'off' | 'winding'

export function toolSignal(on: boolean, serverState: ModuleState): ToolSignal {
  if (on) return 'on'
  return serverState === 'winding_down' ? 'winding' : 'off'
}

/**
 * Exigências declaradas no registro, um grupo por exigência: cada `requires` é um grupo de um
 * item; cada `requiresAnyOf` é um grupo em que basta uma alternativa.
 */
export function dependencyGroups(id: ModuleId): readonly (readonly ModuleId[])[] {
  const definition = MODULE_REGISTRY[id]
  return [
    ...definition.requires.map((requirement) => [requirement]),
    ...(definition.requiresAnyOf ?? []),
  ]
}

function isVisible(id: ModuleId): boolean {
  return TOOL_IDS.includes(id)
}

function visibleOnly(ids: readonly ModuleId[]): ModuleId[] {
  return ids.filter(isVisible)
}

/**
 * Resolve a mudança. Se um módulo sem cartão entra num conflito ou numa exigência que falha, ele
 * sai da base e a resolução roda de novo: o usuário não vê esse módulo, então não pode desligá-lo
 * nem ser avisado dele. Quando não sobra módulo sem cartão envolvido, devolve o resultado como está.
 */
function resolveDroppingHidden(base: ToolDraft, change: ModuleChange): ModuleResolution {
  const result = resolveModuleSet(base, change)
  if (result.ok) return result
  const involved = hiddenIn(result).filter((id) => base.includes(id))
  if (involved.length === 0) return result
  return resolveDroppingHidden(
    base.filter((id) => !involved.includes(id)),
    change,
  )
}

function hiddenIn(result: Extract<ModuleResolution, { ok: false }>): ModuleId[] {
  const ids = [...result.conflicts.flat(), ...result.blockedBy]
  return unique(ids.filter((id) => !isVisible(id)))
}

function unique(ids: readonly ModuleId[]): ModuleId[] {
  return [...new Set(ids)]
}
