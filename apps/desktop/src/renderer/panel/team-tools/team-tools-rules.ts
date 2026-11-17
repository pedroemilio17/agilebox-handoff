import type { TeamToolsPreviewDto } from '@agilebox/contract'
import type { ExperienceLevel } from '@agilebox/core'
import { panelCopy } from '../copy'

/** Níveis na ordem da escala (básico < intermediário < avançado). */
export const LEVEL_ORDER: readonly ExperienceLevel[] = ['basic', 'intermediate', 'advanced']

export function levelLabel(level: ExperienceLevel): string {
  switch (level) {
    case 'basic':
      return panelCopy.levelBasic
    case 'intermediate':
      return panelCopy.levelIntermediate
    case 'advanced':
      return panelCopy.levelAdvanced
  }
}

/** Maior nível exigido entre os avisos (o botão "Subir para…" sobe até ele). */
export function highestLevel(levels: readonly ExperienceLevel[]): ExperienceLevel | null {
  let best: ExperienceLevel | null = null
  for (const level of levels) {
    if (best === null || LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(best)) best = level
  }
  return best
}

/**
 * Ferramentas que a interface mostra como "Em breve" e desabilitadas. O backend ainda não marca
 * indisponibilidade no DTO; a lista vem do pedido de produto (PLANO-2.0 e tarefa M2.2).
 */
export const COMING_SOON_TOOLS: ReadonlySet<string> = new Set(['estimates.points', 'integrations'])

/** Ids únicos, preservando a ordem da primeira aparição. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

/** "A", "A e B", "A, B e C" (conjunção em pt-BR). */
export function joinPt(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/** Ferramentas que precisam ser desligadas junto para a recusa de dependência sumir. */
export function dependentsToInclude(preview: TeamToolsPreviewDto): string[] {
  return uniqueIds(preview.dependents.flatMap((item) => item.requiredBy))
}
