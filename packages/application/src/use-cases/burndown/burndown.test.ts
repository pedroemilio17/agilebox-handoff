import { describe, expect, it } from 'vitest'
import { NotFoundError, PermissionDeniedError } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { BurndownViewDto } from '@agilebox/contract'
import {
  anaId,
  ana,
  carla,
  createTaskHarness,
  ctx,
  manager,
  otherManager,
  projectId,
  seedTaskHarness,
  setProjectModules,
  managerId,
  orgA,
  taskId,
} from '../../testing/task-harness'

/** Relógio fixo do harness: 2026-01-02 12:00 UTC (09:00 em São Paulo). */
const BURNDOWN_MODULES: readonly ModuleId[] = ['sprints', 'backlog', 'estimates.hours', 'burndown']

type Harness = ReturnType<typeof createTaskHarness>

async function setup() {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, {
    projectModules: BURNDOWN_MODULES,
    estimatedHoursHundredths: 400,
  })
  // Ana participa do projeto: lê o burndown e é a Responsável da tarefa de teste.
  await harness.useCases.projects.addMember.execute(ctx(manager), { projectId, userId: anaId })
  return harness
}

function read(harness: Harness, actor = manager): Promise<BurndownViewDto> {
  return harness.useCases.burndown.get.execute(ctx(actor), { projectId })
}

/** Sprint de 1 a 3 de janeiro com 3 tarefas (4 h, 2 h e 6 h). A tarefa de 4 h é concluída no dia 2. */
async function plannedSprint(harness: Harness) {
  const second = await harness.useCases.tasks.create.execute(ctx(manager), {
    projectId,
    title: 'Segunda tarefa',
  })
  await harness.useCases.tasks.setEstimate.execute(ctx(manager), {
    taskId: second.id,
    estimatedHours: 2,
  })
  const third = await harness.useCases.tasks.create.execute(ctx(manager), {
    projectId,
    title: 'Terceira tarefa',
  })
  await harness.useCases.tasks.setEstimate.execute(ctx(manager), {
    taskId: third.id,
    estimatedHours: 6,
  })
  const created = await harness.useCases.sprints.create.execute(ctx(manager), {
    projectId,
    name: '',
    plannedStart: '2026-01-01',
    plannedEnd: '2026-01-03',
  })
  for (const id of [taskId, second.id, third.id]) {
    await harness.useCases.sprints.addTask.execute(ctx(manager), {
      sprintId: created.sprint.id,
      taskId: id,
    })
  }
  await harness.useCases.sprints.start.execute(ctx(manager), { sprintId: created.sprint.id })
  await harness.useCases.tasks.move.execute(ctx(manager), { taskId, status: 'done' })
  return created.sprint.id
}

describe('burndown.get', () => {
  it('quem vê o projeto lê; quem não é membro é recusado; outra organização vê NotFound', async () => {
    const harness = await setup()
    await plannedSprint(harness)
    await expect(read(harness, ana)).resolves.toMatchObject({ projectId })
    await expect(harness.useCases.burndown.get.execute(ctx(carla), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      harness.useCases.burndown.get.execute(ctx(otherManager), { projectId }),
    ).rejects.toThrow(NotFoundError)
  })

  it('recusa o projeto quando o módulo burndown está desligado', async () => {
    const harness = await setup()
    await plannedSprint(harness)
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      burndown: 'disabled',
    })
    await expect(read(harness)).rejects.toThrow('Esta ferramenta está desativada para a equipe.')
  })

  it('sprint ativa: horas por dia contra a linha ideal, sem dias futuros medidos', async () => {
    const harness = await setup()
    await plannedSprint(harness)
    const view = await read(harness)

    expect(view.today).toBe('2026-01-02')
    expect(view.sprint).toMatchObject({ number: 1, status: 'active', plannedStart: '2026-01-01' })
    expect(view.totalHours).toBe(12)
    expect(view.remainingHours).toBe(8)
    expect(view.scopeTasks).toBe(3)
    expect(view.doneTasks).toBe(1)
    expect(view.unestimatedTasks).toBe(0)
    expect(view.days).toEqual([
      { date: '2026-01-01', idealHours: 12, remainingHours: 12 },
      { date: '2026-01-02', idealHours: 6, remainingHours: 8 },
      { date: '2026-01-03', idealHours: 0, remainingHours: null },
    ])
    // Sem sprint encerrada ainda, a velocidade fica vazia.
    expect(view.velocity).toEqual({ average: null, sprints: [] })
  })

  it('sprint encerrada: mede até o dia do encerramento e a velocidade é o que foi concluído', async () => {
    const harness = await setup()
    const sprintId = await plannedSprint(harness)
    await harness.useCases.sprints.close.execute(ctx(manager), {
      sprintId,
      policy: 'return_to_backlog',
    })
    const view = await read(harness)

    expect(view.sprint).toMatchObject({ number: 1, status: 'closed' })
    expect(view.days.map((day) => day.remainingHours)).toEqual([12, 8, null])
    expect(view.velocity).toEqual({
      average: 4,
      sprints: [{ sprintId, number: 1, name: 'Sprint 1', hours: 4 }],
    })
  })

  it('sem sprint nenhuma, a tela recebe o estado vazio', async () => {
    const harness = await setup()
    const view = await read(harness)
    expect(view).toMatchObject({
      sprint: null,
      days: [],
      velocity: { average: null, sprints: [] },
    })
  })

  it('a resposta não traz valores de custo', async () => {
    const harness = await setup()
    await plannedSprint(harness)
    const view = await read(harness, ana)
    expect(JSON.stringify(view)).not.toMatch(/cost|Cents|rate/i)
  })
})
