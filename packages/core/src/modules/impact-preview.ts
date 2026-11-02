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

/**
 * Destino de cada item ao desligar o módulo (handoff M2, decisão 5 e P2 padrão B).
 * - `board`: continua no Quadro.
 * - `hidden`: sai da tela e volta ao reativar o módulo (nada é apagado).
 *
 * Tipos sem destino definido não entram na prévia. Projetos e participações ainda não têm
 * destino no handoff; impedimentos, check-ins e retros entram aqui quando existirem (M5 e M10).
 */
export const ITEM_DESTINATION = {
  tasks: 'board',
  meetings: 'hidden',
} as const satisfies Partial<Record<ItemKind, ItemDestination>>

export type ItemDestination = 'board' | 'hidden'

export type DestinationKind = keyof typeof ITEM_DESTINATION

export interface ItemImpact {
  readonly kind: DestinationKind
  readonly destination: ItemDestination
  /** Itens desse tipo que dependem do módulo. Pode ser zero. */
  readonly count: number
}

export interface ModuleImpact {
  readonly moduleId: ModuleId
  /** Contagem de todos os tipos que dependem do módulo, inclusive sem destino. */
  readonly counts: ItemCounts
  /** Só os tipos com destino, na ordem de `ITEM_KINDS`. É o que a prévia mostra. */
  readonly items: readonly ItemImpact[]
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
  const isAffected = (kind: ItemKind) => affected.includes(ITEM_KIND_MODULE[kind])

  const counts = {} as Record<ItemKind, number>
  for (const kind of ITEM_KINDS) {
    counts[kind] = isAffected(kind) ? available[kind] : 0
  }

  const items: ItemImpact[] = []
  for (const kind of ITEM_KINDS) {
    if (!isDestinationKind(kind) || !isAffected(kind)) continue
    items.push({ kind, destination: ITEM_DESTINATION[kind], count: available[kind] })
  }

  return { moduleId, counts, items }
}

function isDestinationKind(kind: ItemKind): kind is DestinationKind {
  return Object.prototype.hasOwnProperty.call(ITEM_DESTINATION, kind)
}
