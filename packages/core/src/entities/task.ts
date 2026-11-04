import { ValidationError } from '../shared/errors'
import type { OrganizationId, ParticipationId, ProjectId, TaskId, UserId } from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { parseTaskPriority } from '../values/task-priority'
import type { TaskPriority } from '../values/task-priority'
import { parseTaskStatus } from '../values/task-status'
import type { TaskStatus } from '../values/task-status'
import { createTicket } from '../values/ticket'
import type { Ticket } from '../values/ticket'
import { createParticipation } from './participation'
import type { Participation, Participant } from './participation'
import { validateBlockReason, validateName, validateTaskNumber } from './validation'

export interface Task {
  readonly id: TaskId
  readonly organizationId: OrganizationId
  readonly number: number
  readonly projectId: ProjectId
  readonly projectName: string
  readonly createdBy: UserId
  readonly title: string
  readonly description: string
  readonly status: TaskStatus
  readonly priority: TaskPriority
  readonly blockedReason: string | null
  readonly blockedAt: string | null
  readonly deadline: DateOnly | null
  readonly ticket: Ticket | null
  readonly searchText: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly participations: readonly Participation[]
}

export interface CreateTaskInput {
  readonly id: TaskId
  readonly organizationId: OrganizationId
  readonly number: number
  readonly projectId: ProjectId
  readonly projectName: string
  readonly createdBy: UserId
  readonly title: string
  readonly createdAt: string
  readonly responsibleParticipationId: ParticipationId
  readonly responsibleRateCents: number
}

function searchText(title: string, projectName: string): string {
  return `${title} ${projectName}`
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/gu, ' ')
}

export function createTask(input: CreateTaskInput): Task {
  const title = validateName(input.title)
  const projectName = validateName(input.projectName)
  const number = validateTaskNumber(input.number)
  const responsible = createParticipation({
    id: input.responsibleParticipationId,
    taskId: input.id,
    participant: { kind: 'user', userId: input.createdBy },
    role: 'responsible',
    hoursHundredths: 0,
    rateCents: input.responsibleRateCents,
    addedAt: input.createdAt,
  })
  return {
    id: input.id,
    organizationId: input.organizationId,
    number,
    projectId: input.projectId,
    projectName,
    createdBy: input.createdBy,
    title,
    description: '',
    status: 'planning',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    deadline: null,
    ticket: null,
    searchText: searchText(title, projectName),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    participations: [responsible],
  }
}

export function renameTask(task: Task, value: string): Task {
  const title = validateName(value)
  return { ...task, title, searchText: searchText(title, task.projectName) }
}
export function setDescription(task: Task, description: string): Task {
  return { ...task, description }
}
/** Concluir a tarefa limpa o bloqueio: a tarefa concluída não pode seguir bloqueada. */
export function setStatus(task: Task, status: TaskStatus): Task {
  const next = parseTaskStatus(status)
  if (next === 'done') return { ...task, status: next, blockedReason: null, blockedAt: null }
  return { ...task, status: next }
}
/** Bloqueio é uma marca ortogonal ao estado: a tarefa continua no estado em que está. */
export function blockTask(task: Task, reason: string, at: string): Task {
  if (task.status === 'done') throw new ValidationError('Tarefa concluída não pode ser bloqueada')
  const blockedReason = validateBlockReason(reason)
  if (task.blockedReason === blockedReason) return task
  return { ...task, blockedReason, blockedAt: at }
}
export function unblockTask(task: Task): Task {
  if (task.blockedReason === null) return task
  return { ...task, blockedReason: null, blockedAt: null }
}
export function setPriority(task: Task, priority: TaskPriority): Task {
  return { ...task, priority: parseTaskPriority(priority) }
}
export function setDeadline(task: Task, deadline: DateOnly | null): Task {
  return { ...task, deadline: deadline === null ? null : parseDateOnly(deadline) }
}
export function setTicket(task: Task, ticket: Ticket | null): Task {
  return { ...task, ticket: ticket === null ? null : createTicket(ticket.id, ticket.url) }
}

function sameParticipant(a: Participant, b: Participant): boolean {
  return a.kind === 'user' && b.kind === 'user'
    ? a.userId === b.userId
    : a.kind === 'contributor' && b.kind === 'contributor' && a.contributorId === b.contributorId
}
export function addParticipant(task: Task, input: Participation): Task {
  const participation = createParticipation(input)
  if (
    participation.taskId !== task.id ||
    participation.role === 'responsible' ||
    task.participations.some(
      (p) => p.id === participation.id || sameParticipant(p.participant, participation.participant),
    )
  )
    throw new ValidationError('Envolvimento inválido ou duplicado')
  return { ...task, participations: [...task.participations, participation] }
}
export function removeParticipant(task: Task, id: ParticipationId): Task {
  const participation = task.participations.find((p) => p.id === id)
  if (!participation || participation.role === 'responsible')
    throw new ValidationError('Não é possível remover este envolvimento')
  return { ...task, participations: task.participations.filter((p) => p.id !== id) }
}
export function changeResponsible(task: Task, userId: UserId): Task {
  const next = task.participations.find(
    (p) => p.participant.kind === 'user' && p.participant.userId === userId,
  )
  if (!next) throw new ValidationError('Responsável deve participar da tarefa')
  return {
    ...task,
    participations: task.participations.map((p) =>
      p.id === next.id
        ? { ...p, role: 'responsible' }
        : p.role === 'responsible'
          ? { ...p, role: 'support' }
          : p,
    ),
  }
}
