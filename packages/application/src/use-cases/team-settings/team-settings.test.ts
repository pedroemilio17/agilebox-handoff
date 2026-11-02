import { describe, expect, it } from 'vitest'
import {
  createTenantContext,
  PermissionDeniedError,
  toOrganizationId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'

const organizationId = toOrganizationId('00000000000000000000000001')
const collaborator: Actor = {
  userId: toUserId('00000000000000000000000002'),
  organizationId,
  role: 'collaborator',
}
const manager: Actor = {
  userId: toUserId('00000000000000000000000003'),
  organizationId,
  role: 'manager',
}
const collaboratorCtx = createTenantContext(collaborator)
const managerCtx = createTenantContext(manager)
const now = '2026-01-20T12:00:00.000Z'

function setup(actor: Actor = manager, changedAt = now, unitOfWork = new InMemoryUnitOfWork()) {
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock(changedAt),
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
  return { unitOfWork, useCases }
}

describe('nível do time', () => {
  it('um time nunca configurado começa no nível sugerido (Padrão), para gestor e colaborador', async () => {
    const { useCases } = setup()

    await expect(
      useCases.teamSettings.getLevel.execute(collaboratorCtx, collaborator),
    ).resolves.toBe('intermediate')
    await expect(useCases.teamSettings.getLevel.execute(managerCtx, manager)).resolves.toBe(
      'intermediate',
    )
  })

  it('gestor grava o nível e o colaborador passa a ler o gravado', async () => {
    const { useCases } = setup()

    await expect(
      useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'advanced' }),
    ).resolves.toBe('advanced')

    await expect(
      useCases.teamSettings.getLevel.execute(collaboratorCtx, collaborator),
    ).resolves.toBe('advanced')
  })

  it('grava quem trocou e quando, no registro do time', async () => {
    const { useCases, unitOfWork } = setup()

    await useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'basic' })

    await expect(unitOfWork.repositories.teamSettings.find(organizationId)).resolves.toEqual({
      level: 'basic',
      changedBy: manager.userId,
      changedAt: now,
    })
  })

  it('colaborador não grava o nível e nada muda no time', async () => {
    const { useCases, unitOfWork } = setup(collaborator)

    await expect(
      useCases.teamSettings.setLevel.execute(collaboratorCtx, collaborator, { level: 'advanced' }),
    ).rejects.toThrow(PermissionDeniedError)

    await expect(unitOfWork.repositories.teamSettings.find(organizationId)).resolves.toBeNull()
  })

  it('nível desconhecido é recusado antes de gravar', async () => {
    const { useCases, unitOfWork } = setup()

    await expect(
      useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'expert' }),
    ).rejects.toThrow(ValidationError)

    await expect(unitOfWork.repositories.teamSettings.find(organizationId)).resolves.toBeNull()
  })

  it('entrada ausente vira erro de validação, não TypeError, e nada é gravado', async () => {
    const { useCases, unitOfWork } = setup()
    const missing = undefined as unknown as Parameters<
      typeof useCases.teamSettings.setLevel.execute
    >[2]

    await expect(
      useCases.teamSettings.setLevel.execute(managerCtx, manager, missing),
    ).rejects.toThrow(ValidationError)
    await expect(
      useCases.teamSettings.setLevel.execute(
        managerCtx,
        manager,
        null as unknown as typeof missing,
      ),
    ).rejects.toThrow(ValidationError)

    await expect(unitOfWork.repositories.teamSettings.find(organizationId)).resolves.toBeNull()
  })

  it('pedir o nível que já vale não regrava o registro (quem e quando ficam)', async () => {
    const first = setup(manager, now)
    await first.useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'advanced' })

    const later = setup(manager, '2026-02-01T09:00:00.000Z', first.unitOfWork)
    await later.useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'advanced' })

    await expect(
      first.unitOfWork.repositories.teamSettings.find(organizationId),
    ).resolves.toMatchObject({ level: 'advanced', changedAt: now })
  })

  it('contexto de outro time é recusado antes de ler ou gravar', async () => {
    const { useCases, unitOfWork } = setup()
    const otherCtx = createTenantContext({
      ...manager,
      organizationId: toOrganizationId('00000000000000000000000009'),
    })

    await expect(useCases.teamSettings.getLevel.execute(otherCtx, manager)).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      useCases.teamSettings.setLevel.execute(otherCtx, manager, { level: 'basic' }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(unitOfWork.repositories.teamSettings.find(organizationId)).resolves.toBeNull()
  })
})

describe('capacidades do time (nível + ferramentas + papel)', () => {
  it('sem nível gravado, colaborador vê Quadro e Agenda, nada além disso', async () => {
    const { useCases } = setup()

    const capabilities = await useCases.teamModules.capabilities.execute(
      collaboratorCtx,
      collaborator,
    )

    expect(capabilities).toMatchObject({
      level: 'intermediate',
      screens: ['projects', 'agenda'],
    })
    expect(capabilities.statuses).toHaveLength(15)
  })

  it('o nível gravado vale para as telas: gestor no Avançado vê Ferramentas, colaborador não', async () => {
    const { useCases } = setup()
    await useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'advanced' })

    const forManager = await useCases.teamModules.capabilities.execute(managerCtx, manager)
    const forCollaborator = await useCases.teamModules.capabilities.execute(
      collaboratorCtx,
      collaborator,
    )

    expect(forManager.level).toBe('advanced')
    expect(forManager.screens).toContain('tools')
    expect(forCollaborator.level).toBe('advanced')
    expect(forCollaborator.screens).not.toContain('tools')
  })

  it('no Essencial, a ferramenta segue ligada no time mas a tela não aparece; subir de nível devolve a tela', async () => {
    const { useCases } = setup()
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['backlog'] })
    await useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'basic' })

    const basic = await useCases.teamModules.capabilities.execute(managerCtx, manager)
    expect(basic.screens).not.toContain('backlog')
    expect(basic.statuses.find((status) => status.moduleId === 'backlog')?.state).toBe('active')

    await useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'intermediate' })
    const intermediate = await useCases.teamModules.capabilities.execute(managerCtx, manager)
    expect(intermediate.screens).toContain('backlog')
  })

  it('o registro de ferramentas continua sendo o mesmo ao trocar o nível', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['backlog'] })
    const before = await unitOfWork.repositories.teamModules.list(organizationId)

    await useCases.teamSettings.setLevel.execute(managerCtx, manager, { level: 'basic' })

    await expect(unitOfWork.repositories.teamModules.list(organizationId)).resolves.toEqual(before)
  })
})
