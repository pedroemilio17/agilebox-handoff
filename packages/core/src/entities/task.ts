import { ConflictError, ValidationError } from '../shared/errors'
import type {
  DeliverableId,
  OrganizationId,
  ParticipationId,
  ProjectId,
  TaskId,
  UserId,
} from '../shared/ids'
import { parseDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { estimateToHundredths } from '../values/hours'
import { parseTaskPriority } from '../values/task-priority'
import type { TaskPriority } from '../values/task-priority'
import { parseTaskStatus, TASK_STATUS_LABELS } from '../values/task-status'
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
  /** Arquivar esconde a tarefa das visões padrão; nunca apaga. Nulos quando ativa. */
  readonly archivedAt: string | null
  readonly archivedBy: UserId | null
  /**
   * Posição no backlog do projeto (inteiro com espaçamento, ver rules/backlog.ts). Nulo = a tarefa
   * está no quadro; não nulo = é um item de backlog, que não aparece no quadro nem nas listas.
   */
  readonly backlogRank: number | null
  /** Estimativa em centésimos de hora (ADR-07, módulo `estimates.hours`). Nulo = sem estimativa. */
  readonly estimatedHoursHundredths: number | null
  /** Entrega da EAP à qual a tarefa aponta (qualquer nível do projeto). Nulo = sem entrega. */
  readonly deliverableId: DeliverableId | null
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
  /** Entrega de destino. Ausente = sem entrega. */
  readonly deliverableId?: DeliverableId | null
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
    archivedAt: null,
    archivedBy: null,
    backlogRank: null,
    estimatedHoursHundredths: null,
    deliverableId: input.deliverableId ?? null,
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
/** Arquivar esconde a tarefa; ela continua recuperável (desarquivar). */
export function archiveTask(task: Task, by: UserId, at: string): Task {
  if (task.archivedAt !== null) throw new ConflictError('Tarefa já está arquivada')
  return { ...task, archivedAt: at, archivedBy: by }
}
export function unarchiveTask(task: Task): Task {
  if (task.archivedAt === null) throw new ConflictError('Tarefa não está arquivada')
  return { ...task, archivedAt: null, archivedBy: null }
}
/** Item de backlog: a tarefa tem posição no backlog e fica fora do quadro. */
export function isInBacklog(task: Pick<Task, 'backlogRank'>): boolean {
  return task.backlogRank !== null
}
/** Backlog segue a regra de arquivamento: tarefa arquivada não muda de lugar nem entra no backlog. */
function assertBacklogAllowed(task: Task): void {
  if (task.archivedAt !== null) throw new ConflictError('Tarefa arquivada não pode ser alterada')
}
/**
 * Cria o item de backlog a partir de uma tarefa em Planejamento (criação direta no backlog).
 * O estado do item no backlog é sempre Planejamento, separado da coluna do quadro.
 */
export function addToBacklog(task: Task, rank: number): Task {
  assertBacklogAllowed(task)
  if (isInBacklog(task)) throw new ConflictError('Tarefa já está no backlog')
  if (task.status !== 'planning')
    throw new ConflictError('Só entra no backlog tarefa em Planejamento')
  return { ...task, backlogRank: rank }
}
/**
 * Devolve ao backlog uma tarefa que ainda não começou (Planejamento ou A fazer): o estado vira
 * Planejamento. Tarefa em andamento, revisão ou concluída não volta, para não perder o trabalho.
 */
export function sendToBacklog(task: Task, rank: number): Task {
  assertBacklogAllowed(task)
  if (isInBacklog(task)) throw new ConflictError('Tarefa já está no backlog')
  if (task.status !== 'planning' && task.status !== 'todo')
    throw new ConflictError(
      `Tarefa em ${TASK_STATUS_LABELS[task.status]} já começou: só volta ao backlog tarefa em Planejamento ou A fazer`,
    )
  return { ...task, status: 'planning', backlogRank: rank }
}
/** Puxa o item para o quadro, numa coluna (A fazer por padrão). Planejamento não é coluna de saída. */
export function pullFromBacklog(task: Task, status: TaskStatus = 'todo'): Task {
  assertBacklogAllowed(task)
  if (!isInBacklog(task)) throw new ConflictError('Tarefa não está no backlog')
  const next = parseTaskStatus(status)
  if (next === 'planning')
    throw new ValidationError(
      'Puxe a tarefa para uma coluna: A fazer, Desenvolvendo, Revisar ou Concluído',
    )
  return setStatus({ ...task, backlogRank: null }, next)
}
/** Grava a nova posição de um item de backlog (usado pela reordenação). */
export function setBacklogRank(task: Task, rank: number): Task {
  assertBacklogAllowed(task)
  if (!isInBacklog(task)) throw new ConflictError('Tarefa não está no backlog')
  return { ...task, backlogRank: rank }
}
/**
 * Estimativa em horas (M3.2). Nulo remove a estimativa. Tarefa arquivada não muda, como nas demais
 * alterações. Valor igual ao atual devolve a mesma tarefa (sem evento na linha do tempo).
 */
export function setEstimatedHours(task: Task, hours: number | null): Task {
  if (task.archivedAt !== null) throw new ConflictError('Tarefa arquivada não pode ser alterada')
  const next = estimateToHundredths(hours)
  return next === task.estimatedHoursHundredths ? task : { ...task, estimatedHoursHundredths: next }
}
/** Aponta a tarefa para uma entrega (ou remove o vínculo com nulo). Sem evento de linha do tempo ainda. */
export function setTaskDeliverable(task: Task, deliverableId: DeliverableId | null): Task {
  return task.deliverableId === deliverableId ? task : { ...task, deliverableId }
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
