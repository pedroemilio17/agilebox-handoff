import { describe, expect, it } from 'vitest'
import {
  createTenantContext,
  parseDateOnly,
  PermissionDeniedError,
  toMeetingId,
  toOrganizationId,
  toUserId,
  ValidationError,
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
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
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
  it('lista os agendamentos do mês em ordem cronológica', async () => {
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
      useCases.meetings.listMonth.execute(createTenantContext(actor), actor, { month: '2026-02' }),
    ).resolves.toMatchObject([{ id: earlier.id }, { id: later.id }])
  })

  it('lista os próximos agendamentos a partir de hoje', async () => {
    const { useCases, unitOfWork } = setup()
    const today = aMeeting()
      .with({ date: parseDateOnly('2026-01-20') })
      .build()
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting()
        .with({ date: parseDateOnly('2026-01-19') })
        .build(),
    )
    await unitOfWork.repositories.meetings.save(organizationId, today)

    await expect(
      useCases.meetings.listUpcoming.execute(createTenantContext(actor), actor),
    ).resolves.toMatchObject([{ id: today.id }])
  })

  it('permite somente ao gestor criar, atualizar e excluir agendamentos', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const existing = aMeeting().build()
    await unitOfWork.repositories.meetings.save(organizationId, existing)
    await expect(
      useCases.meetings.create.execute(createTenantContext(actor), actor, {
        title: 'Planejamento',
        date: '2026-02-10',
        time: '09:30',
        participants: [userId],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.meetings.update.execute(createTenantContext(actor), actor, {
        meetingId: existing.id,
        changes: { title: 'Alteração não autorizada' },
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.meetings.delete.execute(createTenantContext(actor), actor, {
        meetingId: existing.id,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)

    const created = await useCases.meetings.create.execute(createTenantContext(manager), manager, {
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
    const updated = await useCases.meetings.update.execute(createTenantContext(manager), manager, {
      meetingId: created.id,
      changes: { time: '10:00', participants: [] },
    })
    expect(updated).toMatchObject({
      time: '10:00',
      participants: [],
      updatedAt: '2026-01-20T12:00:00.000Z',
    })
    await useCases.meetings.delete.execute(createTenantContext(manager), manager, {
      meetingId: created.id,
    })
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

  it('rejeita atualização e exclusão de agendamento inexistente', async () => {
    const { useCases } = setup()
    const meetingId = toMeetingId('00000000000000000000000010')
    await expect(
      useCases.meetings.update.execute(createTenantContext(manager), manager, {
        meetingId,
        changes: { title: 'Novo título' },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.meetings.delete.execute(createTenantContext(manager), manager, { meetingId }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('isolamento entre organizações (M1.10d)', () => {
  const otherOrganizationId = toOrganizationId('00000000000000000000000099')
  const outsider: Actor = {
    userId: toUserId('00000000000000000000000077'),
    organizationId: otherOrganizationId,
    role: 'manager',
  }
  const outsiderCtx = createTenantContext(outsider)
  const newMeeting = {
    title: 'Planejamento',
    date: '2026-02-10',
    time: '09:30',
    participants: [userId],
  }

  it('agenda de outro time não aparece nas listagens', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting()
        .with({ date: parseDateOnly('2026-02-02') })
        .build(),
    )

    await expect(
      useCases.meetings.listMonth.execute(outsiderCtx, outsider, { month: '2026-02' }),
    ).resolves.toEqual([])
    await expect(useCases.meetings.listUpcoming.execute(outsiderCtx, outsider)).resolves.toEqual([])
    await expect(
      useCases.meetings.listMonth.execute(createTenantContext(manager), manager, {
        month: '2026-02',
      }),
    ).resolves.toHaveLength(1)
  })

  it('gestor de outro time não edita nem exclui agendamento daqui', async () => {
    const { useCases, unitOfWork } = setup()
    const existing = aMeeting().build()
    await unitOfWork.repositories.meetings.save(organizationId, existing)

    await expect(
      useCases.meetings.update.execute(outsiderCtx, outsider, {
        meetingId: existing.id,
        changes: { title: 'Não deve gravar' },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.meetings.delete.execute(outsiderCtx, outsider, { meetingId: existing.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    await expect(
      unitOfWork.repositories.meetings.findById(organizationId, existing.id),
    ).resolves.toMatchObject({ title: existing.title })
    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(1)
  })

  it('criar com ator de outro time grava no time do ator', async () => {
    const { useCases, unitOfWork } = setup()

    await useCases.meetings.create.execute(outsiderCtx, outsider, newMeeting)
    await expect(unitOfWork.repositories.meetings.count(otherOrganizationId)).resolves.toBe(1)
    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(0)
  })

  it('contexto de um time com ator de outro dá FORBIDDEN e não grava nem exclui nada', async () => {
    const { useCases, unitOfWork } = setup()
    const existing = aMeeting().build()
    await unitOfWork.repositories.meetings.save(organizationId, existing)

    await expect(
      useCases.meetings.create.execute(createTenantContext(manager), outsider, newMeeting),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.meetings.delete.execute(createTenantContext(manager), outsider, {
        meetingId: existing.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(1)
    await expect(unitOfWork.repositories.meetings.count(otherOrganizationId)).resolves.toBe(0)
  })
})

describe('guard de módulo na agenda (M1.8)', () => {
  const AGENDA_CHANGED_AT = '2026-01-01T00:00:00.000Z'

  async function setAgendaState(
    unitOfWork: ReturnType<typeof setup>['unitOfWork'],
    state: 'active' | 'winding_down' | 'disabled',
  ): Promise<void> {
    await unitOfWork.repositories.teamModules.save(organizationId, {
      moduleId: 'agenda',
      state,
      config: {},
      changedBy: managerId,
      changedAt: AGENDA_CHANGED_AT,
    })
  }

  const newMeeting = {
    title: 'Planejamento',
    date: '2026-02-10',
    time: '09:30',
    participants: [userId],
  }

  it('agenda desligada recusa listar, criar, editar e excluir, até para o gestor', async () => {
    const { useCases, unitOfWork } = setup()
    const existing = aMeeting().build()
    await unitOfWork.repositories.meetings.save(organizationId, existing)
    await setAgendaState(unitOfWork, 'disabled')

    await expect(
      useCases.meetings.listMonth.execute(createTenantContext(manager), manager, {
        month: '2026-02',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.meetings.listUpcoming.execute(createTenantContext(manager), manager),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.meetings.create.execute(createTenantContext(manager), manager, newMeeting),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.meetings.update.execute(createTenantContext(manager), manager, {
        meetingId: existing.id,
        changes: { title: 'Não deve gravar' },
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.meetings.delete.execute(createTenantContext(manager), manager, {
        meetingId: existing.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(1)
    await expect(
      unitOfWork.repositories.meetings.findById(organizationId, existing.id),
    ).resolves.toMatchObject({ title: existing.title })
  })

  it('agenda encerrando deixa listar, editar e excluir o que existe, mas não criar', async () => {
    const { useCases, unitOfWork } = setup()
    const existing = aMeeting()
      .with({ date: parseDateOnly('2026-02-02') })
      .build()
    await unitOfWork.repositories.meetings.save(organizationId, existing)
    await setAgendaState(unitOfWork, 'winding_down')

    await expect(
      useCases.meetings.listMonth.execute(createTenantContext(actor), actor, { month: '2026-02' }),
    ).resolves.toMatchObject([{ id: existing.id }])
    await expect(
      useCases.meetings.create.execute(createTenantContext(manager), manager, newMeeting),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(1)

    const updated = await useCases.meetings.update.execute(createTenantContext(manager), manager, {
      meetingId: existing.id,
      changes: { time: '11:00' },
    })
    expect(updated).toMatchObject({ time: '11:00' })
    await useCases.meetings.delete.execute(createTenantContext(manager), manager, {
      meetingId: existing.id,
    })
    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(0)
  })

  it('agenda ativa permite o fluxo completo do gestor', async () => {
    const { useCases, unitOfWork } = setup()
    await setAgendaState(unitOfWork, 'active')

    const created = await useCases.meetings.create.execute(
      createTenantContext(manager),
      manager,
      newMeeting,
    )
    await expect(
      useCases.meetings.listUpcoming.execute(createTenantContext(actor), actor),
    ).resolves.toMatchObject([{ id: created.id }])
    await useCases.meetings.delete.execute(createTenantContext(manager), manager, {
      meetingId: created.id,
    })
    await expect(unitOfWork.repositories.meetings.count(organizationId)).resolves.toBe(0)
  })

  it('organização sem registro de módulos usa o preset: agenda ativa', async () => {
    const { useCases, unitOfWork } = setup()

    await expect(unitOfWork.repositories.teamModules.list(organizationId)).resolves.toEqual([])
    await expect(
      useCases.meetings.create.execute(createTenantContext(manager), manager, newMeeting),
    ).resolves.toMatchObject({
      title: newMeeting.title,
    })
    await expect(
      useCases.meetings.listUpcoming.execute(createTenantContext(actor), actor),
    ).resolves.toHaveLength(1)
  })
})
