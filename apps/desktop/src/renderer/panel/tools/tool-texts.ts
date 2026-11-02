import type { ModuleId, PresetId } from '@agilebox/core'

/**
 * Textos da tela Ferramentas que não moram em `panel/copy.ts`. Os presets (`PRESET_LABELS`, no core)
 * continuam com o nome; a descrição mostrada na tela é esta, para dizer o que cada preset tem em
 * relação a estimativa e critérios (B6, PROGRESS_2.md, "M3 · Decisões do Pedro").
 */
export const PRESET_DESCRIPTIONS: Readonly<Record<PresetId, string>> = {
  quadroSimples: 'Backlog, quadro e agenda.',
  scrumDoTime: 'Sprints, check-ins e impedimentos. Sem estimativa e sem critérios de aceite.',
  completo:
    'Tudo o que existe hoje, incluindo integrações, estimativa por horas e critérios de aceite.',
}

/**
 * Destino dos itens de uma ferramenta que sai (M3.14). Só as que têm dados próprios no M3: o que
 * fica guardado nunca é apagado, e o backlog volta ao quadro com a flag gravada (B1).
 */
export const DISABLE_DESTINATIONS: Partial<Readonly<Record<ModuleId, string>>> = {
  backlog: 'Tarefas do backlog voltam ao quadro. Nada é apagado.',
  acceptance: 'Critérios ficam guardados. Nada é apagado.',
  'estimates.hours': 'Estimativas ficam guardadas. Nada é apagado.',
}
