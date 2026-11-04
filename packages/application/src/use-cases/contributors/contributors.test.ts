import { describe, expect, it } from 'vitest'
import { toContributorId, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aContributor } from '../../testing/builders'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const userId = toUserId('00000000000000000000000002')
const actor: Actor = { userId, organizationId, role: 'collaborator' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  return {
    useCases: createUseCases({
      actorSession,
      changeNotifier: notifier,
      clock: new FixedClock('2026-01-02T00:00:00.000Z'),
      checklist: unitOfWork.repositories.checklist,
      comments: unitOfWork.repositories.comments,
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
    unitOfWork,
    notifier,
  }
}

describe('casos de uso de entidades', () => {
  it('cria entidade manual com tarifa não definida e notifica a organização', async () => {
    const { useCases, unitOfWork, notifier } = setup()

    const result = await useCases.contributors.create.execute(actor, { name: '  Cliente Novo  ' })
    expect(result).toMatchObject({ name: 'Cliente Novo', defaultRate: null })
    await expect(
      unitOfWork.repositories.contributors.findById(organizationId, toContributorId(result.id)),
    ).resolves.toMatchObject({
      source: 'manual',
      defaultRateCents: 0,
      createdBy: actor.userId,
      organizationId,
    })
    await expect(
      unitOfWork.repositories.contributors.findById(
        otherOrganizationId,
        toContributorId(result.id),
      ),
    ).resolves.toBeNull()
    expect(notifier.changes).toHaveLength(1)
    expect(notifier.changes[0]).toMatchObject({
      organizationId,
      change: { kind: 'contributor' },
    })
    expect(notifier.changes[0]?.change.ids).toHaveLength(1)
  })

  it('permite que qualquer papel crie entidade', async () => {
    const { useCases } = setup()

    await expect(
      useCases.contributors.create.execute({ ...actor, role: 'manager' }, { name: 'Fornecedor' }),
    ).resolves.toMatchObject({ name: 'Fornecedor' })
  })

  it('rejeita nome inválido sem salvar ou notificar', async () => {
    const { useCases, unitOfWork, notifier } = setup()

    await expect(useCases.contributors.create.execute(actor, { name: '  ' })).rejects.toMatchObject(
      {
        code: 'VALIDATION',
      },
    )
    await expect(unitOfWork.repositories.contributors.list(organizationId)).resolves.toEqual([])
    expect(notifier.changes).toEqual([])
  })

  it('lista entidades apenas da organização do ator', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.contributors.save(organizationId, aContributor().build())
    await unitOfWork.repositories.contributors.save(
      otherOrganizationId,
      aContributor()
        .with({ organizationId: otherOrganizationId, name: 'Outra organização' })
        .build(),
    )

    await expect(useCases.contributors.list.execute(actor)).resolves.toMatchObject([
      { name: 'Cliente', defaultRate: null },
    ])
  })

  it('mostra o valor padrão da entidade apenas para o gestor', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.contributors.save(organizationId, aContributor().build())

    await expect(
      useCases.contributors.list.execute({ ...actor, role: 'manager' }),
    ).resolves.toMatchObject([{ defaultRate: 20 }])
  })

  it('permite ao gestor alterar valor padrão e publica a mudança', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const contributor = aContributor().build()
    await unitOfWork.repositories.contributors.save(organizationId, contributor)

    await expect(
      useCases.contributors.setDefaultRate.execute(
        { ...actor, role: 'manager' },
        {
          contributorId: contributor.id,
          rateCents: 5500,
        },
      ),
    ).resolves.toMatchObject({ defaultRate: 55 })
    expect(notifier.changes).toEqual([
      { organizationId, change: { kind: 'contributor', ids: [contributor.id] } },
    ])
  })

  it('nega ao colaborador alterar o valor padrão de uma entidade', async () => {
    const { useCases, unitOfWork } = setup()
    const contributor = aContributor().build()
    await unitOfWork.repositories.contributors.save(organizationId, contributor)

    await expect(
      useCases.contributors.setDefaultRate.execute(actor, {
        contributorId: contributor.id,
        rateCents: 5500,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejeita tarifa inválida e entidade inexistente', async () => {
    const { useCases, unitOfWork } = setup()
    const contributor = aContributor().build()
    await unitOfWork.repositories.contributors.save(organizationId, contributor)

    await expect(
      useCases.contributors.setDefaultRate.execute(
        { ...actor, role: 'manager' },
        {
          contributorId: contributor.id,
          rateCents: 0,
        },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      useCases.contributors.setDefaultRate.execute(
        { ...actor, role: 'manager' },
        {
          contributorId: '00000000000000000000000006',
          rateCents: 5500,
        },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
