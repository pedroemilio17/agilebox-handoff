import type { DailyEntry } from '../entities/daily-entry'
import type { Meeting } from '../entities/meeting'
import type { RetroAction } from '../entities/retro-action'
import type { Participant } from '../entities/participation'
import type { Project } from '../entities/project'
import type { Task } from '../entities/task'
import type { TaskComment } from '../entities/task-comment'
import type { OrganizationId, UserId } from '../shared/ids'
import type { DateOnly } from '../values/date-only'
import type { Actor } from './actor'

export interface RateOwner {
  readonly organizationId: OrganizationId
  readonly participant: Participant
}

export function participates(actor: Actor, task: Task): boolean {
  return (
    actor.organizationId === task.organizationId &&
    (task.createdBy === actor.userId ||
      task.participations.some(
        ({ participant }) => participant.kind === 'user' && participant.userId === actor.userId,
      ))
  )
}
export function canViewTask(actor: Actor, task: Task, isMember: boolean): boolean {
  return (
    actor.organizationId === task.organizationId &&
    (actor.role === 'manager' || isMember || participates(actor, task))
  )
}
export function canEditTask(actor: Actor, task: Task): boolean {
  return (
    actor.organizationId === task.organizationId &&
    (actor.role === 'manager' || participates(actor, task))
  )
}
export function isReadOnlyFor(actor: Actor, task: Task, isMember: boolean): boolean {
  return canViewTask(actor, task, isMember) && !canEditTask(actor, task)
}
export function canSeeProject(actor: Actor, project: Project, isMember: boolean): boolean {
  return actor.organizationId === project.organizationId && (actor.role === 'manager' || isMember)
}
export function canCreateTask(actor: Actor, project: Project, isMember: boolean): boolean {
  return canSeeProject(actor, project, isMember)
}
export function canManageMembers(actor: Actor, project: Project): boolean {
  return (
    actor.organizationId === project.organizationId &&
    (actor.role === 'manager' || actor.userId === project.createdBy)
  )
}
/** Editar a definição de pronto segue o botão Membros: gestor ou criador do projeto (PLANO 12.1). */
export const canManageDefinitionOfDone = canManageMembers
export function canSeeRate(actor: Actor, owner: RateOwner): boolean {
  return (
    actor.organizationId === owner.organizationId &&
    (actor.role === 'manager' ||
      (owner.participant.kind === 'user' && owner.participant.userId === actor.userId))
  )
}
export const canEditRate = canSeeRate
export function canSeeTaskTotal(actor: Actor, organizationId: OrganizationId): boolean {
  return actor.organizationId === organizationId && actor.role === 'manager'
}
export const canManageMeetings = canSeeTaskTotal
/** Todo usuário da organização vê todos os agendamentos dela; só o gestor os altera (canManageMeetings). */
export function canSeeMeeting(actor: Actor, meeting: Meeting): boolean {
  return actor.organizationId === meeting.organizationId
}
/** Só o gestor cria, edita, renomeia e remove combinados (PLANO 6.1 e B10). */
export function canManageRetroActions(actor: Actor, meeting: Meeting): boolean {
  return canManageMeetings(actor, meeting.organizationId)
}
/** Marcar como feito: o gestor ou o responsável pelo combinado (sempre um usuário). */
export function canToggleRetroAction(actor: Actor, action: RetroAction): boolean {
  return (
    actor.organizationId === action.organizationId &&
    (actor.role === 'manager' || action.responsibleId === actor.userId)
  )
}
/** Combinados seguem a agenda: quem vê o agendamento vê os combinados dele. */
export const canSeeRetroActions = canSeeMeeting
export const canSeeDashboard = canSeeTaskTotal
/** Qualquer usuário da organização lê os limites de WIP; só o gestor os altera. */
export function canViewBoardSettings(actor: Actor, organizationId: OrganizationId): boolean {
  return actor.organizationId === organizationId
}
export const canManageBoardSettings = canSeeTaskTotal
/** Comentar e ver comentários seguem a edição da tarefa: participante ou gestor. */
export function canComment(actor: Actor, task: Task): boolean {
  return canEditTask(actor, task)
}
export const canSeeComments = canComment
/** Só o autor edita o próprio comentário, e só enquanto ainda pode editar a tarefa. */
export function canEditComment(actor: Actor, task: Task, comment: TaskComment): boolean {
  return (
    canEditTask(actor, task) &&
    comment.organizationId === actor.organizationId &&
    comment.taskId === task.id &&
    comment.authorId === actor.userId
  )
}
/** O autor remove o próprio comentário; o gestor remove qualquer um da organização. */
export function canRemoveComment(actor: Actor, task: Task, comment: TaskComment): boolean {
  return (
    canEditTask(actor, task) &&
    comment.organizationId === actor.organizationId &&
    comment.taskId === task.id &&
    (comment.authorId === actor.userId || actor.role === 'manager')
  )
}
export function isManagerEdit(actor: Actor): boolean {
  return actor.role === 'manager'
}

/** A daily é de quem a escreve: só a própria pessoa, e só do dia de hoje (não retroativa). */
export function canWriteDaily(
  actor: Actor,
  userId: UserId,
  date: DateOnly,
  today: DateOnly,
): boolean {
  return actor.userId === userId && date === today
}
/** Lê a própria daily. O gestor lê as da organização, em somente leitura. Colaborador não lê a de outro. */
export function canReadDaily(actor: Actor, entry: DailyEntry): boolean {
  return (
    actor.organizationId === entry.organizationId &&
    (actor.role === 'manager' || actor.userId === entry.userId)
  )
}
/** Lista do dia e leitura por pessoa: só o gestor da organização. Entidades não agem (não são Actor). */
export function canSeeDailyOverview(actor: Actor, organizationId: OrganizationId): boolean {
  return actor.organizationId === organizationId && actor.role === 'manager'
}
