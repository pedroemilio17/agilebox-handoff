import { describe, expect, it } from 'vitest'
import { toOrganizationId, toParticipationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aContributor, aParticipation, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const actor: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
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

describe('casos de uso de envolvimentos', () => {
  it('adiciona usuário copiando o valor padrão e registra evento na mesma transação', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const task = aTask().build()
    const user = aUser().with({ id: otherUserId, defaultRateCents: 6200 }).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(organizationId, user)

    const added = await useCases.participations.add.execute(actor, {
      taskId: task.id,
      participant: { kind: 'user', userId: otherUserId },
      role: 'support',
    })

    expect(added).toMatchObject({ participant: { kind: 'user', userId: otherUserId }, rate: null })
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.participations[1]
        ?.rateCents,
    ).toBe(6200)
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([{ type: 'participant_added', asManager: false }])
    expect(notifier.changes).toEqual([{ organizationId, change: { kind: 'task', ids: [task.id] } }])
  })

  it('adiciona entidade com seu valor padrão e marca edições do gestor', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const contributor = aContributor().with({ defaultRateCents: 8750 }).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.contributors.save(organizationId, contributor)

    const added = await useCases.participations.add.execute(manager, {
      taskId: task.id,
      participant: { kind: 'contributor', contributorId: contributor.id },
      role: 'support',
    })

    expect(added.rate).toBe(87.5)
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([{ type: 'participant_added', asManager: true }])
  })

  it('nega envolvimento em tarefa de outra pessoa e participante inexistente', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask()
      .ownedBy(aUser().with({ id: otherUserId, name: 'Bia Lima' }).build())
      .build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.participations.add.execute(actor, {
        taskId: task.id,
        participant: { kind: 'user', userId: otherUserId },
        role: 'support',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.participations.add.execute(manager, {
        taskId: task.id,
        participant: { kind: 'user', userId },
        role: 'support',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('remove envolvimento e impede remover responsável', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const support = aParticipation(task)
      .with({
        id: toParticipationId('00000000000000000000000009'),
        participant: { kind: 'user', userId: otherUserId },
      })
      .build()
    const taskWithSupport = { ...task, participations: [...task.participations, support] }
    await unitOfWork.repositories.tasks.save(organizationId, taskWithSupport)

    await useCases.participations.remove.execute(actor, {
      taskId: task.id,
      participationId: support.id,
    })
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.participations,
    ).toHaveLength(1)
    await expect(
      useCases.participations.remove.execute(actor, {
        taskId: task.id,
        participationId: task.participations[0]!.id,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([{ type: 'participant_removed', asManager: false }])
  })

  it('ajusta horas usando vírgula e registra o evento', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const support = aParticipation(task)
      .with({ participant: { kind: 'user', userId: otherUserId } })
      .build()
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...task,
      participations: [...task.participations, support],
    })

    const changed = await useCases.participations.setHours.execute(actor, {
      taskId: task.id,
      participationId: support.id,
      hours: '2,5',
    })

    expect(changed.hours).toBe(2.5)
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      { type: 'hours_changed', payload: { before: 100, after: 250 }, asManager: false },
    ])
  })

  it('altera tarifa própria e valor padrão; colaborador não altera a tarifa alheia', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const self = task.participations[0]
    if (!self) throw new Error('Tarefa sem responsável')
    const other = aParticipation(task)
      .with({
        id: toParticipationId('00000000000000000000000011'),
        participant: { kind: 'user', userId: otherUserId },
      })
      .build()
    const user = aUser().with({ defaultRateCents: 4500 }).build()
    const otherUser = aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(organizationId, user)
    await unitOfWork.repositories.users.save(organizationId, otherUser)
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...task,
      participations: [...task.participations, other],
    })

    await useCases.participations.setRate.execute(actor, {
      taskId: task.id,
      participationId: self.id,
      rateCents: 5100,
    })
    expect(
      (await unitOfWork.repositories.users.findById(organizationId, userId))?.defaultRateCents,
    ).toBe(5100)
    await expect(
      useCases.participations.setRate.execute(actor, {
        taskId: task.id,
        participationId: other.id,
        rateCents: 5100,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      { type: 'rate_changed', payload: { before: 4500, after: 5100 }, asManager: false },
    ])
  })

  it('gestor altera tarifa de entidade e seu valor padrão com evento marcado', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const contributor = aContributor().with({ defaultRateCents: 2000 }).build()
    const participation = aParticipation(task)
      .with({
        participant: { kind: 'contributor', contributorId: contributor.id },
        rateCents: 2000,
      })
      .build()
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...task,
      participations: [...task.participations, participation],
    })
    await unitOfWork.repositories.contributors.save(organizationId, contributor)

    await useCases.participations.setRate.execute(manager, {
      taskId: task.id,
      participationId: participation.id,
      rateCents: 3000,
    })

    expect(
      (await unitOfWork.repositories.contributors.findById(organizationId, contributor.id))
        ?.defaultRateCents,
    ).toBe(3000)
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([{ type: 'rate_changed', asManager: true }])
  })

  it('desfaz tarifa e tarefa se a gravação da linha do tempo falhar', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    const user = aUser().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(organizationId, user)
    unitOfWork.repositories.timeline.saveMany = () =>
      Promise.reject(new Error('falha ao gravar evento'))

    await expect(
      useCases.participations.setRate.execute(actor, {
        taskId: task.id,
        participationId: task.participations[0]!.id,
        rateCents: 5100,
      }),
    ).rejects.toThrow('falha ao gravar evento')
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.participations[0]
        ?.rateCents,
    ).toBe(4500)
    expect(
      (await unitOfWork.repositories.users.findById(organizationId, userId))?.defaultRateCents,
    ).toBe(4500)
  })
})
