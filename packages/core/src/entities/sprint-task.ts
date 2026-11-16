import { ConflictError } from '../shared/errors'
import type { OrganizationId, SprintId, TaskId, UserId } from '../shared/ids'

/**
 * Como a tarefa saiu da sprint (ou `open` enquanto ainda está nela).
 * - `completed`: estava concluída no encerramento.
 * - `returned_to_backlog`: aberta, devolvida ao backlog no encerramento ou no descarte.
 * - `carried_over`: aberta, levada para a sprint seguinte (a linha nova nasce lá).
 * - `removed`: saiu antes do fim (removida manualmente ou arquivada no encerramento).
 */
export const SPRINT_TASK_OUTCOMES = [
  'open',
  'completed',
  'returned_to_backlog',
  'carried_over',
  'removed',
] as const
export type SprintTaskOutcome = (typeof SPRINT_TASK_OUTCOMES)[number]

/**
 * Histórico de uma tarefa numa sprint. Linhas nunca são apagadas: sair da sprint só fecha a linha
 * (`removedAt`, `removedBy`, `outcome`). Uma tarefa pode ter várias linhas na mesma sprint se
 * entrar, sair e voltar; a linha aberta, quando existe, é a da sprint atual.
 */
export interface SprintTask {
  readonly sprintId: SprintId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  readonly addedAt: string
  readonly addedBy: UserId
  /** Nulo enquanto a tarefa está na sprint. */
  readonly removedAt: string | null
  readonly removedBy: UserId | null
  readonly outcome: SprintTaskOutcome
}

export function isOpenSprintTask(row: Pick<SprintTask, 'removedAt'>): boolean {
  return row.removedAt === null
}

/** Nova linha de histórico: a tarefa acabou de entrar na sprint. */
export function createSprintTask(input: {
  readonly sprintId: SprintId
  readonly organizationId: OrganizationId
  readonly taskId: TaskId
  readonly addedAt: string
  readonly addedBy: UserId
}): SprintTask {
  return {
    sprintId: input.sprintId,
    organizationId: input.organizationId,
    taskId: input.taskId,
    addedAt: input.addedAt,
    addedBy: input.addedBy,
    removedAt: null,
    removedBy: null,
    outcome: 'open',
  }
}

/** Fecha a linha: a tarefa saiu da sprint. Não se fecha duas vezes e o desfecho não é `open`. */
export function closeSprintTask(
  row: SprintTask,
  outcome: Exclude<SprintTaskOutcome, 'open'>,
  at: string,
  by: UserId,
): SprintTask {
  if (!isOpenSprintTask(row)) throw new ConflictError('Tarefa já saiu desta sprint')
  return { ...row, removedAt: at, removedBy: by, outcome }
}
