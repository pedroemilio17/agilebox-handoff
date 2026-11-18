import type { OrganizationId, TaskId, UserId } from '../shared/ids'

/**
 * Dependência entre tarefas do mesmo projeto (ADR-10, módulo `schedule`). Só existe o tipo
 * término→início: o término da predecessora vem antes do início da sucessora. A regra de ciclo,
 * duplicata e projeto fica em `rules/schedule.ts`.
 */
export interface TaskDependency {
  readonly organizationId: OrganizationId
  readonly predecessorId: TaskId
  readonly successorId: TaskId
  readonly createdAt: string
  readonly createdBy: UserId
}
