import type { ModuleId } from './types'

/**
 * Presets de ferramentas (plano 2.0 e handoff M2, decisão 4). Dados puros: cada preset é a lista
 * de módulos ativos, sem o núcleo, que está sempre ativo. Resolvem a partir de vazio via
 * `resolveModuleSet`.
 *
 * Presets que citam módulos do M10 (WIP, subtarefas, métricas, burndown, review e retro) ficam
 * fora até o M10 existir. "Completo" entra com tudo o que já existe, incluindo Integrações.
 */
export const PRESET_IDS = ['quadroSimples', 'scrumDoTime', 'completo'] as const

export type PresetId = (typeof PRESET_IDS)[number]

export const TEAM_PRESETS: Readonly<Record<PresetId, readonly ModuleId[]>> = {
  quadroSimples: ['core', 'agenda', 'backlog'],
  scrumDoTime: ['core', 'agenda', 'backlog', 'sprints', 'checkins', 'impediments'],
  completo: [
    'core',
    'agenda',
    'backlog',
    'sprints',
    'checkins',
    'impediments',
    'estimates.hours',
    'acceptance',
    'integrations',
  ],
}
