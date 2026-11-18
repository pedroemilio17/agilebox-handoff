import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
  toDeliverableId,
  toProjectId,
} from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { TimelineEventDto } from '@agilebox/contract'
import {
  ana,
  carla,
  createTaskHarness,
  ctx,
  manager,
  orgA,
  otherManager,
  projectId,
  seedTaskHarness,
  setProjectModules,
  taskId,
} from '../../testing/task-harness'

const WBS_MODULES: readonly ModuleId[] = ['wbs', 'milestones', 'estimates.hours']

async function setup(options: { readonly archived?: boolean } = {}) {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, {
    projectModules: WBS_MODULES,
    archived: options.archived ?? false,
  })
  return harness
}

async function deliverableIn(
  useCases: Awaited<ReturnType<typeof setup>>['useCases'],
  project: string,
  title: string,
): Promise<string> {
  const view = await useCases.wbs.createDeliverable.execute(ctx(manager), {
    projectId: project,
    parentId: null,
    title,
  })
  const row = view.deliverables.find((item) => item.kind === 'deliverable' && item.title === title)
  if (!row || row.kind !== 'deliverable') throw new Error('entrega não criada')
  return row.id
}

async function timelineOf(
  useCases: Awaited<ReturnType<typeof setup>>['useCases'],
  actor = ana,
): Promise<TimelineEventDto[]> {
  const events = await useCases.timeline.list.execute(ctx(actor), { taskId })
  return [...events]
}

/** O evento de entrega mais recente: a linha do tempo vem do mais novo para o mais antigo. */
function lastDeliverableEvent(events: readonly TimelineEventDto[]): TimelineEventDto | undefined {
  return events.find((event) => event.type === 'deliverable_changed')
}

describe('tasks.setDeliverable: ligar e desligar a tarefa', () => {
  it('quem edita a tarefa liga à entrega do mesmo projeto; a linha do tempo mostra o nome', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    const dto = await useCases.tasks.setDeliverable.execute(ctx(ana), {
      taskId,
      deliverableId: infra,
    })
    expect(dto.deliverableId).toBe(infra)
    const last = lastDeliverableEvent(await timelineOf(useCases))
    expect(last).toMatchObject({
      type: 'deliverable_changed',
      asManager: false,
      text: 'ligou a tarefa à entrega "Infra"',
    })
  })

  it('o gestor que muda a entrega marca a linha do tempo como Gestor', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    const banco = await deliverableIn(useCases, projectId, 'Banco')
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra })
    await useCases.tasks.setDeliverable.execute(ctx(manager), { taskId, deliverableId: banco })
    const last = lastDeliverableEvent(await timelineOf(useCases, manager))
    expect(last).toMatchObject({
      type: 'deliverable_changed',
      asManager: true,
      text: 'mudou a tarefa da entrega "Infra" para "Banco"',
    })
  })

  it('desligar registra o evento com o nome que saiu, e não conta como ligar', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra })
    const dto = await useCases.tasks.setDeliverable.execute(ctx(ana), {
      taskId,
      deliverableId: null,
    })
    expect(dto.deliverableId).toBeNull()
    const last = lastDeliverableEvent(await timelineOf(useCases))
    expect(last).toMatchObject({
      type: 'deliverable_changed',
      text: 'removeu a tarefa da entrega "Infra"',
    })
  })

  it('o mesmo vínculo de novo não gera linha do tempo', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra })
    const before = (await timelineOf(useCases)).length
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra })
    expect((await timelineOf(useCases)).length).toBe(before)
  })

  it('colaboradora que não participa da tarefa não liga', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(carla), { taskId, deliverableId: infra }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('tarefa arquivada não muda de entrega, e a recusa vem como conflito', async () => {
    const { useCases } = await setup({ archived: true })
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('entrega de outro projeto é recusada com VALIDAÇÃO; id inexistente vira NotFound', async () => {
    const { useCases } = await setup()
    const outro = await useCases.projects.createProject.execute(ctx(manager), { name: 'Outro' })
    await useCases.projectModules.change.execute(ctx(manager), {
      projectId: toProjectId(outro.id),
      enable: ['wbs'],
    })
    const alheia = await deliverableIn(useCases, outro.id, 'Alheia')
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: alheia }),
    ).rejects.toThrow(new ValidationError('A entrega é de outro projeto'))
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(ana), {
        taskId,
        deliverableId: toDeliverableId('00000000000000000000000099'),
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('projeto arquivado recusa; módulo da EAP desligado no projeto também', async () => {
    const { useCases, unitOfWork } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, { wbs: 'disabled' })
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, { wbs: 'active' })
    await useCases.projects.archive.execute(ctx(manager), { projectId })
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('outro tenant não encontra a tarefa', async () => {
    const { useCases } = await setup()
    await expect(
      useCases.tasks.setDeliverable.execute(ctx(otherManager), {
        taskId,
        deliverableId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(orgA).toBeDefined()
  })
})
