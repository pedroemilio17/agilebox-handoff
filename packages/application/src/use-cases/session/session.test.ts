import { describe, expect, it } from 'vitest'
import { toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aUser } from '../../testing/builders'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const actor: Actor = { userId, organizationId, role: 'collaborator' }

function setup(initialActor: Actor = actor) {
  const unitOfWork = new InMemoryUnitOfWork()
  const users = [aUser().build(), aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()]
  for (const user of users) void unitOfWork.repositories.users.save(organizationId, user)
  let currentActor = initialActor
  const actorSession: ActorSession = {
    get: () => currentActor,
    set: (next) => {
      currentActor = next
    },
  }
  const deps = {
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
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
  }
  return { useCases: createUseCases(deps), deps, users }
}

describe('casos de uso de sessão', () => {
  it('retorna e troca o ator por usuário da mesma organização', async () => {
    const { useCases, deps } = setup()
    expect(useCases.session.getCurrentActor.execute()).toEqual(actor)
    await expect(
      useCases.session.switchUser.execute({ userId: otherUserId }),
    ).resolves.toMatchObject({
      userId: otherUserId,
      organizationId,
    })
    expect(useCases.session.getCurrentActor.execute()).toMatchObject({ userId: otherUserId })
    expect(deps.changeNotifier.changes).toEqual([
      { organizationId, change: { kind: 'session', ids: [otherUserId] } },
    ])
  })

  it('nega troca para usuário inexistente', async () => {
    const { useCases } = setup()
    await expect(
      useCases.session.switchUser.execute({ userId: toUserId('00000000000000000000000009') }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lista usuários com tarifa filtrada pela política do ator', async () => {
    const { useCases } = setup()
    await expect(useCases.session.listUsers.execute(actor)).resolves.toEqual([
      expect.objectContaining({ id: userId, defaultRate: 45 }),
      expect.objectContaining({ id: otherUserId, defaultRate: null }),
    ])
  })
})
