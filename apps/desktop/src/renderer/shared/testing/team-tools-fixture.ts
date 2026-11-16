import {
  effectiveCapabilities,
  MODULE_IDS,
  TEAM_PRESETS,
  type ExperienceLevel,
  type ModuleId,
  type TeamPresetId,
  type UserRole,
} from '@agilebox/core'
import type { TeamToolsViewDto } from '@agilebox/contract'

/**
 * Visão de `teamTools.get` montada com o mesmo cálculo do servidor (`effectiveCapabilities`), para
 * que os testes de interface usem a lista de capacidades que o backend de verdade devolveria.
 */
export function teamToolsView({
  modules,
  level,
  role = 'collaborator',
}: {
  modules: readonly ModuleId[]
  level: ExperienceLevel
  role?: UserRole
}): TeamToolsViewDto {
  return {
    level,
    modules: [],
    presets: TEAM_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      modules: [...preset.modules],
      suggestedLevel: preset.suggestedLevel,
    })),
    capabilities: effectiveCapabilities({ modules: [...modules], level, role }),
    levelWarnings: [],
    canManage: role === 'manager',
  }
}

/** Módulos de um preset do PLANO-2.0 (o que a equipe ativa ao escolhê-lo). */
export function presetModules(id: TeamPresetId): ModuleId[] {
  const preset = TEAM_PRESETS.find((item) => item.id === id)
  if (!preset) throw new Error(`Preset desconhecido: ${id}`)
  return [...preset.modules]
}

/** Todas as ferramentas ligadas: o padrão de código da equipe, no nível Avançado. */
export const ALL_MODULES: readonly ModuleId[] = [...MODULE_IDS]
