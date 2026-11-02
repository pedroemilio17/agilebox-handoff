import { describe, expect, it } from 'vitest'
import {
  createTenantContext,
  PermissionDeniedError,
  toOrganizationId,
  toParticipationId,
  toTaskId,
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
import { aMeeting, aParticipation, aProject, aTask } from '../../testing/builders'

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

    const statuses = await useCases.teamModules.get.execute(collaboratorCtx, collaborator)

    expect(statuses).toHaveLength(15)
    expect(stateOf(statuses, 'core')).toBe('active')
    expect(stateOf(statuses, 'agenda')).toBe('active')
    expect(stateOf(statuses, 'sprints')).toBe('disabled')
  })

  it('colaborador não altera ferramentas e nada é gravado', async () => {
    const { unitOfWork, useCases } = setup(collaborator)

    await expect(
      useCases.teamModules.change.execute(collaboratorCtx, collaborator, { enable: ['backlog'] }),
    ).rejects.toThrow(PermissionDeniedError)

    expect(await unitOfWork.repositories.teamModules.list(organizationId)).toEqual([])
    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual([])
  })

  it('gestor ativa um módulo e as dependências dele, e grava histórico com quem, quando e o quê', async () => {
    const { useCases, unitOfWork } = setup()

    const statuses = await useCases.teamModules.change.execute(managerCtx, manager, {
      enable: ['sprints'],
    })

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
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['sprints'] })
    const before = await unitOfWork.repositories.teamModules.list(organizationId)
    const eventsBefore = await unitOfWork.repositories.teamModuleEvents.list(organizationId)

    await expect(
      useCases.teamModules.change.execute(managerCtx, manager, { disable: ['backlog'] }),
    ).rejects.toThrow(ValidationError)

    expect(await unitOfWork.repositories.teamModules.list(organizationId)).toEqual(before)
    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual(
      eventsBefore,
    )
  })

  it('recusa conflito entre horas e pontos sem gravar', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['estimates.hours'] })

    await expect(
      useCases.teamModules.change.execute(managerCtx, manager, { enable: ['estimates.points'] }),
    ).rejects.toThrow(/conflita/)

    const events = await unitOfWork.repositories.teamModuleEvents.list(organizationId)
    expect(events).toHaveLength(1)
  })

  it('recusa módulo desconhecido e o desligamento do núcleo', async () => {
    const { useCases } = setup()

    await expect(
      useCases.teamModules.change.execute(managerCtx, manager, { enable: ['naoExiste'] }),
    ).rejects.toThrow(/Módulo desconhecido/)
    await expect(
      useCases.teamModules.change.execute(managerCtx, manager, { disable: ['core'] }),
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

    await useCases.teamModules.change.execute(managerCtx, manager, { disable: ['agenda'] })
    expect(stateOf(await useCases.teamModules.get.execute(managerCtx, manager), 'agenda')).toBe(
      'disabled',
    )
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['agenda'] })

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

    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['agenda'] })

    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual([])
  })
})

describe('prévia de impacto das ferramentas', () => {
  function impactOf(
    statuses: readonly { moduleId: string; counts: Record<string, number> }[],
    id: string,
  ) {
    return statuses.find((status) => status.moduleId === id)?.counts
  }

  it('colaborador não vê a prévia', async () => {
    const { useCases } = setup(collaborator)

    await expect(
      useCases.teamModules.previewImpact.execute(collaboratorCtx, collaborator, {
        disable: ['agenda'],
      }),
    ).rejects.toThrow(PermissionDeniedError)
  })

  it('sem módulos pedidos para desligar, a prévia devolve lista vazia', async () => {
    const { useCases } = setup()

    await expect(
      useCases.teamModules.previewImpact.execute(managerCtx, manager, {}),
    ).resolves.toEqual([])
  })

  it('organização sem itens dá zero em todas as contagens', async () => {
    const { useCases } = setup()

    const impacts = await useCases.teamModules.previewImpact.execute(managerCtx, manager, {
      disable: ['core', 'agenda', 'backlog'],
    })

    expect(impacts.map((impact) => impact.moduleId)).toEqual(['core', 'agenda', 'backlog'])
    for (const impact of impacts) {
      expect(Object.values(impact.counts)).toEqual([0, 0, 0, 0])
    }
  })

  it('conta tarefas, projetos, participações e reuniões que dependem de cada módulo', async () => {
    const { useCases, unitOfWork } = setup()
    const repositories = unitOfWork.repositories
    await repositories.projects.save(organizationId, aProject().with({ organizationId }).build())
    // Cada tarefa traz a própria participação de responsável (ids distintos).
    await repositories.tasks.save(
      organizationId,
      aTask()
        .with({
          id: toTaskId('00000000000000000000000010'),
          responsibleParticipationId: toParticipationId('00000000000000000000000020'),
          organizationId,
        })
        .build(),
    )
    await repositories.tasks.save(
      organizationId,
      aTask()
        .with({
          id: toTaskId('00000000000000000000000011'),
          responsibleParticipationId: toParticipationId('00000000000000000000000021'),
          organizationId,
        })
        .build(),
    )
    const task = aTask()
      .with({
        id: toTaskId('00000000000000000000000012'),
        responsibleParticipationId: toParticipationId('00000000000000000000000022'),
        organizationId,
      })
      .build()
    await repositories.tasks.save(organizationId, task)
    await repositories.participations.save(organizationId, aParticipation(task).build())
    await repositories.meetings.save(organizationId, aMeeting().with({ organizationId }).build())

    const impacts = await useCases.teamModules.previewImpact.execute(managerCtx, manager, {
      disable: ['core', 'agenda', 'backlog'],
    })

    // 3 tarefas, 3 responsáveis e 1 participação extra = 4 participações.
    expect(impactOf(impacts, 'core')).toEqual({
      tasks: 3,
      projects: 1,
      participations: 4,
      meetings: 0,
    })
    expect(impactOf(impacts, 'agenda')).toEqual({
      tasks: 0,
      projects: 0,
      participations: 0,
      meetings: 1,
    })
    expect(impactOf(impacts, 'backlog')).toEqual({
      tasks: 0,
      projects: 0,
      participations: 0,
      meetings: 0,
    })
  })

  it('desligar nunca apaga contagem: a prévia não muda dados nem estado do módulo', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting().with({ organizationId }).build(),
    )
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['agenda'] })

    const first = await useCases.teamModules.previewImpact.execute(managerCtx, manager, {
      disable: ['agenda'],
    })
    const second = await useCases.teamModules.previewImpact.execute(managerCtx, manager, {
      disable: ['agenda'],
    })

    expect(second).toEqual(first)
    expect(impactOf(first, 'agenda')?.meetings).toBe(1)
    expect(await unitOfWork.repositories.meetings.count(organizationId)).toBe(1)
    const statuses = await useCases.teamModules.get.execute(managerCtx, manager)
    expect(stateOf(statuses, 'agenda')).toBe('active')
  })

  it('recusa identificador de módulo desconhecido', async () => {
    const { useCases } = setup()

    await expect(
      useCases.teamModules.previewImpact.execute(managerCtx, manager, { disable: ['inexistente'] }),
    ).rejects.toThrow(ValidationError)
  })
})

describe('isolamento entre organizações (M1.10e)', () => {
  const otherOrganizationId = toOrganizationId('00000000000000000000000099')
  const outsider: Actor = {
    userId: toUserId('00000000000000000000000077'),
    organizationId: otherOrganizationId,
    role: 'manager',
  }
  const outsiderCtx = createTenantContext(outsider)

  it('ferramentas de outro time não aparecem na leitura', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['sprints'] })

    const statuses = await useCases.teamModules.get.execute(outsiderCtx, outsider)

    expect(stateOf(statuses, 'sprints')).toBe('disabled')
    expect(await unitOfWork.repositories.teamModules.list(otherOrganizationId)).toEqual([])
  })

  it('gestor de outro time não altera as ferramentas daqui, e a mudança vai para o time dele', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.teamModules.change.execute(managerCtx, manager, { enable: ['sprints'] })
    const beforeEvents = await unitOfWork.repositories.teamModuleEvents.list(organizationId)

    const statuses = await useCases.teamModules.change.execute(outsiderCtx, outsider, {
      enable: ['backlog'],
    })

    expect(stateOf(statuses, 'backlog')).toBe('active')
    expect(stateOf(statuses, 'sprints')).toBe('disabled')
    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual(
      beforeEvents,
    )
    const otherStored = await unitOfWork.repositories.teamModules.list(otherOrganizationId)
    expect(otherStored.map((item) => item.moduleId)).toEqual(['backlog'])
    const stored = await unitOfWork.repositories.teamModules.list(organizationId)
    expect(stored.map((item) => item.moduleId).sort()).toEqual(['backlog', 'sprints'])
  })

  it('prévia de outro time não conta itens daqui', async () => {
    const { useCases, unitOfWork } = setup()
    await unitOfWork.repositories.meetings.save(
      organizationId,
      aMeeting().with({ organizationId }).build(),
    )
    await unitOfWork.repositories.projects.save(
      organizationId,
      aProject().with({ organizationId }).build(),
    )

    const impacts = await useCases.teamModules.previewImpact.execute(outsiderCtx, outsider, {
      disable: ['core', 'agenda'],
    })

    expect(impacts.map((impact) => impact.counts)).toEqual([
      { tasks: 0, projects: 0, participations: 0, meetings: 0 },
      { tasks: 0, projects: 0, participations: 0, meetings: 0 },
    ])
  })

  it('contexto de um time com ator de outro dá FORBIDDEN e não grava nada', async () => {
    const { useCases, unitOfWork } = setup()

    await expect(useCases.teamModules.get.execute(managerCtx, outsider)).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      useCases.teamModules.change.execute(managerCtx, outsider, { enable: ['sprints'] }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.teamModules.previewImpact.execute(managerCtx, outsider, { disable: ['agenda'] }),
    ).rejects.toThrow(PermissionDeniedError)

    expect(await unitOfWork.repositories.teamModules.list(organizationId)).toEqual([])
    expect(await unitOfWork.repositories.teamModules.list(otherOrganizationId)).toEqual([])
    expect(await unitOfWork.repositories.teamModuleEvents.list(organizationId)).toEqual([])
    expect(await unitOfWork.repositories.teamModuleEvents.list(otherOrganizationId)).toEqual([])
  })
})
