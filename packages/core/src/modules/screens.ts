import type { EffectiveCapabilities } from './capabilities'
import { isAtLeastLevel } from './experience-level'
import type { ExperienceLevel } from './experience-level'
import type { ModuleId } from './types'

/**
 * Telas do menu lateral, na ordem em que aparecem (handoff M2, quadro 07).
 * `dashboard` e `tools` não são módulos do catálogo: só dependem de nível e de papel.
 */
export const SIDEBAR_SCREEN_IDS = [
  'projects',
  'agenda',
  'backlog',
  'sprints',
  'dashboard',
  'impediments',
  'integrations',
  'tools',
] as const

export type SidebarScreenId = (typeof SIDEBAR_SCREEN_IDS)[number]

/** Tela do menu que corresponde a um módulo. Módulos sem tela (estimativas, WIP...) não aparecem. */
const SCREEN_BY_MODULE: Partial<Record<ModuleId, SidebarScreenId>> = {
  core: 'projects',
  agenda: 'agenda',
  backlog: 'backlog',
  sprints: 'sprints',
  impediments: 'impediments',
  integrations: 'integrations',
}

/** Telas sem módulo: nível mínimo e se são só do gestor (handoff M2, quadro 07). */
const SCREEN_WITHOUT_MODULE: Partial<
  Record<SidebarScreenId, { readonly minLevel: ExperienceLevel; readonly managerOnly: boolean }>
> = {
  dashboard: { minLevel: 'intermediate', managerOnly: true },
  tools: { minLevel: 'advanced', managerOnly: true },
}

/**
 * Função pura: quais telas do menu a pessoa vê. Um item aparece só se o nível libera
 * **e** a ferramenta está ligada (para telas de módulo, `effectiveCapabilities` já aplica as duas).
 * Não concede permissão: quem pode o quê continua em `policies/access-policy.ts`.
 */
export function sidebarScreens(capabilities: EffectiveCapabilities): readonly SidebarScreenId[] {
  const reachable = new Set<SidebarScreenId>()
  for (const moduleId of capabilities.screens) {
    const screen = SCREEN_BY_MODULE[moduleId]
    if (screen) reachable.add(screen)
  }

  return SIDEBAR_SCREEN_IDS.filter((screen) => {
    const rule = SCREEN_WITHOUT_MODULE[screen]
    if (!rule) return reachable.has(screen)
    if (rule.managerOnly && capabilities.role !== 'manager') return false
    return isAtLeastLevel(capabilities.level, rule.minLevel)
  })
}
