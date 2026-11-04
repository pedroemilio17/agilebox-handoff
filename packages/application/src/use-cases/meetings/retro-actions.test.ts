import { describe, expect, it } from 'vitest'
import {
  createUser,
  parseDateOnly,
  PermissionDeniedError,
  toContributorId,
  toMeetingId,
  toOrganizationId,
  toUserId,
  NotFoundError,
  ValidationError,
} from '@agilebox/core'
import type { Actor, Meeting, RetroActionId, UserId } from '@agilebox/core'
import { aMeeting } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const managerId = toUserId('00000000000000000000000003')
const anaId = toUserId('00000000000000000000000002')
const brunoId = toUserId('00000000000000000000000005')
const retroId = toMeetingId('00000000000000000000000010')
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const ana: Actor = { userId: anaId, organizationId, role: 'collaborator' }
const bruno: Actor = { userId: brunoId, organizationId, role: 'collaborator' }
const outsider: Actor = {
  userId: toUserId('00000000000000000000000007'),
  organizationId,
  role: 'collaborator',
}
const otherOrgManager: Actor = {
  userId: managerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

function setup(actor: Actor = manager) {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const clock = new FixedClock('2026-11-07T10:00:00.000Z')
  const useCases = createUseCases({
    actorSession,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    comments: unitOfWork.repositories.comments,
    clock,
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    retroActions: unitOfWork.repositories.retroActions,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

async function seed(unitOfWork: InMemoryUnitOfWork, meeting: Meeting = retro()) {
  const people: [UserId, string, Actor['role']][] = [
    [managerId, 'Gestor', 'manager'],
    [anaId, 'Ana', 'collaborator'],
    [brunoId, 'Bruno', 'collaborator'],
  ]
  for (const [id, name, role] of people) {
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id,
        organizationId,
        name,
        email: `${name.toLowerCase()}@example.com`,
        role,
        defaultRateCents: 4500,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
  }
  await unitOfWork.repositories.meetings.save(organizationId, meeting)
  return meeting
}

function retro(overrides: Partial<Meeting> = {}): Meeting {
  return aMeeting()
    .with({
      id: retroId,
      title: 'Retrospectiva da entrega',
      kind: 'retro',
      date: parseDateOnly('2026-11-06'),
      time: '16:00',
      endTime: '17:00',
      recurrence: 'weekly',
      recurrenceUntil: null,
      createdBy: managerId,
      participants: [anaId, brunoId],
      ...overrides,
    })
    .build()
}

const addInput = (overrides: Record<string, unknown> = {}) => ({
  meetingId: retroId,
  occurrenceDate: '2026-11-06',
  title: 'Revisar prazos de entrega',
  responsibleId: anaId,
  dueDate: '2026-11-13',
  ...overrides,
})

describe('combinados da retro: criação', () => {
  it('gestor cria combinado com responsável e prazo, e o nome do responsável volta no DTO', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(manager, addInput())
    expect(created).toMatchObject({
      meetingId: retroId,
      occurrenceDate: '2026-11-06',
      title: 'Revisar prazos de entrega',
      responsibleId: anaId,
      responsibleName: 'Ana',
      dueDate: '2026-11-13',
      done: false,
      doneAt: null,
      createdBy: managerId,
      canManage: true,
      canToggle: true,
    })
    expect(notifier.changes.at(-1)?.change).toMatchObject({ kind: 'meeting' })
  })

  it('colaborador não cria combinado', async () => {
    const { useCases, unitOfWork } = setup(ana)
    await seed(unitOfWork)
    await expect(
      useCases.meetings.retroActions.add.execute(ana, addInput()),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('recusa agendamento que não é do tipo Retro', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, retro({ kind: 'review' }))
    await expect(useCases.meetings.retroActions.add.execute(manager, addInput())).rejects.toThrow(
      'Só agendamentos do tipo Retro aceitam combinados',
    )
  })

  it('recusa data que não é ocorrência da série', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.meetings.retroActions.add.execute(
        manager,
        addInput({ occurrenceDate: '2026-11-07' }),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('recusa prazo anterior à ocorrência', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.meetings.retroActions.add.execute(manager, addInput({ dueDate: '2026-11-05' })),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('recusa responsável que é entidade (stakeholder) ou inexistente', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const contributorId = toContributorId('00000000000000000000000012')
    await expect(
      useCases.meetings.retroActions.add.execute(
        manager,
        addInput({ responsibleId: contributorId }),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.meetings.retroActions.add.execute(
        manager,
        addInput({ responsibleId: '00000000000000000000000099' }),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('aceita combinado sem responsável e sem prazo', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(
      manager,
      addInput({ responsibleId: null, dueDate: null }),
    )
    expect(created).toMatchObject({ responsibleId: null, responsibleName: null, dueDate: null })
  })

  it('limita a 30 combinados por ocorrência', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    for (let index = 0; index < 30; index++) {
      await useCases.meetings.retroActions.add.execute(manager, addInput({ dueDate: null }))
    }
    await expect(
      useCases.meetings.retroActions.add.execute(manager, addInput({ dueDate: null })),
    ).rejects.toThrow('Limite de 30 combinados por ocorrência')
  })
})

describe('combinados da retro: listagem e contagens', () => {
  it('qualquer usuário que vê a agenda vê os combinados, e a agenda traz as contagens', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const first = await useCases.meetings.retroActions.add.execute(manager, addInput())
    await useCases.meetings.retroActions.add.execute(
      manager,
      addInput({ title: 'Outro', responsibleId: brunoId, dueDate: null }),
    )
    await useCases.meetings.retroActions.toggle.execute(ana, { actionId: first.id, done: true })

    const listed = await useCases.meetings.retroActions.list.execute(outsider, {
      meetingId: retroId,
      occurrenceDate: '2026-11-06',
    })
    expect(listed).toHaveLength(2)
    expect(listed[0]).toMatchObject({ canManage: false, canToggle: false })

    const range = await useCases.meetings.listRange.execute(ana, {
      rangeStart: '2026-11-01',
      rangeEnd: '2026-11-30',
    })
    const occurrence = range.find((item) => item.occurrenceDate === '2026-11-06')
    expect(occurrence).toMatchObject({ retroActionsCount: 2, retroActionsDone: 1 })
    expect(range.find((item) => item.occurrenceDate === '2026-11-13')).toMatchObject({
      retroActionsCount: 0,
      retroActionsDone: 0,
    })
  })

  it('agendamento que não é Retro não tem combinados nem contagens', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, retro({ kind: 'meeting' }))
    await expect(
      useCases.meetings.retroActions.list.execute(manager, {
        meetingId: retroId,
        occurrenceDate: '2026-11-06',
      }),
    ).resolves.toEqual([])
    const range = await useCases.meetings.listRange.execute(manager, {
      rangeStart: '2026-11-01',
      rangeEnd: '2026-11-07',
    })
    expect(range[0]).toMatchObject({ retroActionsCount: 0, retroActionsDone: 0 })
  })

  it('data que não é ocorrência não lista combinados', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.meetings.retroActions.add.execute(manager, addInput())
    await expect(
      useCases.meetings.retroActions.list.execute(manager, {
        meetingId: retroId,
        occurrenceDate: '2026-11-07',
      }),
    ).resolves.toEqual([])
  })

  it('usuário de outra organização não vê o agendamento nem os combinados', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.meetings.retroActions.add.execute(manager, addInput())
    await expect(
      useCases.meetings.retroActions.list.execute(otherOrgManager, {
        meetingId: retroId,
        occurrenceDate: '2026-11-06',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('combinados da retro: edição, marcação e remoção', () => {
  it('gestor renomeia, troca responsável e prazo', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(manager, addInput())
    const updated = await useCases.meetings.retroActions.update.execute(manager, {
      actionId: created.id,
      changes: { title: 'Novo título', responsibleId: brunoId, dueDate: null },
    })
    expect(updated).toMatchObject({
      title: 'Novo título',
      responsibleId: brunoId,
      responsibleName: 'Bruno',
      dueDate: null,
    })
  })

  it('colaborador, mesmo responsável, não renomeia nem troca o combinado', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(manager, addInput())
    await expect(
      useCases.meetings.retroActions.update.execute(ana, {
        actionId: created.id,
        changes: { title: 'Mudei' },
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('responsável marca o próprio combinado; outro colaborador não marca', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(manager, addInput())
    const done = await useCases.meetings.retroActions.toggle.execute(ana, {
      actionId: created.id,
      done: true,
    })
    expect(done).toMatchObject({ done: true, doneAt: '2026-11-07T10:00:00.000Z' })
    await expect(
      useCases.meetings.retroActions.toggle.execute(bruno, { actionId: created.id, done: false }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    const reopened = await useCases.meetings.retroActions.toggle.execute(manager, {
      actionId: created.id,
      done: false,
    })
    expect(reopened).toMatchObject({ done: false, doneAt: null })
  })

  it('só o gestor remove combinados', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(manager, addInput())
    await expect(
      useCases.meetings.retroActions.remove.execute(ana, { actionId: created.id }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await useCases.meetings.retroActions.remove.execute(manager, { actionId: created.id })
    await expect(
      useCases.meetings.retroActions.list.execute(manager, {
        meetingId: retroId,
        occurrenceDate: '2026-11-06',
      }),
    ).resolves.toEqual([])
  })

  it('combinado de outra organização não é alcançado', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const created = await useCases.meetings.retroActions.add.execute(manager, addInput())
    await expect(
      useCases.meetings.retroActions.toggle.execute(otherOrgManager, {
        actionId: created.id,
        done: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('combinados da retro: cascata e séries que mudam', () => {
  it('excluir a Retro leva os combinados junto', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.meetings.retroActions.add.execute(manager, addInput())
    await useCases.meetings.delete.execute(manager, { meetingId: retroId })
    await expect(
      unitOfWork.repositories.retroActions.listByMeetings(organizationId, [retroId]),
    ).resolves.toEqual([])
  })

  it('combinados de datas que deixaram de ser ocorrências somem da listagem e das contagens', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.meetings.retroActions.add.execute(manager, addInput())
    const stale = await useCases.meetings.retroActions.add.execute(
      manager,
      addInput({ occurrenceDate: '2026-11-13', title: 'Fica na data antiga' }),
    )
    await useCases.meetings.update.execute(manager, {
      meetingId: retroId,
      changes: { date: '2026-11-20', recurrenceUntil: '2026-11-27' },
    })
    const range = await useCases.meetings.listRange.execute(manager, {
      rangeStart: '2026-11-01',
      rangeEnd: '2026-11-30',
    })
    expect(range.map((item) => item.occurrenceDate)).toEqual(['2026-11-20', '2026-11-27'])
    expect(range.every((item) => item.retroActionsCount === 0)).toBe(true)
    // O combinado antigo continua armazenado, mas não é acessível.
    await expect(
      useCases.meetings.retroActions.toggle.execute(manager, { actionId: stale.id, done: true }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      unitOfWork.repositories.retroActions.findById(organizationId, stale.id as RetroActionId),
    ).resolves.not.toBeNull()
  })
})
