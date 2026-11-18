import { describe, expect, it } from 'vitest'
import { NotFoundError, PermissionDeniedError } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { TrackingViewDto, WbsViewDto } from '@agilebox/contract'
import {
  anaId,
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
  ana,
} from '../../testing/task-harness'

const TRACKING_MODULES: readonly ModuleId[] = [
  'schedule',
  'wbs',
  'milestones',
  'estimates.hours',
  'cost',
]

type Harness = ReturnType<typeof createTaskHarness>

async function setup(modules: readonly ModuleId[] = TRACKING_MODULES) {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, { projectModules: modules })
  // Ana participa do projeto: lê o acompanhamento e é a Responsável da tarefa de teste.
  await harness.useCases.projects.addMember.execute(ctx(manager), { projectId, userId: anaId })
  return harness
}

function read(harness: Harness, actor = manager): Promise<TrackingViewDto> {
  return harness.useCases.tracking.get.execute(ctx(actor), { projectId })
}

/** Id da entrega pelo título, na EAP devolvida pelo caso de uso. */
function deliverableId(view: WbsViewDto, title: string): string {
  const row = view.deliverables.find((item) => item.kind === 'deliverable' && item.title === title)
  if (!row || row.kind !== 'deliverable') throw new Error(`Entrega ${title} não encontrada`)
  return row.id
}

describe('tracking.get (acompanhamento)', () => {
  it('quem vê o projeto lê; quem não é membro é recusado; outra organização vê NotFound', async () => {
    const harness = await setup()
    await expect(read(harness, ana)).resolves.toMatchObject({ projectId })
    await expect(harness.useCases.tracking.get.execute(ctx(carla), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      harness.useCases.tracking.get.execute(ctx(otherManager), { projectId }),
    ).rejects.toThrow(NotFoundError)
  })

  it('recusa o projeto quando o módulo do cronograma está desligado', async () => {
    const harness = await setup()
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      schedule: 'disabled',
    })
    await expect(read(harness)).rejects.toThrow('Esta ferramenta está desativada para a equipe.')
  })

  it('gestor vê os valores; colaboradora vê horas e progresso, com custo nulo', async () => {
    const harness = await setup()
    await harness.useCases.tasks.setEstimate.execute(ctx(manager), {
      taskId,
      estimatedHours: 10,
    })

    const byManager = await read(harness)
    // Bia apontou 2 h a 30,00: 60,00 realizados. Ana estima 10 h a 45,00 (valor/hora dela): 450,00.
    expect(byManager.summary).toEqual({
      progress: 0,
      plannedHours: 10,
      loggedHours: 2,
      realizedCost: 60,
      plannedCost: 450,
      tasks: { total: 1, done: 0 },
    })

    const byAna = await read(harness, ana)
    expect(byAna.summary).toMatchObject({
      plannedHours: 10,
      loggedHours: 2,
      realizedCost: null,
      plannedCost: null,
    })
  })

  it('com o módulo cost desligado no projeto, nenhum valor sai, nem para o gestor; horas seguem', async () => {
    const harness = await setup()
    await harness.useCases.tasks.setEstimate.execute(ctx(manager), { taskId, estimatedHours: 10 })
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, { cost: 'disabled' })
    expect(await read(harness)).toMatchObject({
      costEnabled: false,
      summary: { plannedHours: 10, loggedHours: 2, realizedCost: null, plannedCost: null },
    })

    // Ao religar, os mesmos valores voltam ao gestor (desligar não apaga). Em encerramento, o custo segue.
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      cost: 'winding_down',
    })
    expect(await read(harness)).toMatchObject({
      costEnabled: true,
      summary: { realizedCost: 60, plannedCost: 450 },
    })
  })

  it('tarefa arquivada fica de fora de horas, custo, progresso e contagem', async () => {
    const harness = await setup()
    await harness.useCases.tasks.setEstimate.execute(ctx(manager), { taskId, estimatedHours: 10 })
    const extra = await harness.useCases.tasks.create.execute(ctx(manager), {
      projectId,
      title: 'Extra',
    })
    await harness.useCases.tasks.setEstimate.execute(ctx(manager), {
      taskId: extra.id,
      estimatedHours: 30,
    })
    expect((await read(harness)).summary).toMatchObject({
      progress: 0,
      plannedHours: 40,
      tasks: { total: 2, done: 0 },
    })

    await harness.useCases.tasks.move.execute(ctx(manager), { taskId, status: 'done' })
    expect((await read(harness)).summary.progress).toBe(25)

    await harness.useCases.tasks.archive.execute(ctx(manager), { taskId: extra.id })
    expect((await read(harness)).summary).toMatchObject({
      progress: 100,
      plannedHours: 10,
      loggedHours: 2,
      plannedCost: 450,
      tasks: { total: 1, done: 1 },
    })
  })

  it('semana atual e total saem do intervalo das tarefas com datas, e somem sem intervalo', async () => {
    const harness = await setup()
    expect((await read(harness)).week).toBeNull()

    await harness.useCases.tasks.setStart.execute(ctx(manager), { taskId, startsOn: '2026-01-01' })
    await harness.useCases.tasks.update.execute(ctx(manager), {
      taskId,
      changes: { deadline: '2026-02-05' },
    })
    // 1 de janeiro a 5 de fevereiro cobre seis semanas de calendário; hoje (2 de janeiro) é a primeira.
    expect((await read(harness)).week).toEqual({ current: 1, total: 6 })
    expect((await read(harness)).today).toBe('2026-01-02')
  })

  it('marcos: status pela regra, ordem por data, entrega com subentrega e o próximo marco', async () => {
    const harness = await setup()
    const wbs = (title: string, parentId: string | null = null) =>
      harness.useCases.wbs.createDeliverable.execute(ctx(manager), { projectId, parentId, title })
    await wbs('Fundação')
    let view = await wbs('Relatórios')
    const foundation = deliverableId(view, 'Fundação')
    view = await harness.useCases.wbs.createDeliverable.execute(ctx(manager), {
      projectId,
      parentId: foundation,
      title: 'Infra',
    })
    const infra = deliverableId(view, 'Infra')
    const reports = deliverableId(view, 'Relatórios')
    // A tarefa de Ana vai para a subentrega Infra: o marco da Fundação enxerga pela subárvore.
    await harness.useCases.tasks.setDeliverable.execute(ctx(manager), {
      taskId,
      deliverableId: infra,
    })
    // Relatórios: uma tarefa só, concluída, então o marco fica cumprido.
    const report = await harness.useCases.tasks.create.execute(ctx(manager), {
      projectId,
      title: 'Relatório',
    })
    await harness.useCases.tasks.setDeliverable.execute(ctx(manager), {
      taskId: report.id,
      deliverableId: reports,
    })
    await harness.useCases.tasks.move.execute(ctx(manager), { taskId: report.id, status: 'done' })

    const milestone = (title: string, dueOn: string, deliverableId: string | null) =>
      harness.useCases.milestones.create.execute(ctx(manager), {
        projectId,
        title,
        dueOn,
        deliverableId,
        criterion: null,
      })
    await milestone('Sem entrega passado', '2025-12-01', null)
    await milestone('Fundação pronta', '2025-12-20', foundation)
    await milestone('Relatórios entregues', '2026-01-20', reports)
    await milestone('Sem entrega futuro', '2026-02-15', null)

    const tracking = await read(harness)
    expect(tracking.milestones.map((item) => [item.title, item.status])).toEqual([
      ['Sem entrega passado', 'at_risk'],
      ['Fundação pronta', 'at_risk'],
      ['Relatórios entregues', 'done'],
      ['Sem entrega futuro', 'on_track'],
    ])
    expect(tracking.milestones[1]).toMatchObject({ deliverableTitle: 'Fundação' })
    expect(tracking.milestones[0]).toMatchObject({ deliverableTitle: null, criterion: null })
    expect(tracking.nextMilestone).toEqual({
      id: tracking.milestones[3]!.id,
      title: 'Sem entrega futuro',
      dueOn: '2026-02-15',
      daysLeft: 44,
      status: 'on_track',
    })

    // Concluir a única tarefa da subentrega Infra põe a Fundação em cumprido, mesmo com a data passada.
    await harness.useCases.tasks.move.execute(ctx(manager), { taskId, status: 'done' })
    expect((await read(harness)).milestones[1]?.status).toBe('done')
  })

  it('sem o módulo wbs a entrega do marco não aparece; sem o módulo milestones não há marcos', async () => {
    const harness = await setup()
    const view = await harness.useCases.wbs.createDeliverable.execute(ctx(manager), {
      projectId,
      parentId: null,
      title: 'Fundação',
    })
    await harness.useCases.milestones.create.execute(ctx(manager), {
      projectId,
      title: 'Marco',
      dueOn: '2026-03-01',
      deliverableId: deliverableId(view, 'Fundação'),
      criterion: 'Entregue',
    })
    expect((await read(harness)).milestones[0]).toMatchObject({
      deliverableTitle: 'Fundação',
      criterion: 'Entregue',
    })

    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, { wbs: 'disabled' })
    expect((await read(harness)).milestones[0]?.deliverableTitle).toBeNull()

    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      milestones: 'disabled',
    })
    expect(await read(harness)).toMatchObject({ milestones: [], nextMilestone: null })
  })
})
