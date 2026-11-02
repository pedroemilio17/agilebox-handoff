import type { Participant } from '../entities/participation'
import type { Project } from '../entities/project'
import type { Task } from '../entities/task'
import type { OrganizationId } from '../shared/ids'
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
/**
 * Arquivar, desarquivar e renomear projeto: gestor ou criador (decisão do Pedro, M3.0c).
 * Política própria, separada de `canManageMembers`, para que cada regra possa mudar sem afetar a outra.
 */
export function canArchiveProject(actor: Actor, project: Project): boolean {
  return (
    actor.organizationId === project.organizationId &&
    (actor.role === 'manager' || actor.userId === project.createdBy)
  )
}
/**
 * Renomear projeto: mesma regra de `canArchiveProject` (gestor ou criador), mantida em função
 * própria para que cada uma possa mudar sem afetar a outra. A unicidade do nome ativo não está aqui:
 * é checada no caso de uso e imposta pelo índice do banco.
 */
export function canRenameProject(actor: Actor, project: Project): boolean {
  return (
    actor.organizationId === project.organizationId &&
    (actor.role === 'manager' || actor.userId === project.createdBy)
  )
}
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
export const canSeeDashboard = canSeeTaskTotal
export function isManagerEdit(actor: Actor): boolean {
  return actor.role === 'manager'
}
/** Ferramentas do time são aplicadas pelo gestor (aceite entre membros entra no M6b). */
export function canManageTeamModules(actor: Actor): boolean {
  return actor.role === 'manager'
}
/** A ordem do backlog é única por time e só o gestor reordena (B2 A, B3 A). */
export function canReorderBacklog(actor: Actor, organizationId: OrganizationId): boolean {
  return actor.organizationId === organizationId && actor.role === 'manager'
}
/**
 * Critérios de aceite (M3.2, B3 A): quem edita a tarefa edita os critérios dela (criou, é
 * Responsável ou Apoio); o gestor também, e essas edições saem marcadas como Gestor na linha do tempo.
 * Mesma regra de `canEditTask`, em função própria para que a regra dos critérios possa mudar sem afetar a tarefa.
 */
export function canEditAcceptance(actor: Actor, task: Task): boolean {
  return canEditTask(actor, task)
}
/**
 * Estimativa em horas (M3.3, ADR-07): por padrão, quem edita a tarefa define a estimativa; o gestor
 * também, e a edição sai marcada como Gestor. Função própria, para que a regra possa mudar sem afetar a tarefa.
 */
export function canEditEstimate(actor: Actor, task: Task): boolean {
  return canEditTask(actor, task)
}
