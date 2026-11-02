import { describe, expect, it, vi } from 'vitest'
import {
  addParticipant,
  createTenantContext,
  NotFoundError,
  PermissionDeniedError,
  setArchivedAt,
  setEstimatedHours,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, ModuleState, OrganizationId, Task, TaskId } from '@agilebox/core'
import { aParticipation, aProject, aTask } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { UnitOfWorkRepositories } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const projectId = toProjectId('00000000000000000000000010')
const taskId = toTaskId('00000000000000000000000020')
const otherOrgTaskId = toTaskId('00000000000000000000000021')
const now = '2026-01-20T12:00:00.000Z'
const timestamp = '2026-01-01T00:00:00.000Z'

const managerId = toUserId('00000000000000000000000003')
/** Criou a tarefa e é o Responsável: tarifa 45 R$/h (padrão do builder). */
const creatorId = toUserId('00000000000000000000000002')
/** Apoio na tarefa: tarifa 72 R$/h. */
const supportId = toUserId('00000000000000000000000004')
/** Membro do projeto sem envolvimento na tarefa. */
const memberId = toUserId('00000000000000000000000005')
const otherManagerId = toUserId('00000000000000000000000008')

const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const creator: Actor = { userId: creatorId, organizationId, role: 'collaborator' }
const support: Actor = { userId: supportId, organizationId, role: 'collaborator' }
const member: Actor = { userId: memberId, organizationId, role: 'collaborator' }
const otherManager: Actor = {
  userId: otherManagerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

const call = (actor: Actor) => [createTenantContext(actor), actor] as const

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const useCases = createUseCases({
    actorSession: { get: () => creator, set: () => undefined },
    changeNotifier: notifier,
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
  return { useCases, unitOfWork, notifier, repos: unitOfWork.repositories }
}

async function setEstimateModule(
  repos: UnitOfWorkRepositories,
  org: OrganizationId,
  state: ModuleState,
): Promise<void> {
  await repos.teamModules.save(org, {
    moduleId: 'estimates.hours',
    state,
    config: {},
    changedBy: managerId,
    changedAt: timestamp,
  })
}

/**
 * Tarefa do time: criada por `creatorId` (Responsável, 0 h realizadas) e com apoio `supportId`
 * (3 h realizadas). Um membro do projeto que não participa. Com dois envolvidos, a estimativa
 * de 10 h se divide em 5 h por pessoa (ADR 0005, Q2).
 */
async function seedTask(
  repos: UnitOfWorkRepositories,
  options: { archived?: boolean; id?: TaskId; org?: OrganizationId } = {},
): Promise<Task> {
  const org = options.org ?? organizationId
  await repos.projects.save(org, aProject().with({ id: projectId, organizationId: org }).build())
  await repos.projects.addMember(org, {
    projectId,
    userId: memberId,
    addedBy: managerId,
    addedAt: timestamp,
  })
  let task = aTask()
    .with({
      id: options.id ?? taskId,
      organizationId: org,
      projectId,
      projectName: 'Projeto AgileBox',
      createdBy: creatorId,
      responsibleParticipationId: toParticipationId('00000000000000000000000030'),
    })
    .build()
  task = addParticipant(
    task,
    aParticipation(task)
      .with({
        id: toParticipationId('00000000000000000000000031'),
        participant: { kind: 'user', userId: supportId },
        role: 'support',
        hoursHundredths: 300,
        rateCents: 7200,
      })
      .build(),
  )
  if (options.archived) task = setArchivedAt(task, timestamp)
  await repos.tasks.save(org, task)
  return task
}

describe('estimativa em horas: definir e limpar', () => {
  it('participante define a estimativa; o DTO mostra em horas e a tarefa guarda centésimos', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    const dto = await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1250,
    })

    expect(dto.estimatedHours).toBe(12.5)
    expect((await repos.tasks.findById(organizationId, taskId))?.estimatedHours).toBe(1250)
  })

  it('a estimativa não mexe nas horas realizadas de ninguém', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    const stored = await repos.tasks.findById(organizationId, taskId)
    const hours = stored?.participations.map((item) => item.hoursHundredths)
    expect(hours).toEqual([0, 300])
  })

  it('null limpa a estimativa e o DTO volta a nulo', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    const cleared = await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: null,
    })

    expect(cleared.estimatedHours).toBeNull()
    expect(cleared.estimatedCost).toBeNull()
    expect((await repos.tasks.findById(organizationId, taskId))?.estimatedHours).toBeNull()
  })

  it('zero é uma estimativa válida, diferente de nulo', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    const dto = await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 0,
    })

    expect(dto.estimatedHours).toBe(0)
  })

  it('valores inválidos são recusados pelo core e a tarefa não muda', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos, {})
    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 500,
    })

    for (const value of [-1, 1.5, 100_001, Number.NaN, '12' as unknown as number]) {
      await expect(
        useCases.estimates.set.execute(...call(creator), {
          taskId,
          estimatedHoursHundredths: value,
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    }
    expect((await repos.tasks.findById(organizationId, taskId))?.estimatedHours).toBe(500)
  })

  it('o teto de 1000 h é aceito no limite exato', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    const dto = await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 100_000,
    })

    expect(dto.estimatedHours).toBe(1000)
  })

  it('gestor define a estimativa de tarefa de colaborador', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    const dto = await useCases.estimates.set.execute(...call(manager), {
      taskId,
      estimatedHoursHundredths: 800,
    })

    expect(dto.estimatedHours).toBe(8)
  })

  it('colaborador que não participa é recusado e nada muda', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    await expect(
      useCases.estimates.set.execute(...call(member), { taskId, estimatedHoursHundredths: 800 }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    expect((await repos.tasks.findById(organizationId, taskId))?.estimatedHours).toBeNull()
  })

  it('módulo desligado recusa citando o nome Estimativa por horas', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'disabled')
    await seedTask(repos)

    await expect(
      useCases.estimates.set.execute(...call(creator), { taskId, estimatedHoursHundredths: 800 }),
    ).rejects.toThrow(/Estimativa por horas/)
  })

  it('módulo encerrando aceita a edição do que já existe', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'winding_down')
    await seedTask(repos)

    const dto = await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 800,
    })

    expect(dto.estimatedHours).toBe(8)
  })

  it('tarefa arquivada não recebe estimativa nova', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos, { archived: true })

    await expect(
      useCases.estimates.set.execute(...call(creator), { taskId, estimatedHoursHundredths: 800 }),
    ).rejects.toThrow(/arquivada/i)
  })

  it('tarefa de outro time não é encontrada, e contexto de outro time é recusado', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await setEstimateModule(repos, otherOrganizationId, 'active')
    await seedTask(repos, { id: otherOrgTaskId, org: otherOrganizationId })

    await expect(
      useCases.estimates.set.execute(...call(manager), {
        taskId: otherOrgTaskId,
        estimatedHoursHundredths: 800,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      useCases.estimates.set.execute(createTenantContext(otherManager), manager, {
        taskId,
        estimatedHoursHundredths: 800,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('falha na gravação não deixa estimativa parcial (tudo ou nada)', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    const realSave = repos.tasks.save.bind(repos.tasks)
    repos.tasks.save = async (org, task) => {
      await realSave(org, task)
      throw new Error('falha simulada')
    }

    await expect(
      useCases.estimates.set.execute(...call(creator), { taskId, estimatedHoursHundredths: 800 }),
    ).rejects.toThrow('falha simulada')
    expect((await repos.tasks.findById(organizationId, taskId))?.estimatedHours).toBeNull()
  })
})

describe('custo estimado e realizado no DTO (visibilidade)', () => {
  // Estimativa 10 h dividida entre 2 envolvidos = 5 h cada.
  // Estimado: criador 5 h × R$ 45 = R$ 225; apoio 5 h × R$ 72 = R$ 360; total R$ 585.
  // Realizado: criador 0 h; apoio 3 h × R$ 72 = R$ 216; total R$ 216.
  async function seedWithEstimate(repos: UnitOfWorkRepositories) {
    await setEstimateModule(repos, organizationId, 'active')
    const task = await seedTask(repos)
    await repos.tasks.save(organizationId, setEstimatedHours(task, 1000))
  }

  it('gestor vê o total estimado e o total realizado', async () => {
    const { useCases, repos } = setup()
    await seedWithEstimate(repos)

    const detail = await useCases.tasks.getDetail.execute(...call(manager), { taskId })

    expect(detail.estimatedHours).toBe(10)
    expect(detail.estimatedCost).toBe(585)
    expect(detail.realizedCost).toBe(216)
    expect(detail.total).toBe(216)
  })

  it('colaborador vê só a própria parcela estimada e a própria parte realizada', async () => {
    const { useCases, repos } = setup()
    await seedWithEstimate(repos)

    const creatorView = await useCases.tasks.getDetail.execute(...call(creator), { taskId })
    expect(creatorView.estimatedCost).toBe(225)
    expect(creatorView.realizedCost).toBe(0)
    expect(creatorView.total).toBeNull()

    const supportView = await useCases.tasks.getDetail.execute(...call(support), { taskId })
    expect(supportView.estimatedCost).toBe(360)
    expect(supportView.realizedCost).toBe(216)
    expect(supportView.total).toBeNull()
  })

  it('colaborador que só vê a tarefa como membro do projeto não recebe nenhum valor', async () => {
    const { useCases, repos } = setup()
    await seedWithEstimate(repos)

    const view = await useCases.tasks.getDetail.execute(...call(member), { taskId })

    expect(view.estimatedHours).toBe(10)
    expect(view.estimatedCost).toBeNull()
    expect(view.realizedCost).toBeNull()
    expect(view.total).toBeNull()
    expect(view.participations.every((item) => item.rate === null)).toBe(true)
  })

  it('a lista do quadro de equipe segue a mesma visibilidade por ator', async () => {
    const { useCases, repos } = setup()
    await seedWithEstimate(repos)

    const [forSupport] = await useCases.tasks.listTeamBoard.execute(...call(support), {})
    expect(forSupport?.estimatedCost).toBe(360)
    expect(forSupport?.estimatedCost).not.toBe(585)

    const [forManager] = await useCases.tasks.listTeamBoard.execute(...call(manager), {})
    expect(forManager?.estimatedCost).toBe(585)
  })

  it('sem estimativa, o custo estimado é nulo para todos, inclusive o gestor', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    const detail = await useCases.tasks.getDetail.execute(...call(manager), { taskId })

    expect(detail.estimatedHours).toBeNull()
    expect(detail.estimatedCost).toBeNull()
    expect(detail.realizedCost).toBe(216)
  })

  it('a resposta de definir a estimativa segue a mesma visibilidade', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    const forSupport = await useCases.estimates.set.execute(...call(support), {
      taskId,
      estimatedHoursHundredths: 1000,
    })
    expect(forSupport.estimatedCost).toBe(360)
    expect(forSupport.estimatedCost).not.toBe(585)

    const forManager = await useCases.estimates.set.execute(...call(manager), {
      taskId,
      estimatedHoursHundredths: 1000,
    })
    expect(forManager.estimatedCost).toBe(585)
  })
})

describe('estimativa em horas: linha do tempo (M3.7b)', () => {
  const timelineOf = (repos: UnitOfWorkRepositories) =>
    repos.timeline.listByTask(organizationId, taskId)

  it('definir grava estimate_changed com antes e depois em centésimos, autor e data/hora', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1250,
    })

    expect(await timelineOf(repos)).toEqual([
      expect.objectContaining({
        type: 'estimate_changed',
        taskId,
        payload: { before: null, after: 1250 },
        actorUserId: creatorId,
        asManager: false,
        at: now,
      }),
    ])
  })

  it('trocar um valor por outro grava o antes e o depois', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 800,
    })

    const events = await timelineOf(repos)
    expect(events.map((event) => event.payload)).toEqual([
      { before: 1000, after: 800 },
      { before: null, after: 1000 },
    ])
  })

  it('limpar grava estimate_changed com depois nulo', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: null,
    })

    const [latest] = await timelineOf(repos)
    expect(latest).toMatchObject({
      type: 'estimate_changed',
      payload: { before: 1000, after: null },
    })
  })

  it('repetir o mesmo valor não grava evento', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    expect(await timelineOf(repos)).toHaveLength(1)
  })

  it('gestor que define a estimativa grava o evento marcado como Gestor', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)

    await useCases.estimates.set.execute(...call(manager), {
      taskId,
      estimatedHoursHundredths: 800,
    })

    expect(await timelineOf(repos)).toEqual([
      expect.objectContaining({
        type: 'estimate_changed',
        actorUserId: managerId,
        asManager: true,
      }),
    ])
  })

  it('falha ao gravar a linha do tempo desfaz a estimativa', async () => {
    const { useCases, repos, unitOfWork } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    vi.spyOn(unitOfWork.repositories.timeline, 'saveMany').mockRejectedValueOnce(
      new Error('falha na linha do tempo'),
    )

    await expect(
      useCases.estimates.set.execute(...call(creator), { taskId, estimatedHoursHundredths: 800 }),
    ).rejects.toThrow('falha na linha do tempo')

    expect((await repos.tasks.findById(organizationId, taskId))?.estimatedHours).toBeNull()
    expect(await timelineOf(repos)).toEqual([])
  })

  it('membro do projeto vê o evento de estimativa, sem valor monetário', async () => {
    const { useCases, repos } = setup()
    await setEstimateModule(repos, organizationId, 'active')
    await seedTask(repos)
    await useCases.estimates.set.execute(...call(creator), {
      taskId,
      estimatedHoursHundredths: 1000,
    })

    const events = await useCases.timeline.list.execute(...call(member), { taskId })

    const estimated = events.find((event) => event.type === 'estimate_changed')
    expect(estimated?.text).toContain('10')
    expect(events.some((event) => event.text.includes('R$'))).toBe(false)
  })
})
