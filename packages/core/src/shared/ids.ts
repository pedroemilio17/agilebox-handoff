import { ValidationError } from './errors'

declare const idBrand: unique symbol
type Id<Kind extends string> = string & { readonly [idBrand]: Kind }

export type OrganizationId = Id<'Organization'>
export type UserId = Id<'User'>
export type ContributorId = Id<'Contributor'>
export type ProjectId = Id<'Project'>
export type TaskId = Id<'Task'>
export type ParticipationId = Id<'Participation'>
export type EventId = Id<'Event'>
export type MeetingId = Id<'Meeting'>

function toId<Kind extends string>(value: string): Id<Kind> {
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value) || value.length !== 26) {
    throw new ValidationError('Identificador inválido')
  }
  return value as Id<Kind>
}

export const toOrganizationId = (value: string): OrganizationId => toId(value)
export const toUserId = (value: string): UserId => toId(value)
export const toContributorId = (value: string): ContributorId => toId(value)
export const toProjectId = (value: string): ProjectId => toId(value)
export const toTaskId = (value: string): TaskId => toId(value)
export const toParticipationId = (value: string): ParticipationId => toId(value)
export const toEventId = (value: string): EventId => toId(value)
export const toMeetingId = (value: string): MeetingId => toId(value)
