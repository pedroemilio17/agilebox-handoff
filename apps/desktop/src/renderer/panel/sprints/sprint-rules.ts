import {
  addDays,
  sprintLabel,
  diffInDays,
  isAddedMidSprint,
  isStartedTaskStatus,
  parseDateOnly,
  TASK_STATUSES,
  validateSprintDates,
  validateSprintGoal,
  validateSprintName,
} from '@agilebox/core'
import type { DateOnly, TaskStatus } from '@agilebox/core'
import type { SprintDto, SprintHistoryRowDto, TaskDto } from '@agilebox/contract'

/** Valores digitados no formulário de sprint (datas em `YYYY-MM-DD`, vazias quando não preenchidas). */
export interface SprintFormValues {
  readonly name: string
  readonly goal: string
  readonly plannedStart: string
  readonly plannedEnd: string
}

export type SprintFormErrors = Partial<Record<keyof SprintFormValues, string>>

/**
 * Validação do formulário com as mesmas regras e mensagens do domínio (`core`). Nome e meta usam
 * os validadores de `entities/sprint`; as datas, os de `validateSprintDates`. Não duplica regra.
 */
export function validateSprintForm(values: SprintFormValues): SprintFormErrors {
  const errors: SprintFormErrors = {}
  try {
    validateSprintName(values.name, 1)
  } catch (error) {
    errors.name = messageOf(error)
  }
  try {
    validateSprintGoal(values.goal)
  } catch (error) {
    errors.goal = messageOf(error)
  }
  if (values.plannedStart === '') errors.plannedStart = 'Informe a data de início.'
  if (values.plannedEnd === '') errors.plannedEnd = 'Informe a data de fim.'
  if (!errors.plannedStart && !errors.plannedEnd) {
    try {
      validateSprintDates(values.plannedStart, values.plannedEnd)
    } catch (error) {
      errors.plannedEnd = messageOf(error)
    }
  }
  return errors
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Verifique os dados da sprint.'
}

/** Soma das horas estimadas e realizadas dos itens (horas com fração, como em `TaskDto`). */
export function sumHours(items: readonly TaskDto[]): { estimated: number; actual: number } {
  return items.reduce(
    (total, item) => ({
      estimated: total.estimated + (item.estimatedHours ?? 0),
      actual: total.actual + (item.actualHours ?? 0),
    }),
    { estimated: 0, actual: 0 },
  )
}

/** Itens agrupados por estado, na ordem do mini-quadro (Planejamento … Concluído). */
export function groupByStatus(items: readonly TaskDto[]): Record<TaskStatus, TaskDto[]> {
  const groups = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, [] as TaskDto[]]),
  ) as Record<TaskStatus, TaskDto[]>
  for (const item of items) groups[item.status].push(item)
  return groups
}

export interface CloseSummary {
  readonly done: number
  /** Tudo que não está concluído. */
  readonly open: number
  /** Dos abertos, os que já foram iniciados (Desenvolvendo ou Revisar). */
  readonly started: number
}

/** Resumo do encerramento, calculado sobre os itens que estão na sprint agora. */
export function closeSummary(items: readonly TaskDto[]): CloseSummary {
  const done = items.filter((item) => item.status === 'done').length
  const open = items.filter((item) => item.status !== 'done')
  return {
    done,
    open: open.length,
    started: open.filter((item) => isStartedTaskStatus(item.status)).length,
  }
}

/** Ids dos itens que entraram na sprint depois de ela começar (marcados "no meio da sprint"). */
export function midSprintTaskIds(
  history: readonly SprintHistoryRowDto[],
  sprint: Pick<SprintDto, 'startedAt'>,
): Set<string> {
  return new Set(
    history
      .filter((row) => row.removedAt === null && isAddedMidSprint(row, sprint))
      .map((row) => row.taskId),
  )
}

/** Sprint de outra pessoa ou de outro momento: o item já tem sprint aberta diferente desta. */
export function heldByOtherSprint(task: Pick<TaskDto, 'sprint'>, sprintId: string): boolean {
  return task.sprint != null && task.sprint.id !== sprintId
}

/** Rascunhos que podem receber os itens abertos de uma sprint encerrada (mesmo projeto). */
export function carryTargets(
  sprints: readonly SprintDto[],
  projectId: string,
  closingId: string,
): SprintDto[] {
  return sprints.filter(
    (sprint) =>
      sprint.status === 'draft' && sprint.projectId === projectId && sprint.id !== closingId,
  )
}

/** Datas do replanejamento: a mesma duração da sprint de origem, começando em `today`. */
export function replanDates(
  source: Pick<SprintDto, 'plannedStart' | 'plannedEnd'>,
  today: DateOnly,
): { plannedStart: string; plannedEnd: string } {
  const span = diffInDays(parseDateOnly(source.plannedStart), parseDateOnly(source.plannedEnd))
  return { plannedStart: today, plannedEnd: addDays(today, Math.max(0, span)) }
}

/** Sinal de progresso: concluídos sobre o total, com 0 quando não há itens. */
export function progressOf(items: readonly TaskDto[]): { done: number; total: number } {
  return { done: items.filter((item) => item.status === 'done').length, total: items.length }
}

/** Marcador "Sprint N" de uma tarefa (efeito passivo). Nulo quando não há sprint aberta. */
export function sprintMarker(task: Pick<TaskDto, 'sprint'>): string | null {
  return task.sprint ? sprintLabel(task.sprint.number) : null
}
