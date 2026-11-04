import { createUser, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { describe, expect, it } from 'vitest'
import { aUser } from './testing/builders'
import { FixedClock } from './testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from './testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from './testing/fakes/recording-notifier'
import { SequentialIdGenerator } from './testing/fakes/sequential-id-generator'
import type { ActorSession } from './ports'
import { createUseCases } from './create-use-cases'

const organizationId = toOrganizationId('00000000000000000000000001')
const collaboratorId = toUserId('00000000000000000000000002')
const supportId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const collaborator: Actor = { userId: collaboratorId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

describe('composição dos casos de uso', () => {
  it('executa o roteiro do projeto à linha do tempo com fakes', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const notifier = new RecordingNotifier()
    for (const user of [
      aUser().build(),
      aUser().with({ id: supportId, name: 'Bia Lima' }).build(),
      createUser({ ...aUser().build(), id: managerId, name: 'Gestor', role: 'manager' }),
    ])
      await unitOfWork.repositories.users.save(organizationId, user)

    const actorSession: ActorSession = { get: () => collaborator, set: () => undefined }
    const useCases = createUseCases({
      actorSession,
      changeNotifier: notifier,
      clock: new FixedClock('2026-01-02T12:00:00.000Z'),
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

    const project = await useCases.projects.createProject.execute(collaborator, {
      name: 'Projeto do roteiro',
    })
    const task = await useCases.tasks.create.execute(collaborator, {
      projectId: project.id,
      title: 'Preparar entrega',
    })
    await useCases.tasks.move.execute(collaborator, { taskId: task.id, status: 'in_progress' })
    const participation = await useCases.participations.add.execute(collaborator, {
      taskId: task.id,
      participant: { kind: 'user', userId: supportId },
      role: 'support',
    })
    await useCases.participations.setHours.execute(collaborator, {
      taskId: task.id,
      participationId: participation.id,
      hours: '2,50',
    })
    await useCases.tasks.update.execute(manager, {
      taskId: task.id,
      changes: { title: 'Entrega revisada' },
    })

    const timeline = await useCases.timeline.list.execute(collaborator, { taskId: task.id })
    expect(timeline.map((event) => event.type)).toEqual([
      'renamed',
      'hours_changed',
      'participant_added',
      'status_changed',
      'task_created',
    ])
    const managerEdit = timeline[0]
    const collaboratorEdit = timeline[1]
    expect(managerEdit?.actorUserId).toBe(managerId)
    expect(managerEdit?.asManager).toBe(true)
    expect(managerEdit?.text).toContain('renomeou')
    expect(collaboratorEdit?.asManager).toBe(false)
    expect(notifier.changes.length).toBeGreaterThan(0)
  })
})
