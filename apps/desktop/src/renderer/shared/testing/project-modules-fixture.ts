import { getManifest, MODULE_IDS, type ModuleId } from '@agilebox/core'
import type { ProjectModulesViewDto } from '@agilebox/contract'

/**
 * Visão de `projectModules.get` com o manifesto real de cada módulo: nome, nível, objetivo e
 * dependências vêm do core, como no servidor. `enabled` são os ativos; `winding` os em encerramento.
 */
export function projectModulesView({
  enabled = [],
  winding = [],
  canManage = true,
  projectId = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
}: {
  readonly enabled?: readonly ModuleId[]
  readonly winding?: readonly ModuleId[]
  readonly canManage?: boolean
  readonly projectId?: string
} = {}): ProjectModulesViewDto {
  return {
    projectId,
    canManage,
    modules: MODULE_IDS.map((id) => {
      const manifest = getManifest(id)
      const state =
        id === 'core' || enabled.includes(id)
          ? 'active'
          : winding.includes(id)
            ? 'winding_down'
            : 'disabled'
      return {
        id,
        name: manifest.name,
        level: manifest.level,
        objective: manifest.objective,
        state,
        requires: [...manifest.requires],
        enhances: [...manifest.enhances],
        config: null,
      }
    }),
  }
}
