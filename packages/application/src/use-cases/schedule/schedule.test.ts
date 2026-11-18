import { describe, expect, it, vi } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
  toProjectId,
} from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { ScheduleViewDto, TaskDto, WbsViewDto } from '@agilebox/contract'
import {
  ana,
  anaId,
  carla,
  createTaskHarness,
  ctx,
  enableProjectModules,
  manager,
  managerId,
  orgA,
  otherManager,
  projectId,
  seedTaskHarness,
  setProjectModules,
  taskId,
} from '../../testing/task-harness'

const SCHEDULE_MODULES: readonly ModuleId[] = ['schedule', 'wbs', 'milestones']

type Harness = ReturnType<typeof createTaskHarness>

async function setup(modules: readonly ModuleId[] = SCHEDULE_MODULES) {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, { projectModules: modules })
  // Ana participa do projeto (lê o cronograma); a tarefa dela já é dela.
  await harness.useCases.projects.addMember.execute(ctx(manager), { projectId, userId: anaId })
  return harness
}

/** Tarefa nova no projeto, criada pela gestora (ela edita tudo no MVP de teste). */
async function newTask(harness: Harness, title: string, project = projectId): Promise<TaskDto> {
  return harness.useCases.tasks.create.execute(ctx(manager), { projectId: project, title })
}

async function headOf(harness: Harness, id: string): Promise<{ key: string; title: string }> {
  const detail = await harness.useCases.tasks.getDetail.execute(ctx(manager), { taskId: id })
  return { key: detail.key, title: detail.title }
}

async function timelineOf(harness: Harness, id: string) {
  return harness.useCases.timeline.list.execute(ctx(manager), { taskId: id })
}

async function doneSteps(harness: Harness, userId: typeof managerId, project = projectId) {
  const entries = await harness.unitOfWork.repositories.guideProgress.listForUser(
    orgA,
    toProjectId(project),
    userId,
  )
  return entries.filter((entry) => entry.doneAt !== null).map((entry) => entry.stepKey)
}

describe('tasks.setStart (início da tarefa)', () => {
  it('define o início, grava start_changed e marca a edição da gestora como Gestor', async () => {
    const harness = await setup()
    const byAna = await harness.useCases.tasks.setStart.execute(ctx(ana), {
      taskId,
      startsOn: '2026-04-01',
    })
    expect(byAna.startsOn).toBe('2026-04-01')
    const anaEvents = await timelineOf(harness, taskId)
    expect(anaEvents[0]).toMatchObject({ type: 'start_changed', asManager: false })

    await harness.useCases.tasks.setStart.execute(ctx(manager), { taskId, startsOn: null })
    const managerEvent = (await timelineOf(harness, taskId)).find(
      (event) => event.type === 'start_changed' && event.asManager,
    )
    expect(managerEvent?.text).toBe('alterou o início de 2026-04-01 para sem início')
  })

  it('recusa início depois do prazo com a mensagem do domínio', async () => {
    const harness = await setup()
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId,
      changes: { deadline: '2026-04-10' },
    })
    await expect(
      harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-11' }),
    ).rejects.toThrow(new ValidationError('O início não pode ser depois do prazo'))
  })

  it('o prazo não pode ser antes do início já definido (tasks.update)', async () => {
    const harness = await setup()
    await harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-05' })
    await expect(
      harness.useCases.tasks.update.execute(ctx(manager), {
        taskId,
        changes: { deadline: '2026-04-04' },
      }),
    ).rejects.toThrow('O prazo não pode ser antes do início')
  })

  it('recusa quem não edita a tarefa, tarefa arquivada, módulo desligado e outra organização', async () => {
    const harness = await setup()
    await expect(
      harness.useCases.tasks.setStart.execute(ctx(carla), { taskId, startsOn: '2026-04-01' }),
    ).rejects.toThrow(PermissionDeniedError)

    await harness.useCases.tasks.archive.execute(ctx(ana), { taskId })
    await expect(
      harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-01' }),
    ).rejects.toThrow(ConflictError)
    await harness.useCases.tasks.unarchive.execute(ctx(ana), { taskId })

    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      schedule: 'disabled',
    })
    await expect(
      harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-01' }),
    ).rejects.toThrow('Esta ferramenta está desativada para a equipe.')

    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, { schedule: 'active' })
    await expect(
      harness.useCases.tasks.setStart.execute(ctx(otherManager), {
        taskId,
        startsOn: '2026-04-01',
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('conclui "Dê início e fim" só para quem completou início e prazo', async () => {
    const harness = await setup()
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId,
      changes: { deadline: '2026-04-10' },
    })
    // Só com o prazo ainda não há cronograma: nada conclui.
    expect(await doneSteps(harness, anaId)).not.toContain('schedule.dates')

    await harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-01' })
    expect(await doneSteps(harness, anaId)).toContain('schedule.dates')
    expect(await doneSteps(harness, managerId)).not.toContain('schedule.dates')
  })
  it('prazo definido depois do início, pela edição comum, também conclui o passo para quem editou', async () => {
    const harness = await setup()
    await harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-01' })
    expect(await doneSteps(harness, anaId)).not.toContain('schedule.dates')
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId,
      changes: { deadline: '2026-04-10' },
    })
    expect(await doneSteps(harness, managerId)).toContain('schedule.dates')
    expect(await doneSteps(harness, anaId)).not.toContain('schedule.dates')
  })
})

describe('schedule.addDependency e removeDependency', () => {
  it('liga a sucessora à predecessora, grava o evento com chave e título, e conclui "Dê início e fim"', async () => {
    const harness = await setup()
    const second = await newTask(harness, 'Desenvolvimento')
    const view = await harness.useCases.schedule.addDependency.execute(ctx(manager), {
      predecessorId: taskId,
      successorId: second.id,
    })
    expect(view.dependencies).toEqual([
      { predecessorId: taskId, successorId: second.id, conflict: false },
    ])
    const { key, title } = await headOf(harness, taskId)
    const events = await timelineOf(harness, second.id)
    expect(events[0]).toMatchObject({ type: 'dependency_changed', asManager: true })
    expect(events[0]?.text).toBe(`passou a depender de ${key} "${title}"`)
    expect(await doneSteps(harness, managerId)).toContain('schedule.dates')
  })

  it('recusa ciclo direto, ciclo indireto, duplicata e a própria tarefa', async () => {
    const harness = await setup()
    const b = await newTask(harness, 'B')
    const c = await newTask(harness, 'C')
    const add = (predecessorId: string, successorId: string) =>
      harness.useCases.schedule.addDependency.execute(ctx(manager), { predecessorId, successorId })
    await add(taskId, b.id)
    await add(b.id, c.id)
    await expect(add(b.id, taskId)).rejects.toThrow(ValidationError)
    await expect(add(c.id, taskId)).rejects.toThrow('ciclo')
    await expect(add(taskId, b.id)).rejects.toThrow('Esta dependência já existe')
    await expect(add(b.id, b.id)).rejects.toThrow('Tarefa não pode depender de si mesma')
  })

  it('recusa tarefa de outro projeto', async () => {
    const harness = await setup()
    const created = await harness.useCases.projects.createProject.execute(ctx(manager), {
      name: 'Outro projeto',
    })
    const other = toProjectId(created.id)
    await enableProjectModules(harness.unitOfWork, orgA, other, managerId, ['schedule'])
    const elsewhere = await newTask(harness, 'Em outro', other)
    await expect(
      harness.useCases.schedule.addDependency.execute(ctx(manager), {
        predecessorId: taskId,
        successorId: elsewhere.id,
      }),
    ).rejects.toThrow('As tarefas precisam ser do mesmo projeto')
  })

  it('recusa quem não edita a sucessora, outra organização e módulo desligado ou encerrando', async () => {
    const harness = await setup()
    const b = await newTask(harness, 'B')
    await expect(
      harness.useCases.schedule.addDependency.execute(ctx(carla), {
        predecessorId: taskId,
        successorId: b.id,
      }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      harness.useCases.schedule.addDependency.execute(ctx(otherManager), {
        predecessorId: taskId,
        successorId: b.id,
      }),
    ).rejects.toThrow(NotFoundError)

    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      schedule: 'winding_down',
    })
    await expect(
      harness.useCases.schedule.addDependency.execute(ctx(manager), {
        predecessorId: taskId,
        successorId: b.id,
      }),
    ).rejects.toThrow('Esta ferramenta está sendo encerrada')
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      schedule: 'disabled',
    })
    await expect(
      harness.useCases.schedule.removeDependency.execute(ctx(manager), {
        predecessorId: taskId,
        successorId: b.id,
      }),
    ).rejects.toThrow('Esta ferramenta está desativada para a equipe.')
  })

  it('remove a dependência, grava o evento "deixou de depender" e recusa a que não existe', async () => {
    const harness = await setup()
    const b = await newTask(harness, 'B')
    await harness.useCases.schedule.addDependency.execute(ctx(manager), {
      predecessorId: taskId,
      successorId: b.id,
    })
    const view = await harness.useCases.schedule.removeDependency.execute(ctx(manager), {
      predecessorId: taskId,
      successorId: b.id,
    })
    expect(view.dependencies).toEqual([])
    const events = await timelineOf(harness, b.id)
    const { key, title } = await headOf(harness, taskId)
    expect(events[0]?.text).toBe(`deixou de depender de ${key} "${title}"`)
    await expect(
      harness.useCases.schedule.removeDependency.execute(ctx(manager), {
        predecessorId: taskId,
        successorId: b.id,
      }),
    ).rejects.toThrow('Dependência não encontrada')
  })
})

describe('schedule.get (leitura do cronograma)', () => {
  it('traz o intervalo, os conflitos, as tarefas com permissão e deixa de fora as arquivadas', async () => {
    const harness = await setup()
    const b = await newTask(harness, 'B')
    const archived = await newTask(harness, 'Arquivada')
    await harness.useCases.tasks.archive.execute(ctx(manager), { taskId: archived.id })
    await harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-01' })
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId,
      changes: { deadline: '2026-04-10' },
    })
    await harness.useCases.tasks.setStart.execute(ctx(manager), {
      taskId: b.id,
      startsOn: '2026-04-05',
    })
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId: b.id,
      changes: { deadline: '2026-04-20' },
    })
    // Predecessora termina em 10/04 e a sucessora começa em 05/04: conflito.
    const view = await harness.useCases.schedule.addDependency.execute(ctx(manager), {
      predecessorId: taskId,
      successorId: b.id,
    })

    expect(view.range).toEqual({ start: '2026-04-01', end: '2026-04-20' })
    expect(view.dependencies).toEqual([
      { predecessorId: taskId, successorId: b.id, conflict: true },
    ])
    expect(view.tasks.map((row) => row.taskId).sort()).toEqual([taskId, b.id].sort())
    expect(view.tasks.find((row) => row.taskId === taskId)).toMatchObject({
      startsOn: '2026-04-01',
      deadline: '2026-04-10',
      responsibleName: 'Ana',
      done: false,
      progress: 0,
      canEdit: true,
      deliverableCode: null,
    })
    expect(view.today).toBe('2026-01-02')
    expect(view.canEdit).toBe(true)
  })

  it('o intervalo é nulo sem tarefa com as duas datas, e progresso é 100 quando concluída', async () => {
    const harness = await setup()
    const empty = await harness.useCases.schedule.get.execute(ctx(manager), { projectId })
    expect(empty.range).toBeNull()

    await harness.useCases.tasks.setStart.execute(ctx(ana), { taskId, startsOn: '2026-04-01' })
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId,
      changes: { deadline: '2026-04-02' },
    })
    await harness.useCases.tasks.move.execute(ctx(manager), { taskId, status: 'done' })
    const view = await harness.useCases.schedule.get.execute(ctx(manager), { projectId })
    expect(view.range).toEqual({ start: '2026-04-01', end: '2026-04-02' })
    expect(view.tasks[0]).toMatchObject({ done: true, progress: 100 })
  })

  it('mostra o código da entrega só com o módulo wbs ligado, e os marcos só com milestones ligado', async () => {
    const harness = await setup()
    const wbs: WbsViewDto = await harness.useCases.wbs.createDeliverable.execute(ctx(manager), {
      projectId,
      parentId: null,
      title: 'Fundação',
    })
    const root = wbs.deliverables.find((row) => row.kind === 'deliverable')
    if (root?.kind !== 'deliverable') throw new Error('entrega não criada')
    await harness.useCases.tasks.setDeliverable.execute(ctx(manager), {
      taskId,
      deliverableId: root.id,
    })
    await harness.useCases.milestones.create.execute(ctx(manager), {
      projectId,
      title: 'Entrega ao cliente',
      dueOn: '2026-06-30',
      deliverableId: null,
      criterion: null,
    })
    const on = await harness.useCases.schedule.get.execute(ctx(manager), { projectId })
    expect(on.tasks.find((row) => row.taskId === taskId)?.deliverableCode).toBe('1')
    expect(on.milestones).toEqual([
      expect.objectContaining({ title: 'Entrega ao cliente', dueOn: '2026-06-30' }),
    ])

    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      wbs: 'disabled',
      milestones: 'disabled',
    })
    const off = await harness.useCases.schedule.get.execute(ctx(manager), { projectId })
    expect(off.tasks.find((row) => row.taskId === taskId)?.deliverableCode).toBeNull()
    expect(off.milestones).toEqual([])
  })

  it('marca "Acompanhe pelo cronograma" só para quem abriu, e a leitura segue se o guia falhar', async () => {
    const harness = await setup()
    await harness.useCases.schedule.get.execute(ctx(ana), { projectId })
    expect(await doneSteps(harness, anaId)).toContain('schedule.follow')
    expect(await doneSteps(harness, managerId)).not.toContain('schedule.follow')

    const spy = vi
      .spyOn(harness.unitOfWork, 'run')
      .mockRejectedValueOnce(new Error('falha do guia'))
    const view: ScheduleViewDto = await harness.useCases.schedule.get.execute(ctx(manager), {
      projectId,
    })
    expect(view.projectId).toBe(projectId)
    spy.mockRestore()
    expect(await doneSteps(harness, managerId)).not.toContain('schedule.follow')
  })

  it('recusa quem não vê o projeto; módulo desligado vale como nos demais casos', async () => {
    const harness = await setup()
    await expect(harness.useCases.schedule.get.execute(ctx(carla), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      harness.useCases.schedule.get.execute(ctx(otherManager), { projectId }),
    ).rejects.toThrow(NotFoundError)
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      schedule: 'disabled',
    })
    await expect(
      harness.useCases.schedule.get.execute(ctx(manager), { projectId }),
    ).rejects.toThrow('Esta ferramenta está desativada para a equipe.')
  })

  it('a gestora edita o planejamento e ana (sem ser gestora nem criadora) não edita', async () => {
    const harness = await setup()
    expect((await harness.useCases.schedule.get.execute(ctx(manager), { projectId })).canEdit).toBe(
      true,
    )
    expect((await harness.useCases.schedule.get.execute(ctx(ana), { projectId })).canEdit).toBe(
      false,
    )
  })
})
