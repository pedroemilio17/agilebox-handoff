import { describe, expect, expectTypeOf, it } from 'vitest'
import { ValidationError } from './errors'
import {
  toContributorId,
  toEventId,
  toMeetingId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from './ids'
import type {
  ContributorId,
  EventId,
  MeetingId,
  OrganizationId,
  ParticipationId,
  ProjectId,
  TaskId,
  UserId,
} from './ids'

const converters = [
  toOrganizationId,
  toUserId,
  toContributorId,
  toProjectId,
  toTaskId,
  toParticipationId,
  toEventId,
  toMeetingId,
] as const

describe.each(converters)('conversor %s', (convert) => {
  it.each([
    '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    '00000000000000000000000000',
    '7ZZZZZZZZZZZZZZZZZZZZZZZZZ',
  ])('converte o ULID %s sem alterar seu valor', (value) => {
    expect(convert(value)).toBe(value)
  })

  it.each([
    '',
    ' ',
    'task-1',
    '01ARZ3NDEKTSV4RRFFQ69G5FA',
    '01ARZ3NDEKTSV4RRFFQ69G5FAV0',
    '81ARZ3NDEKTSV4RRFFQ69G5FAV',
    ...['I', 'L', 'O', 'U', '!'].map((character) => `01ARZ3NDEKTSV4RRFFQ69G5FA${character}`),
    ' 01ARZ3NDEKTSV4RRFFQ69G5FAV',
    '01ARZ3NDEKTSV4RRFFQ69G5FAV\n',
  ])('rejeita o ID inválido %j com VALIDATION', (value) => {
    expect(() => convert(value)).toThrow(ValidationError)
    expect(() => convert(value)).toThrow(expect.objectContaining({ code: 'VALIDATION' }))
  })
})

it('distingue os oito tipos de ID e impede atribuição de strings sem conversão', () => {
  type Ids = [
    OrganizationId,
    UserId,
    ContributorId,
    ProjectId,
    TaskId,
    ParticipationId,
    EventId,
    MeetingId,
  ]
  type ConvertedIds = { [Index in keyof typeof converters]: ReturnType<(typeof converters)[Index]> }

  expectTypeOf<ConvertedIds>().toEqualTypeOf<Readonly<Ids>>()
  expectTypeOf<string>().not.toExtend<Ids[number]>()
  expectTypeOf<Ids[number]>().toExtend<string>()
  expectTypeOf<OrganizationId>().not.toExtend<Exclude<Ids[number], OrganizationId>>()
  expectTypeOf<UserId>().not.toExtend<Exclude<Ids[number], UserId>>()
  expectTypeOf<ContributorId>().not.toExtend<Exclude<Ids[number], ContributorId>>()
  expectTypeOf<ProjectId>().not.toExtend<Exclude<Ids[number], ProjectId>>()
  expectTypeOf<TaskId>().not.toExtend<Exclude<Ids[number], TaskId>>()
  expectTypeOf<ParticipationId>().not.toExtend<Exclude<Ids[number], ParticipationId>>()
  expectTypeOf<EventId>().not.toExtend<Exclude<Ids[number], EventId>>()
  expectTypeOf<MeetingId>().not.toExtend<Exclude<Ids[number], MeetingId>>()
})
