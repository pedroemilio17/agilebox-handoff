import type { ExperienceLevel } from './experience-level'
import type { PresetId } from './presets'
import type { ModuleId } from './types'

/**
 * Rótulos em pt-BR de níveis, ferramentas, presets e do aviso de nível (handoff M2, decisões 3, 4 e 6;
 * PROGRESS_2.md, M2.6). Ficam no core para que a interface e os testes leiam a mesma fonte.
 */

export const LEVEL_LABELS: Readonly<
  Record<ExperienceLevel, { readonly name: string; readonly description: string }>
> = {
  basic: {
    name: 'Essencial',
    description: 'Quem está começando. Fazer a tarefa, ver o dia.',
  },
  intermediate: {
    name: 'Padrão',
    description: 'Time que já trabalha em ciclos. Planejar e acompanhar.',
  },
  advanced: {
    name: 'Avançado',
    description: 'Time maduro e gestor. Tudo à mão, sem esconder nada.',
  },
}

/** Nível que a tela marca como "sugerido" (handoff, quadro 07). */
export const SUGGESTED_LEVEL: ExperienceLevel = 'intermediate'

export const MODULE_LABELS: Readonly<Record<ModuleId, string>> = {
  core: 'Quadro',
  agenda: 'Agenda',
  backlog: 'Backlog',
  sprints: 'Sprints',
  checkins: 'Check-ins',
  impediments: 'Impedimentos',
  'estimates.hours': 'Estimativa por horas',
  'estimates.points': 'Estimativa por pontos',
  acceptance: 'Aceite',
  wip: 'Limite de WIP',
  subtasks: 'Subtarefas',
  integrations: 'Integrações',
  flowMetrics: 'Métricas de fluxo',
  reviewRetro: 'Retro',
  burndown: 'Burndown',
}

/**
 * Descrição dos presets conforme a composição em `TEAM_PRESETS`. Divergências com o quadro 06
 * (Quadro simples cita só backlog e quadro; Scrum do time cita retro) estão registradas no PROGRESS_2.md.
 */
export const PRESET_LABELS: Readonly<
  Record<PresetId, { readonly name: string; readonly description: string }>
> = {
  quadroSimples: {
    name: 'Quadro simples',
    description: 'Backlog, quadro e agenda.',
  },
  scrumDoTime: {
    name: 'Scrum do time',
    description: 'Sprints, check-ins e impedimentos.',
  },
  completo: {
    name: 'Completo',
    description: 'Tudo o que existe hoje, incluindo integrações.',
  },
}

/** Aviso que acompanha qualquer mudança de nível ou ferramenta: o escopo é o time, não o projeto. */
export const TEAM_SCOPE_NOTICE = 'Vale para o time inteiro. Os outros times não mudam.'
