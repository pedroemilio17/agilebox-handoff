import { parseDateOnly, suggestDailySummary } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { DailySummarySuggestionDto } from '@agilebox/contract'
import { findTaskPrefix } from '../tasks/task-prefix'
import { visibleTasks } from '../tasks/task-visibility'
import type { AppDeps } from '../../deps'

export interface SuggestDailySummaryInput {
  /** Dia de calendário do cliente, `YYYY-MM-DD`. */
  readonly date: string
  /** Fuso IANA do cliente (ex.: "America/Sao_Paulo"). */
  readonly timeZone: string
}

export class SuggestDailySummary {
  constructor(private readonly deps: AppDeps) {}

  /**
   * Sugestão do check-in do próprio ator, a partir das tarefas movidas no dia. Só leitura: nada é
   * gravado, e o texto só vira daily se a pessoa salvar. Não usa Sprints nem backlog: o backlog é
   * excluído pela regra de visibilidade, não por módulo.
   */
  async execute(actor: Actor, input: SuggestDailySummaryInput): Promise<DailySummarySuggestionDto> {
    const date = parseDateOnly(input.date)
    const tasks = await this.deps.tasks.listBoard(actor.organizationId, { userId: actor.userId })
    const visible = await visibleTasks(this.deps, actor.organizationId, tasks)
    const [eventLists, prefix] = await Promise.all([
      Promise.all(
        visible.map((task) => this.deps.timeline.listByTask(actor.organizationId, task.id)),
      ),
      findTaskPrefix(this.deps, actor.organizationId),
    ])
    return suggestDailySummary({
      actor,
      tasks: visible,
      events: eventLists.flat(),
      date,
      timeZone: input.timeZone,
      prefix,
    })
  }
}
