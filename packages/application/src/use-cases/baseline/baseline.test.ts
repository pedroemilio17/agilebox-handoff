import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  parseDateOnly,
  toProjectId,
  toTaskId,
} from '@agilebox/core'
import type { ModuleId, Task } from '@agilebox/core'
import {
  NOW,
  ana,
  anaId,
  bia,
  carla,
  createTaskHarness,
  ctx,
  manager,
  managerId,
  orgA,
  otherManager,
  projectId,
  seedTaskHarness,
  setProjectModules,
  taskId,
} from '../../testing/task-harness'

const BASELINE_MODULES: readonly ModuleId[] = ['baseline', 'schedule', 'estimates.hours', 'cost']
const otherProjectId = toProjectId('00000000000000000000000030')

type Harness = Awaited<ReturnType<typeof setup>>

async function setup(
  modules: readonly ModuleId[] = BASELINE_MODULES,
  estimate: number | null = 800,
) {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, {
    projectModules: modules,
    estimatedHoursHundredths: estimate,
    responsibleRateCents: 4500,
  })
  // Ana é Responsável da tarefa e membro do projeto: lê e edita o que participa.
  await harness.unitOfWork.repositories.projects.addMember(orgA, {
    projectId,
    userId: anaId,
    addedBy: managerId,
    addedAt: NOW,
  })
  return harness
}

/** Põe datas na tarefa de ana (a foto só grava tarefas com alguma data). */
async function setDates(harness: Harness, starts: string, deadline: string): Promise<void> {
  const task = await harness.unitOfWork.repositories.tasks.findById(orgA, taskId)
  if (!task) throw new Error('Tarefa de teste ausente')
  await harness.unitOfWork.repositories.tasks.save(orgA, {
    ...task,
    startsOn: parseDateOnly(starts),
    deadline: parseDateOnly(deadline),
  })
}

async function currentTask(harness: Harness): Promise<Task> {
  const task = await harness.unitOfWork.repositories.tasks.findById(orgA, taskId)
  if (!task) throw new Error('Tarefa de teste ausente')
  return task
}

async function takePhoto(harness: Harness) {
  return harness.useCases.baseline.take.execute(ctx(manager), { projectId })
}

describe('linha de base: tirar a foto', () => {
  it('o gestor tira a foto com as tarefas que têm data, horas e custo estimado', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')

    const view = await takePhoto(harness)

    expect(view.canTake).toBe(true)
    expect(view.costEnabled).toBe(true)
    expect(view.baseline).toMatchObject({ takenByName: 'Gestora', takenAt: NOW })
    expect(view.baseline?.name).toBe('Linha de base de 02/01/2026')
    expect(view.summary).toMatchObject({
      plannedEnd: '2026-11-10',
      currentEnd: '2026-11-10',
      endDeviationDays: 0,
      plannedHours: 8,
      currentHours: 8,
      plannedCost: 360,
      currentCost: 360,
    })
    expect(view.tasks).toEqual([
      expect.objectContaining({
        taskId,
        status: 'on_time',
        plannedStartsOn: '2026-11-02',
        plannedEndsOn: '2026-11-10',
        hoursDelta: 0,
        costDelta: 0,
      }),
    ])
  })

  it('tarefa sem nenhuma data fica fora da foto e não aparece como nova depois', async () => {
    const harness = await setup()
    const view = await takePhoto(harness)
    expect(view.baseline).not.toBeNull()
    expect(view.tasks).toEqual([])
    expect(view.summary).toMatchObject({ plannedEnd: null, endDeviationDays: null })
  })

  it('sem o módulo cost ligado, a foto não guarda custo e a leitura vem sem valores', async () => {
    const harness = await setup(['baseline', 'schedule', 'estimates.hours'])
    await setDates(harness, '2026-11-02', '2026-11-10')
    const view = await takePhoto(harness)
    expect(view.costEnabled).toBe(false)
    expect(view.summary).toMatchObject({ plannedCost: null, currentCost: null })
    expect(view.tasks[0]?.costDelta).toBeNull()
    expect(view.summary?.plannedHours).toBe(8)
  })

  it('só o gestor tira a foto; colaborador recebe permissão negada e nada é gravado', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await expect(harness.useCases.baseline.take.execute(ctx(ana), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      harness.useCases.baseline.get.execute(ctx(ana), { projectId }),
    ).resolves.toMatchObject({ baseline: null, canTake: false })
  })

  it('projeto arquivado não aceita foto nova', async () => {
    const harness = await setup()
    const project = await harness.unitOfWork.repositories.projects.findById(orgA, projectId)
    if (!project) throw new Error('Projeto de teste ausente')
    await harness.unitOfWork.repositories.projects.save(orgA, {
      ...project,
      archivedAt: NOW,
    })
    await expect(takePhoto(harness)).rejects.toThrow(ConflictError)
  })

  it('encerrando, o módulo recusa foto nova (é criação)', async () => {
    const harness = await setup()
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      baseline: 'winding_down',
    })
    await expect(takePhoto(harness)).rejects.toThrow(ConflictError)
    await expect(
      harness.useCases.baseline.get.execute(ctx(manager), { projectId }),
    ).resolves.toMatchObject({ canTake: true })
  })

  it('com o módulo desligado, o guard recusa tirar e ler', async () => {
    const harness = await setup(['schedule', 'estimates.hours', 'cost'])
    await expect(takePhoto(harness)).rejects.toThrow(PermissionDeniedError)
    await expect(
      harness.useCases.baseline.get.execute(ctx(manager), { projectId }),
    ).rejects.toThrow(PermissionDeniedError)
  })
})

describe('linha de base: leitura e desvios', () => {
  it('sem foto, a leitura vem vazia e o gestor pode tirar a primeira', async () => {
    const harness = await setup()
    await expect(
      harness.useCases.baseline.get.execute(ctx(manager), { projectId }),
    ).resolves.toEqual({
      projectId,
      canTake: true,
      costEnabled: true,
      costVisible: true,
      baseline: null,
      summary: null,
      tasks: [],
    })
  })

  it('depois da foto, atraso no fim vira Atrasada com os dias e a diferença de horas e custo', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await takePhoto(harness)

    const task = await currentTask(harness)
    await harness.unitOfWork.repositories.tasks.save(orgA, {
      ...task,
      deadline: parseDateOnly('2026-11-13'),
      estimatedHoursHundredths: 1000,
    })
    const view = await harness.useCases.baseline.get.execute(ctx(manager), { projectId })

    expect(view.summary).toMatchObject({
      endDeviationDays: 3,
      plannedEnd: '2026-11-10',
      currentEnd: '2026-11-13',
    })
    expect(view.summary).toMatchObject({
      plannedHours: 8,
      currentHours: 10,
      plannedCost: 360,
      currentCost: 450,
    })
    expect(view.tasks[0]).toMatchObject({
      status: 'late',
      delayDays: 3,
      startDelayDays: 0,
      endDelayDays: 3,
      hoursDelta: 2,
      costDelta: 90,
    })
  })

  it('tarefa criada depois da foto aparece como Nova, sem comparação', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await takePhoto(harness)
    const created = await harness.useCases.tasks.create.execute(ctx(ana), {
      projectId,
      title: 'Nova depois',
    })
    // O relógio do teste é fixo (igual à foto): a tarefa precisa ser posterior à foto.
    const newTask = await harness.unitOfWork.repositories.tasks.findById(orgA, toTaskId(created.id))
    if (!newTask) throw new Error('Tarefa nova ausente')
    await harness.unitOfWork.repositories.tasks.save(orgA, {
      ...newTask,
      createdAt: '2026-11-03T09:00:00.000Z',
    })

    const view = await harness.useCases.baseline.get.execute(ctx(manager), { projectId })
    expect(view.tasks.find((row) => row.title === 'Nova depois')).toMatchObject({
      status: 'new',
      delayDays: null,
      hoursDelta: null,
      costDelta: null,
    })
  })

  it('tarefa da foto que foi arquivada aparece como Removida', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await takePhoto(harness)
    const task = await currentTask(harness)
    await harness.unitOfWork.repositories.tasks.save(orgA, { ...task, archivedAt: NOW })

    const view = await harness.useCases.baseline.get.execute(ctx(manager), { projectId })
    expect(view.tasks).toEqual([
      expect.objectContaining({
        taskId,
        status: 'removed',
        plannedEndsOn: '2026-11-10',
        currentEndsOn: null,
      }),
    ])
    expect(view.summary).toMatchObject({
      currentEnd: null,
      endDeviationDays: null,
      currentHours: 0,
    })
  })

  it('a foto mais recente é a de comparação', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await takePhoto(harness)
    await setDates(harness, '2026-11-02', '2026-11-20')
    const second = await takePhoto(harness)
    expect(second.summary).toMatchObject({ plannedEnd: '2026-11-20', endDeviationDays: 0 })
    expect(second.tasks[0]?.status).toBe('on_time')
  })

  it('colaborador membro lê as datas e os desvios, mas não vê valores', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await takePhoto(harness)
    const task = await currentTask(harness)
    await harness.unitOfWork.repositories.tasks.save(orgA, {
      ...task,
      deadline: parseDateOnly('2026-11-12'),
    })

    const view = await harness.useCases.baseline.get.execute(ctx(ana), { projectId })
    expect(view.canTake).toBe(false)
    expect(view.costVisible).toBe(false)
    expect(view.summary).toMatchObject({
      endDeviationDays: 2,
      plannedCost: null,
      currentCost: null,
    })
    expect(view.tasks[0]).toMatchObject({ status: 'late', delayDays: 2, costDelta: null })
  })

  it('quem não é membro não lê a linha de base', async () => {
    const harness = await setup()
    await setDates(harness, '2026-11-02', '2026-11-10')
    await takePhoto(harness)
    await expect(harness.useCases.baseline.get.execute(ctx(carla), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(harness.useCases.baseline.get.execute(ctx(bia), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
  })

  it('projeto de outra organização não aparece: NotFound, sem revelar o projeto', async () => {
    const harness = await setup()
    await expect(
      harness.useCases.baseline.get.execute(ctx(otherManager), { projectId }),
    ).rejects.toThrow(NotFoundError)
    await expect(
      harness.useCases.baseline.get.execute(ctx(manager), { projectId: otherProjectId }),
    ).rejects.toThrow(NotFoundError)
  })
})
