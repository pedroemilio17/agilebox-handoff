import { MODULE_LABELS } from './registry'
import type { ModuleId } from './registry'

/**
 * O que a organização já tem gravado, contado pelo que o código de hoje consegue contar (PLANO-2.0,
 * prévia de impacto). Módulos sem dados gravados hoje (backlog, sprints, estimativas, critérios,
 * burndown, métricas de fluxo, plug-ins) não têm campo aqui: a contagem deles é zero.
 */
export interface TeamToolsUsage {
  /** Subtarefas de tarefas não arquivadas. */
  readonly subtasks: number
  /** Tarefas não arquivadas com impedimento aberto. */
  readonly blockedTasks: number
  /** Colunas de WIP com limite definido (0 a 2). */
  readonly wipLimits: number
  /** Combinados de retro de todas as reuniões. */
  readonly retroActions: number
  /** Check-ins (dailies) gravados. */
  readonly checkins: number
  /** Agendamentos da agenda (séries e avulsos). */
  readonly meetings: number
}

export interface ModuleImpact {
  readonly module: ModuleId
  /** Quantos itens existentes dependem da ferramenta (0 quando não há dado gravado). */
  readonly count: number
  /** Frase para a interface, em pt-BR. */
  readonly description: string
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Impacto de desligar uma ferramenta, a partir do que está gravado. Função pura. */
export function moduleImpact(module: ModuleId, usage: TeamToolsUsage): ModuleImpact {
  switch (module) {
    case 'subtasks':
      return {
        module,
        count: usage.subtasks,
        description: countLabel(
          usage.subtasks,
          'subtarefa em tarefa não arquivada',
          'subtarefas em tarefas não arquivadas',
        ),
      }
    case 'impediments':
      return {
        module,
        count: usage.blockedTasks,
        description: countLabel(usage.blockedTasks, 'tarefa bloqueada', 'tarefas bloqueadas'),
      }
    case 'wip':
      return {
        module,
        count: usage.wipLimits,
        description: countLabel(
          usage.wipLimits,
          'limite de WIP definido',
          'limites de WIP definidos',
        ),
      }
    case 'reviewRetro':
      return {
        module,
        count: usage.retroActions,
        description: countLabel(usage.retroActions, 'combinado de retro', 'combinados de retro'),
      }
    case 'checkins':
      return {
        module,
        count: usage.checkins,
        description: countLabel(usage.checkins, 'check-in gravado', 'check-ins gravados'),
      }
    case 'agenda':
      return {
        module,
        count: usage.meetings,
        description: countLabel(usage.meetings, 'agendamento na agenda', 'agendamentos na agenda'),
      }
    default:
      return { module, count: 0, description: `${MODULE_LABELS[module]}: sem dados gravados hoje` }
  }
}
