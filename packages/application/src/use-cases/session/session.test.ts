import { describe, expect, it } from 'vitest'
import {
  createTenantContext,
  createUser,
  PermissionDeniedError,
  toOrganizationId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aUser } from '../../testing/builders'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
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
  }
  return { useCases: createUseCases(deps), deps, users }
}

describe('casos de uso de sessão', () => {
  it('retorna e troca o ator por usuário da mesma organização', async () => {
    const { useCases, deps } = setup()
    expect(useCases.session.getCurrentActor.execute(createTenantContext(actor))).toEqual(actor)
    await expect(
      useCases.session.switchUser.execute(createTenantContext(actor), { userId: otherUserId }),
    ).resolves.toMatchObject({
      userId: otherUserId,
      organizationId,
    })
    expect(useCases.session.getCurrentActor.execute(createTenantContext(actor))).toMatchObject({
      userId: otherUserId,
    })
    expect(deps.changeNotifier.changes).toEqual([
      { organizationId, change: { kind: 'session', ids: [otherUserId] } },
    ])
  })

  it('nega troca para usuário inexistente', async () => {
    const { useCases } = setup()
    await expect(
      useCases.session.switchUser.execute(createTenantContext(actor), {
        userId: toUserId('00000000000000000000000009'),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lista usuários com tarifa filtrada pela política do ator', async () => {
    const { useCases } = setup()
    await expect(
      useCases.session.listUsers.execute(createTenantContext(actor), actor),
    ).resolves.toEqual([
      expect.objectContaining({ id: userId, defaultRate: 45 }),
      expect.objectContaining({ id: otherUserId, defaultRate: null }),
    ])
  })
})

describe('isolamento entre organizações (M1.10c)', () => {
  const outsiderId = toUserId('00000000000000000000000077')
  const outsider: Actor = {
    userId: outsiderId,
    organizationId: otherOrganizationId,
    role: 'manager',
  }

  async function setupWithOutsider() {
    const { useCases, deps } = setup()
    await deps.users.save(
      otherOrganizationId,
      createUser({
        ...aUser().build(),
        id: outsiderId,
        organizationId: otherOrganizationId,
        name: 'Usuário de outro time',
        role: 'manager',
      }),
    )
    return { useCases, deps }
  }

  it('lista de outro time não devolve usuários de nenhum outro time', async () => {
    const { useCases } = await setupWithOutsider()

    await expect(
      useCases.session.listUsers.execute(createTenantContext(outsider), outsider),
    ).resolves.toEqual([expect.objectContaining({ id: outsiderId })])
  })

  it('não troca para usuário de outro time, mesmo que o id exista', async () => {
    const { useCases, deps } = await setupWithOutsider()

    await expect(
      useCases.session.switchUser.execute(createTenantContext(actor), { userId: outsiderId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(useCases.session.getCurrentActor.execute(createTenantContext(actor))).toEqual(actor)
    expect(deps.changeNotifier.changes).toEqual([])
  })

  it('contexto de um time com ator de outro dá FORBIDDEN em todos os casos de sessão', async () => {
    const { useCases, deps } = await setupWithOutsider()

    expect(useCases.session.getCurrentActor.execute(createTenantContext(actor))).toEqual(actor)
    expect(() => useCases.session.getCurrentActor.execute(createTenantContext(outsider))).toThrow(
      PermissionDeniedError,
    )
    await expect(
      useCases.session.switchUser.execute(createTenantContext(outsider), { userId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.session.listUsers.execute(createTenantContext(actor), outsider),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(deps.changeNotifier.changes).toEqual([])
  })
})
