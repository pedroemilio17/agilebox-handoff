import { describe, expect, it } from 'vitest'
import {
  parseDateOnly,
  PermissionDeniedError,
  toMeetingId,
  toOrganizationId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aMeeting } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const managerId = toUserId('00000000000000000000000003')
const actor: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock('2026-01-20T12:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

describe('casos de uso da agenda', () => {
  it('lista as ocorrências do intervalo em ordem cronológica', async () => {
    const { useCases, unitOfWork } = setup()
    const later = aMeeting()
      .with({
        id: toMeetingId('00000000000000000000000011'),
        date: parseDateOnly('2026-02-20'),
        time: '10:00',
      })
      .build()
    const earlier = aMeeting()
      .with({ id: toMeetingId('00000000000000000000000009'), date: parseDateOnly('2026-02-02') })
      .build()
    await unitOfWork.repositories.meetings.save(organizationId, later)
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting()
        .with({ date: parseDateOnly('2026-01-30') })
        .build(),
    )
    await unitOfWork.repositories.meetings.save(organizationId, earlier)

    await expect(
      useCases.meetings.listRange.execute(actor, {
        rangeStart: '2026-02-01',
        rangeEnd: '2026-02-28',
      }),
    ).resolves.toMatchObject([
      { id: earlier.id, occurrenceDate: '2026-02-02', occurrenceIndex: 0, seriesId: earlier.id },
      { id: later.id, occurrenceDate: '2026-02-20', occurrenceEndTime: '11:00' },
    ])
  })

  it('expande séries semanais nas ocorrências do intervalo', async () => {
    const { useCases, unitOfWork } = setup()
    const series = aMeeting()
      .with({
        id: toMeetingId('00000000000000000000000012'),
        date: parseDateOnly('2026-12-29'),
        time: '09:00',
        endTime: '10:00',
        recurrence: 'weekly',
        recurrenceUntil: parseDateOnly('2027-01-12'),
        participants: [userId],
      })
      .build()
    await unitOfWork.repositories.meetings.save(organizationId, series)

    const occurrences = await useCases.meetings.listRange.execute(actor, {
      rangeStart: '2026-12-01',
      rangeEnd: '2027-01-31',
    })
    expect(occurrences.map((item) => [item.occurrenceDate, item.occurrenceIndex])).toEqual([
      ['2026-12-29', 0],
      ['2027-01-05', 1],
      ['2027-01-12', 2],
    ])
    expect(occurrences[0]).toMatchObject({
      seriesId: series.id,
      recurrence: 'weekly',
      recurrenceUntil: '2027-01-12',
      endTime: '10:00',
      occurrenceEndTime: '10:00',
    })
  })

  it('colaborador vê todos os agendamentos da organização, inclusive os de que não participa', async () => {
    const { useCases, unitOfWork } = setup()
    const mine = aMeeting()
      .with({ id: toMeetingId('00000000000000000000000013') })
      .build()
    const notMine = aMeeting()
      .with({ id: toMeetingId('00000000000000000000000014'), participants: [managerId] })
      .build()
    await unitOfWork.repositories.meetings.save(organizationId, mine)
    await unitOfWork.repositories.meetings.save(organizationId, notMine)

    const range = { rangeStart: '2026-01-01', rangeEnd: '2026-01-31' }
    await expect(useCases.meetings.listRange.execute(actor, range)).resolves.toMatchObject([
      { id: mine.id },
      { id: notMine.id },
    ])
    await expect(useCases.meetings.listRange.execute(manager, range)).resolves.toHaveLength(2)
  })

  it('não mostra agendamentos de outra organização, nem ao gestor dela', async () => {
    const { useCases, unitOfWork } = setup()
    const otherOrganizationId = toOrganizationId('00000000000000000000000099')
    const foreign = aMeeting()
      .with({
        id: toMeetingId('00000000000000000000000018'),
        organizationId: otherOrganizationId,
        date: parseDateOnly('2026-01-25'),
        participants: [toUserId('00000000000000000000000099')],
      })
      .build()
    await unitOfWork.repositories.meetings.save(otherOrganizationId, foreign)

    const range = { rangeStart: '2026-01-01', rangeEnd: '2026-01-31' }
    await expect(useCases.meetings.listRange.execute(actor, range)).resolves.toEqual([])
    await expect(useCases.meetings.listRange.execute(manager, range)).resolves.toEqual([])
    await expect(useCases.meetings.listUpcoming.execute(actor)).resolves.toEqual([])
  })

  it('rejeita intervalo invertido', async () => {
    const { useCases } = setup()
    await expect(
      useCases.meetings.listRange.execute(actor, {
        rangeStart: '2026-02-10',
        rangeEnd: '2026-02-01',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('lista os próximos agendamentos a partir de hoje, incluindo ocorrências futuras de séries', async () => {
    const { useCases, unitOfWork } = setup()
    const today = aMeeting()
      .with({ date: parseDateOnly('2026-01-20') })
      .build()
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting()
        .with({ id: toMeetingId('00000000000000000000000015'), date: parseDateOnly('2026-01-19') })
        .build(),
    )
    await unitOfWork.repositories.meetings.save(organizationId, today)
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting()
        .with({
          id: toMeetingId('00000000000000000000000016'),
          date: parseDateOnly('2026-01-13'),
          recurrence: 'weekly',
          recurrenceUntil: null,
        })
        .build(),
    )

    const upcoming = await useCases.meetings.listUpcoming.execute(actor)
    // Avulso e série empatam em 20/01 às 09:00; a série continua em 27/01.
    expect(upcoming.map((item) => item.occurrenceDate).slice(0, 3)).toEqual([
      '2026-01-20',
      '2026-01-20',
      '2026-01-27',
    ])
    expect(upcoming.filter((item) => item.id === today.id)).toHaveLength(1)
    expect(upcoming.every((item) => item.occurrenceDate >= '2026-01-20')).toBe(true)
  })

  it('permite somente ao gestor criar, atualizar e excluir agendamentos', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const existing = aMeeting().build()
    await unitOfWork.repositories.meetings.save(organizationId, existing)
    await expect(
      useCases.meetings.create.execute(actor, {
        title: 'Planejamento',
        date: '2026-02-10',
        time: '09:30',
        participants: [userId],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.meetings.update.execute(actor, {
        meetingId: existing.id,
        changes: { title: 'Alteração não autorizada' },
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.meetings.delete.execute(actor, { meetingId: existing.id }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)

    const created = await useCases.meetings.create.execute(manager, {
      title: ' Planejamento ',
      date: '2026-02-10',
      time: '09:30',
      participants: [userId],
    })
    expect(created).toMatchObject({
      id: '00000000000000000000000000',
      title: 'Planejamento',
      createdBy: managerId,
      createdAt: '2026-01-20T12:00:00.000Z',
      updatedAt: '2026-01-20T12:00:00.000Z',
    })
    const updated = await useCases.meetings.update.execute(manager, {
      meetingId: created.id,
      changes: { time: '10:00', participants: [] },
    })
    expect(updated).toMatchObject({
      time: '10:00',
      participants: [],
      updatedAt: '2026-01-20T12:00:00.000Z',
    })
    await useCases.meetings.delete.execute(manager, { meetingId: created.id })
    await expect(
      unitOfWork.repositories.meetings.findById(organizationId, toMeetingId(created.id)),
    ).resolves.toBeNull()
    expect(notifier.changes).toHaveLength(3)
    expect(notifier.changes.map(({ change }) => change)).toEqual([
      { kind: 'meeting', ids: [created.id] },
      { kind: 'meeting', ids: [created.id] },
      { kind: 'meeting', ids: [created.id] },
    ])
  })

  it('edita e exclui a série inteira, sem exceções por ocorrência', async () => {
    const { useCases, unitOfWork } = setup()
    const series = aMeeting()
      .with({
        id: toMeetingId('00000000000000000000000017'),
        date: parseDateOnly('2026-11-02'),
        recurrence: 'weekly',
      })
      .build()
    await unitOfWork.repositories.meetings.save(organizationId, series)

    await useCases.meetings.update.execute(manager, {
      meetingId: series.id,
      changes: { time: '14:00', endTime: '15:00', recurrenceUntil: '2026-11-16' },
    })
    const afterEdit = await useCases.meetings.listRange.execute(manager, {
      rangeStart: '2026-11-01',
      rangeEnd: '2026-11-30',
    })
    expect(
      afterEdit.map((item) => [item.occurrenceDate, item.time, item.occurrenceEndTime]),
    ).toEqual([
      ['2026-11-02', '14:00', '15:00'],
      ['2026-11-09', '14:00', '15:00'],
      ['2026-11-16', '14:00', '15:00'],
    ])

    await useCases.meetings.delete.execute(manager, { meetingId: series.id })
    await expect(
      useCases.meetings.listRange.execute(manager, {
        rangeStart: '2026-11-01',
        rangeEnd: '2026-11-30',
      }),
    ).resolves.toEqual([])
  })

  it('valida fim, tipo e data limite na criação e na edição', async () => {
    const { useCases } = setup()
    await expect(
      useCases.meetings.create.execute(manager, {
        title: 'Reunião',
        date: '2026-02-10',
        time: '09:30',
        endTime: '09:30',
        participants: [userId],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    const created = await useCases.meetings.create.execute(manager, {
      title: 'Retro',
      date: '2026-02-10',
      time: '09:30',
      endTime: '10:30',
      kind: 'retro',
      recurrence: 'weekly',
      recurrenceUntil: '2026-03-10',
      participants: [userId],
    })
    expect(created).toMatchObject({
      endTime: '10:30',
      kind: 'retro',
      recurrence: 'weekly',
      recurrenceUntil: '2026-03-10',
    })
    await expect(
      useCases.meetings.update.execute(manager, {
        meetingId: created.id,
        changes: { recurrenceUntil: '2026-02-01' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      useCases.meetings.update.execute(manager, {
        meetingId: created.id,
        changes: { endTime: null, recurrenceUntil: null },
      }),
    ).resolves.toMatchObject({ endTime: null, recurrenceUntil: null })
  })

  it('rejeita atualização e exclusão de agendamento inexistente', async () => {
    const { useCases } = setup()
    const meetingId = toMeetingId('00000000000000000000000010')
    await expect(
      useCases.meetings.update.execute(manager, { meetingId, changes: { title: 'Novo título' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(useCases.meetings.delete.execute(manager, { meetingId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
