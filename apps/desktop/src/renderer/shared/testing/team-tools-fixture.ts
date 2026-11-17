import {
  effectiveCapabilities,
  getModule,
  MODULE_IDS,
  MODULE_LABELS,
  moduleLevelWarning,
  TEAM_PRESETS,
  type ExperienceLevel,
  type ModuleId,
  type TeamPresetId,
  type UserRole,
} from '@agilebox/core'
import type { TeamToolsViewDto } from '@agilebox/contract'

/**
 * Visão de `teamTools.get` montada com o mesmo cálculo do servidor (`effectiveCapabilities`,
 * `moduleLevelWarning` e os estados do catálogo), para que os testes de interface usem a lista de
 * capacidades que o backend de verdade devolveria.
 *
 * `modules` são as ferramentas ativas; `winding` são as que estão em encerramento. Ambas contam
 * como "existentes" para as capacidades, como no servidor (`toActiveModuleIds`).
 */
export function teamToolsView({
  modules,
  level,
  role = 'collaborator',
  winding = [],
}: {
  modules: readonly ModuleId[]
  level: ExperienceLevel
  role?: UserRole
  winding?: readonly ModuleId[]
}): TeamToolsViewDto {
  const existing: ModuleId[] = [...modules, ...winding]
  return {
    level,
    modules: MODULE_IDS.map((id) => ({
      id,
      label: MODULE_LABELS[id],
      state:
        id === 'core' || modules.includes(id)
          ? 'active'
          : winding.includes(id)
            ? 'winding_down'
            : 'disabled',
      minLevel: getModule(id).minLevel,
    })),
    presets: TEAM_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      modules: [...preset.modules],
      suggestedLevel: preset.suggestedLevel,
    })),
    capabilities: effectiveCapabilities({ modules: existing, level, role }),
    levelWarnings: moduleLevelWarning({ modules: existing, level }).map((warning) => ({
      module: warning.module,
      label: MODULE_LABELS[warning.module],
      requiredLevel: warning.requiredLevel,
    })),
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
