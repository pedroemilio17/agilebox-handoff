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
