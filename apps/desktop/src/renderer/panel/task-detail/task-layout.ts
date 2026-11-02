import { taskFieldLayout } from '@agilebox/core'
import type { ModuleId, TaskFieldLayout } from '@agilebox/core'
import type { TeamCapabilitiesDto } from '@agilebox/contract'

/**
 * Campos da tela de detalhe para o que o time libera (M2.11). Enquanto as capacidades não chegam,
 * ou se não chegam, vale o Essencial: mostra o mínimo e não depende de dado de outro nível.
 * Uma ferramenta em encerramento conta como ligada, igual ao menu (`GetTeamCapabilities`).
 */
export function detailFieldLayout(capabilities: TeamCapabilitiesDto | undefined): TaskFieldLayout {
  if (!capabilities) return taskFieldLayout('basic', [])
  const modules: ModuleId[] = capabilities.statuses
    .filter((status) => status.state !== 'disabled')
    .map((status) => status.moduleId)
  return taskFieldLayout(capabilities.level, modules)
}
