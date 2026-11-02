import { describe, expect, it } from 'vitest'
import { PermissionDeniedError, toOrganizationId, toUserId, ValidationError } from '@agilebox/core'
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
const now = '2026-01-20T12:00:00.000Z'

function buildUseCases(unitOfWork: InMemoryUnitOfWork, actor: Actor) {
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  return createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock(now),
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
}

function setup(actor: Actor = manager) {
  const unitOfWork = new InMemoryUnitOfWork()
  return { unitOfWork, useCases: buildUseCases(unitOfWork, actor) }
}

function stateOf(
  statuses: readonly { moduleId: string; state: string }[],
  moduleId: string,
): string | undefined {
  return statuses.find((status) => status.moduleId === moduleId)?.state
}

describe('ferramentas do time', () => {
  it('um time nunca configurado tem núcleo e agenda ativos, e o resto desativado', async () => {
    const { useCases } = setup(collaborator)

    const statuses = await useCases.teamModules.get.execute(collaborator)

    expect(statuses).toHaveLength(15)
    expect(stateOf(statuses, 'core')).toBe('active')
    expect(stateOf(statuses, 'agenda')).toBe('active')
    expect(stateOf(statuses, 'sprints')).toBe('disabled')
  })

  it('colaborador não altera ferramentas e nada é gravado', async () => {
    const { unitOfWork, useCases } = setup(collaborator)

    await expect(
      useCases.teamModules.change.execute(collaborator, { enable: ['backlog'] }),
    ).rejects.toThrow(PermissionDeniedError)

    expect(await unitOfWork.repositories.teamModules.list(organizationId)).toEqual([])
    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual([])
  })

  it('gestor ativa um módulo e as dependências dele, e grava histórico com quem, quando e o quê', async () => {
    const { useCases, unitOfWork } = setup()

    const statuses = await useCases.teamModules.change.execute(manager, { enable: ['sprints'] })

    expect(stateOf(statuses, 'backlog')).toBe('active')
    expect(stateOf(statuses, 'sprints')).toBe('active')
    const events = await unitOfWork.repositories.teamModuleEvents.list(organizationId)
    expect(events.map((event) => [event.moduleId, event.fromState, event.toState])).toEqual([
      ['backlog', 'disabled', 'active'],
      ['sprints', 'disabled', 'active'],
    ])
    expect(
      events.every((event) => event.changedBy === manager.userId && event.changedAt === now),
    ).toBe(true)
  })

  it('recusa desativar backlog enquanto sprints depende dele, sem gravar nada', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.teamModules.change.execute(manager, { enable: ['sprints'] })
    const before = await unitOfWork.repositories.teamModules.list(organizationId)
    const eventsBefore = await unitOfWork.repositories.teamModuleEvents.list(organizationId)

    await expect(
      useCases.teamModules.change.execute(manager, { disable: ['backlog'] }),
    ).rejects.toThrow(ValidationError)

    expect(await unitOfWork.repositories.teamModules.list(organizationId)).toEqual(before)
    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual(
      eventsBefore,
    )
  })

  it('recusa conflito entre horas e pontos sem gravar', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.teamModules.change.execute(manager, { enable: ['estimates.hours'] })

    await expect(
      useCases.teamModules.change.execute(manager, { enable: ['estimates.points'] }),
    ).rejects.toThrow(/conflita/)

    const events = await unitOfWork.repositories.teamModuleEvents.list(organizationId)
    expect(events).toHaveLength(1)
  })

  it('recusa módulo desconhecido e o desligamento do núcleo', async () => {
    const { useCases } = setup()

    await expect(
      useCases.teamModules.change.execute(manager, { enable: ['naoExiste'] }),
    ).rejects.toThrow(/Módulo desconhecido/)
    await expect(
      useCases.teamModules.change.execute(manager, { disable: ['core'] }),
    ).rejects.toThrow(/núcleo/)
  })

  it('desativar guarda a configuração e reativar devolve o módulo como estava', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.teamModules.save(organizationId, {
      moduleId: 'agenda',
      state: 'active',
      config: { showWeekends: true },
      changedBy: manager.userId,
      changedAt: now,
    })

    await useCases.teamModules.change.execute(manager, { disable: ['agenda'] })
    expect(stateOf(await useCases.teamModules.get.execute(manager), 'agenda')).toBe('disabled')
    await useCases.teamModules.change.execute(manager, { enable: ['agenda'] })

    const stored = await unitOfWork.repositories.teamModules.list(organizationId)
    expect(stored.find((item) => item.moduleId === 'agenda')).toMatchObject({
      state: 'active',
      config: { showWeekends: true },
    })
    const events = await unitOfWork.repositories.teamModuleEvents.list(organizationId)
    expect(events.map((event) => [event.fromState, event.toState])).toEqual([
      ['active', 'disabled'],
      ['disabled', 'active'],
    ])
  })

  it('não grava evento quando a mudança não altera nada', async () => {
    const { useCases, unitOfWork } = setup()

    await useCases.teamModules.change.execute(manager, { enable: ['agenda'] })

    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual([])
  })
})
