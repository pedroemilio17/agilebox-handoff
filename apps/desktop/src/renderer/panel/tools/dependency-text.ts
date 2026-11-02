import { MODULE_LABELS } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import { panelCopy } from '../copy'
import { dependencyGroups } from './tool-draft'

/**
 * Texto de dependência do cartão. Grupos (exigências) são unidos com " e "; alternativas dentro de
 * um grupo (`requiresAnyOf`) são unidas com " ou ".
 */
export function dependencyText(id: ModuleId): string {
  if (id === 'core') return panelCopy.toolsCoreHint
  const groups = dependencyGroups(id)
  if (groups.length === 0) return panelCopy.toolsNoDependency
  const text = groups
    .map((group) => group.map((alternative) => MODULE_LABELS[alternative]).join(' ou '))
    .join(' e ')
  return panelCopy.toolsDependsOn(text)
}
