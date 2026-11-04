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
export type ChecklistItemId = Id<'ChecklistItem'>
export type TaskCommentId = Id<'TaskComment'>
export type BoardSettingsId = Id<'BoardSettings'>
export type DefinitionOfDoneItemId = Id<'DefinitionOfDoneItem'>
export type RetroActionId = Id<'RetroAction'>
export type DailyEntryId = Id<'DailyEntry'>

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
export const toChecklistItemId = (value: string): ChecklistItemId => toId(value)
export const toTaskCommentId = (value: string): TaskCommentId => toId(value)
export const toBoardSettingsId = (value: string): BoardSettingsId => toId(value)
export const toDefinitionOfDoneItemId = (value: string): DefinitionOfDoneItemId => toId(value)
export const toRetroActionId = (value: string): RetroActionId => toId(value)
export const toDailyEntryId = (value: string): DailyEntryId => toId(value)
