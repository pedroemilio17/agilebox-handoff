import { describe, expect, it } from 'vitest'
import {
  NotFoundError,
  PermissionDeniedError,
  toEventId,
  toProjectId,
  toTaskId,
} from '@agilebox/core'
import type { Task, TimelineEvent } from '@agilebox/core'
import type { FlowMetricsViewDto } from '@agilebox/contract'
import {
  anaId,
  ana,
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
} from '../../testing/task-harness'

type Harness = ReturnType<typeof createTaskHarness>

/** Relógio fixo do harness: 2026-01-02 12:00 UTC (sexta-feira). */
async function setup() {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, { projectModules: ['flowMetrics'] })
  // Ana participa do projeto: lê as métricas do projeto.
  await harness.useCases.projects.addMember.execute(ctx(manager), { projectId, userId: anaId })
  return harness
}

function read(harness: Harness, actor = manager): Promise<FlowMetricsViewDto> {
  return harness.useCases.flowMetrics.get.execute(ctx(actor), { projectId })
}

/**
 * Cria uma tarefa e a deixa com a data de criação e a linha do tempo pedidas. A criação do harness
 * usa o relógio fixo, então a data de criação é ajustada direto no repositório.
 */
async function seedTask(
  harness: Harness,
  title: string,
  createdAt: string,
  events: readonly { readonly at: string; readonly after: Task['status'] }[],
  eventNumber: number,
): Promise<void> {
  const created = await harness.useCases.tasks.create.execute(ctx(manager), { projectId, title })
  const createdId = toTaskId(created.id)
  const task = await harness.unitOfWork.repositories.tasks.findById(orgA, createdId)
  if (!task) throw new Error('tarefa de teste não encontrada')
  await harness.unitOfWork.repositories.tasks.save(orgA, {
    ...task,
    createdAt,
    status: events.at(-1)?.after ?? 'todo',
  })
  const timeline: TimelineEvent[] = events.map((event, index) => ({
    id: toEventId(String(eventNumber * 10 + index).padStart(26, '0')),
    taskId: createdId,
    at: event.at,
    actorUserId: managerId,
    asManager: false,
    type: 'status_changed',
    payload: { before: 'todo', after: event.after },
  }))
  await harness.unitOfWork.repositories.timeline.saveMany(orgA, timeline)
}

describe('flowMetrics.get', () => {
  it('quem vê o projeto lê; quem não é membro é recusado; outra organização vê NotFound', async () => {
    const harness = await setup()
    await expect(read(harness, ana)).resolves.toMatchObject({ projectId })
    await expect(read(harness, carla)).rejects.toThrow(PermissionDeniedError)
    await expect(read(harness, otherManager)).rejects.toThrow(NotFoundError)
    await expect(
      harness.useCases.flowMetrics.get.execute(ctx(manager), {
        projectId: toProjectId('00000000000000000000000099'),
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('recusa o projeto quando o módulo flowMetrics está desligado', async () => {
    const harness = await setup()
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      flowMetrics: 'disabled',
    })
    await expect(read(harness)).rejects.toThrow('Esta ferramenta está desativada para a equipe.')
  })

  it('encerrando (winding_down) continua lendo as métricas', async () => {
    const harness = await setup()
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      flowMetrics: 'winding_down',
    })
    await expect(read(harness)).resolves.toMatchObject({ projectId })
  })

  it('sem tarefas concluídas: oito semanas, médias nulas e nada contado', async () => {
    const harness = await setup()
    const view = await read(harness)
    expect(view.today).toBe('2026-01-02')
    expect(view.windowStart).toBe('2025-11-10')
    expect(view.windowEnd).toBe('2026-01-05')
    expect(view.weeks).toHaveLength(8)
    expect(view.weeks.at(-1)).toEqual({ start: '2025-12-29', completed: 0 })
    expect(view).toMatchObject({ leadDays: null, cycleDays: null, completed: 0 })
  })

  it('calcula lead time, cycle time e vazão da linha do tempo, uma vez por tarefa e por semana', async () => {
    const harness = await setup()
    // Concluída na semana de 22/12: lead de 6 dias e ciclo de 4 dias (começou em 22/12).
    await seedTask(
      harness,
      'Entregue em dezembro',
      '2025-12-20T12:00:00Z',
      [
        { at: '2025-12-22T12:00:00Z', after: 'in_progress' },
        { at: '2025-12-26T12:00:00Z', after: 'done' },
      ],
      1,
    )
    // Concluída na semana de 29/12, sem início registrado: entra só no lead (3 dias).
    await seedTask(
      harness,
      'Entregue no fim do ano',
      '2025-12-29T12:00:00Z',
      [{ at: '2026-01-01T12:00:00Z', after: 'done' }],
      2,
    )
    // Concluída depois de agora: não conta.
    await seedTask(
      harness,
      'Ainda não concluída',
      '2025-12-30T12:00:00Z',
      [{ at: '2026-01-03T12:00:00Z', after: 'done' }],
      3,
    )

    const view = await read(harness)
    expect(view.completed).toBe(2)
    expect(view.leadDays).toBeCloseTo(4.5, 5)
    expect(view.cycleDays).toBeCloseTo(4, 5)
    expect(view.weeks.map((week) => week.completed)).toEqual([0, 0, 0, 0, 0, 0, 1, 1])
    expect(view.weeks.at(-2)).toEqual({ start: '2025-12-22', completed: 1 })
  })

  it('o DTO não traz valores de custo', async () => {
    const harness = await setup()
    const view = await read(harness, ana)
    const keys = Object.keys(view).join(' ').toLowerCase()
    expect(keys).not.toMatch(/cost|rate|custo|valor/)
    for (const week of view.weeks) expect(Object.keys(week).sort()).toEqual(['completed', 'start'])
  })
})
