import {
  parseDateOnly,
  toOrganizationId,
  toProjectId,
  toSprintId,
  toTaskId,
  toUserId,
  ValidationError,
  SPRINT_STATUSES,
  SPRINT_TASK_OUTCOMES,
} from '@agilebox/core'
import type {
  Sprint,
  SprintClosePolicy,
  SprintStatus,
  SprintTask,
  SprintTaskOutcome,
} from '@agilebox/core'
import type { sprints, sprintTasks } from '../schema/index.js'

type SprintRow = typeof sprints.$inferSelect
type SprintTaskRow = typeof sprintTasks.$inferSelect

function toStatus(value: string): SprintStatus {
  if (!(SPRINT_STATUSES as readonly string[]).includes(value))
    throw new ValidationError('Estado da sprint inválido')
  return value as SprintStatus
}

function toOutcome(value: string): SprintTaskOutcome {
  if (!(SPRINT_TASK_OUTCOMES as readonly string[]).includes(value))
    throw new ValidationError('Desfecho da sprint inválido')
  return value as SprintTaskOutcome
}

/** A política de encerramento vai como JSON no banco; nula enquanto a sprint não encerra. */
export function closePolicyToText(policy: SprintClosePolicy | null): string | null {
  return policy === null ? null : JSON.stringify(policy)
}

function closePolicyFromText(value: string | null): SprintClosePolicy | null {
  if (value === null) return null
  const parsed = JSON.parse(value) as { kind: string; nextSprintId?: string }
  if (parsed.kind === 'carry_over' && parsed.nextSprintId !== undefined)
    return { kind: 'carry_over', nextSprintId: toSprintId(parsed.nextSprintId) }
  if (parsed.kind === 'return_to_backlog') return { kind: 'return_to_backlog' }
  throw new ValidationError('Política de encerramento inválida')
}

export function mapSprintRow(row: SprintRow): Sprint {
  return {
    id: toSprintId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    number: row.number,
    name: row.name,
    goal: row.goal ?? null,
    plannedStart: parseDateOnly(row.plannedStart),
    plannedEnd: parseDateOnly(row.plannedEnd),
    status: toStatus(row.status),
    startedAt: row.startedAt ?? null,
    closedAt: row.closedAt ?? null,
    closePolicy: closePolicyFromText(row.closePolicy ?? null),
    createdBy: toUserId(row.createdBy),
    createdAt: row.createdAt,
  }
}

export function mapSprintTaskRow(row: SprintTaskRow): SprintTask {
  return {
    sprintId: toSprintId(row.sprintId),
    organizationId: toOrganizationId(row.organizationId),
    taskId: toTaskId(row.taskId),
    addedAt: row.addedAt,
    addedBy: toUserId(row.addedBy),
    removedAt: row.removedAt ?? null,
    removedBy:
      row.removedBy === null || row.removedBy === undefined ? null : toUserId(row.removedBy),
    outcome: toOutcome(row.outcome),
  }
}
