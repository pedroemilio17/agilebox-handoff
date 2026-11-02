import type { ModuleId } from '@agilebox/core'
import { panelCopy } from '../copy'

/** Descrição de cada cartão, do quadro 06. Ferramentas sem cartão não aparecem aqui. */
export function toolDescription(id: ModuleId): string {
  return (panelCopy.toolDescriptions as Partial<Record<ModuleId, string>>)[id] ?? ''
}
