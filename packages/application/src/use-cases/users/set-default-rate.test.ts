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

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const users = [aUser().build(), aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()]
  for (const user of users) void unitOfWork.repositories.users.save(organizationId, user)
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  return {
    useCases: createUseCases({
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
    }),
    notifier,
  }
}

describe('definir valor padrão do usuário', () => {
  it('permite ao usuário alterar o próprio valor e publica a mudança', async () => {
    const { useCases, notifier } = setup()
    await expect(
      useCases.users.setDefaultRate.execute(actor, { userId, rateCents: 5500 }),
    ).resolves.toMatchObject({ defaultRate: 55 })
    expect(notifier.changes).toHaveLength(1)
    expect(notifier.changes[0]?.change).toEqual({ kind: 'user', ids: [userId] })
  })

  it('nega que colaborador altere o valor de outra pessoa', async () => {
    const { useCases } = setup()
    await expect(
      useCases.users.setDefaultRate.execute(actor, { userId: otherUserId, rateCents: 5500 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('gestor altera o valor de qualquer usuário da organização', async () => {
    const { useCases } = setup()
    await expect(
      useCases.users.setDefaultRate.execute(
        { ...actor, role: 'manager' },
        { userId: otherUserId, rateCents: 5500 },
      ),
    ).resolves.toMatchObject({ defaultRate: 55 })
  })

  it('rejeita tarifa padrão inválida', async () => {
    const { useCases } = setup()
    await expect(
      useCases.users.setDefaultRate.execute(actor, { userId, rateCents: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
