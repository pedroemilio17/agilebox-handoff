import type { ProjectPresetKey } from '@agilebox/core'

/**
 * Rótulo curto da metodologia na barra lateral, como no design. O rótulo vem do preset em que o
 * projeto começou ("começou como"); sem preset (projeto criado sem o assistente), não há rótulo.
 */
const METHODOLOGY_LABELS: Readonly<Record<ProjectPresetKey, string>> = {
  simples: 'Simples',
  kanban: 'Kanban',
  agil: 'Ágil',
  tradicional: 'Trad.',
  hibrido: 'Híbrido',
}

export function methodologyLabel(preset: ProjectPresetKey | null | undefined): string | null {
  return preset ? METHODOLOGY_LABELS[preset] : null
}
