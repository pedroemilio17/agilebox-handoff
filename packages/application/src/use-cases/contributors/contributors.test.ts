import { describe, expect, it } from 'vitest'
import { createTenantContext, toContributorId, toOrganizationId, toUserId } from '@agilebox/core'
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
    }),
    unitOfWork,
    notifier,
  }
}

describe('casos de uso de entidades', () => {
  it('cria entidade manual com tarifa não definida e notifica a organização', async () => {
    const { useCases, unitOfWork, notifier } = setup()

    const result = await useCases.contributors.create.execute(createTenantContext(actor), actor, {
      name: '  Cliente Novo  ',
    })
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
    const manager: Actor = { ...actor, role: 'manager' }

    await expect(
      useCases.contributors.create.execute(createTenantContext(manager), manager, {
        name: 'Fornecedor',
      }),
    ).resolves.toMatchObject({ name: 'Fornecedor' })
  })

  it('rejeita nome inválido sem salvar ou notificar', async () => {
    const { useCases, unitOfWork, notifier } = setup()

    await expect(
      useCases.contributors.create.execute(createTenantContext(actor), actor, { name: '  ' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    })
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

    await expect(
      useCases.contributors.list.execute(createTenantContext(actor), actor),
    ).resolves.toMatchObject([{ name: 'Cliente', defaultRate: null }])
  })

  it('mostra o valor padrão da entidade apenas para o gestor', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.contributors.save(organizationId, aContributor().build())
    const manager: Actor = { ...actor, role: 'manager' }

    await expect(
      useCases.contributors.list.execute(createTenantContext(manager), manager),
    ).resolves.toMatchObject([{ defaultRate: 20 }])
  })

  it('permite ao gestor alterar valor padrão e publica a mudança', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const contributor = aContributor().build()
    await unitOfWork.repositories.contributors.save(organizationId, contributor)
    const manager: Actor = { ...actor, role: 'manager' }

    await expect(
      useCases.contributors.setDefaultRate.execute(createTenantContext(manager), manager, {
        contributorId: contributor.id,
        rateCents: 5500,
      }),
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
      useCases.contributors.setDefaultRate.execute(createTenantContext(actor), actor, {
        contributorId: contributor.id,
        rateCents: 5500,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejeita tarifa inválida e entidade inexistente', async () => {
    const { useCases, unitOfWork } = setup()
    const contributor = aContributor().build()
    await unitOfWork.repositories.contributors.save(organizationId, contributor)
    const manager: Actor = { ...actor, role: 'manager' }

    await expect(
      useCases.contributors.setDefaultRate.execute(createTenantContext(manager), manager, {
        contributorId: contributor.id,
        rateCents: 0,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      useCases.contributors.setDefaultRate.execute(createTenantContext(manager), manager, {
        contributorId: '00000000000000000000000006',
        rateCents: 5500,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('isolamento entre organizações (M1.10c)', () => {
  const outsiderId = toUserId('00000000000000000000000077')
  const outsider: Actor = {
    userId: outsiderId,
    organizationId: otherOrganizationId,
    role: 'manager',
  }

  async function setupWithOutsiderContributor() {
    const { useCases, unitOfWork, notifier } = setup()
    const contributor = aContributor()
      .with({ organizationId: otherOrganizationId, name: 'Entidade alheia' })
      .build()
    await unitOfWork.repositories.contributors.save(otherOrganizationId, contributor)
    return { useCases, unitOfWork, notifier, contributorId: contributor.id }
  }

  it('lista de outro time não devolve entidades de nenhum outro time, nem para gestor', async () => {
    const { useCases } = await setupWithOutsiderContributor()

    await expect(
      useCases.contributors.list.execute(createTenantContext(actor), actor),
    ).resolves.toEqual([])
    await expect(
      useCases.contributors.list.execute(createTenantContext(outsider), outsider),
    ).resolves.toMatchObject([{ name: 'Entidade alheia' }])
  })

  it('entidade de outro time não é alterada (NOT_FOUND no valor padrão, valor intacto)', async () => {
    const { useCases, unitOfWork, notifier, contributorId } = await setupWithOutsiderContributor()
    const manager: Actor = { ...actor, role: 'manager' }

    await expect(
      useCases.contributors.setDefaultRate.execute(createTenantContext(manager), manager, {
        contributorId,
        rateCents: 9900,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      unitOfWork.repositories.contributors.findById(otherOrganizationId, contributorId),
    ).resolves.toMatchObject({ defaultRateCents: 2000 })
    expect(notifier.changes).toEqual([])
  })

  it('criar entidade com ator de outro time grava no time do ator, não no do contexto de outro', async () => {
    const { useCases, unitOfWork } = setup()

    await useCases.contributors.create.execute(createTenantContext(outsider), outsider, {
      name: 'Fornecedor alheio',
    })
    await expect(unitOfWork.repositories.contributors.list(organizationId)).resolves.toEqual([])
    await expect(
      unitOfWork.repositories.contributors.list(otherOrganizationId),
    ).resolves.toMatchObject([{ name: 'Fornecedor alheio' }])
  })

  it('contexto de um time com ator de outro dá FORBIDDEN e não grava nada', async () => {
    const { useCases, unitOfWork, notifier, contributorId } = await setupWithOutsiderContributor()
    const manager: Actor = { ...actor, role: 'manager' }

    await expect(
      useCases.contributors.create.execute(createTenantContext(actor), outsider, { name: 'X' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.contributors.list.execute(createTenantContext(actor), outsider),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.contributors.setDefaultRate.execute(createTenantContext(manager), outsider, {
        contributorId,
        rateCents: 9900,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(unitOfWork.repositories.contributors.list(organizationId)).resolves.toEqual([])
    expect(notifier.changes).toEqual([])
  })
})
