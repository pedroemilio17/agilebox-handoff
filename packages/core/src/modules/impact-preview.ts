import { MODULE_REGISTRY, dependenciesOf } from './registry'
import { MODULE_IDS } from './types'
import type { ModuleId } from './types'

/** Tipos de item que a prévia de impacto conta. Um tipo novo entra aqui quando existir. */
export const ITEM_KINDS = ['tasks', 'projects', 'participations', 'meetings'] as const

export type ItemKind = (typeof ITEM_KINDS)[number]

export type ItemCounts = Readonly<Record<ItemKind, number>>

/** Módulo a que cada tipo de item pertence. Tarefas, projetos e participações são do núcleo. */
export const ITEM_KIND_MODULE: Readonly<Record<ItemKind, ModuleId>> = {
  tasks: 'core',
  projects: 'core',
  participations: 'core',
  meetings: 'agenda',
}

export interface ModuleImpact {
  readonly moduleId: ModuleId
  /** Itens que dependem do módulo (ou de módulos que dependem dele), contados pelo tipo. */
  readonly counts: ItemCounts
}

/**
 * O próprio módulo e todos os que dependem dele, direta ou indiretamente (`requires` e
 * `requiresAnyOf`), na ordem do catálogo. Desligar um módulo afeta esses itens.
 */
export function dependentsOf(moduleId: ModuleId): readonly ModuleId[] {
  const affected = new Set<ModuleId>([moduleId])
  let grew = true
  while (grew) {
    grew = false
    for (const id of MODULE_IDS) {
      if (affected.has(id)) continue
      if (dependenciesOf(MODULE_REGISTRY[id]).some((dependency) => affected.has(dependency))) {
        affected.add(id)
        grew = true
      }
    }
  }
  return MODULE_IDS.filter((id) => affected.has(id))
}

/**
 * Prévia de impacto de desligar um módulo: conta, por tipo, só os itens que dependem dele.
 * Função pura e só leitura: não muda estado nem apaga nada, e não depende de o módulo estar
 * ativo ou desativado.
 */
export function previewModuleImpact(moduleId: ModuleId, available: ItemCounts): ModuleImpact {
  const affected = dependentsOf(moduleId)
  const counts = Object.fromEntries(
    ITEM_KINDS.map((kind) => [
      kind,
      affected.includes(ITEM_KIND_MODULE[kind]) ? available[kind] : 0,
    ]),
  ) as Record<ItemKind, number>
  return { moduleId, counts }
}
