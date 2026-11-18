import { describe, expect, it } from 'vitest'
import { PermissionDeniedError, toDeliverableId, toMilestoneId, toProjectId } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { TenantContext } from '../../tenant-context'
import {
  ana,
  carla,
  createTaskHarness,
  ctx,
  manager,
  orgA,
  projectId,
  seedTaskHarness,
  setProjectModules,
  taskId,
} from '../../testing/task-harness'

const WBS_MODULES: readonly ModuleId[] = ['wbs', 'milestones', 'estimates.hours']

async function setup() {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, { projectModules: WBS_MODULES })
  // Ana participa do projeto: o guia só se lê por membro (e a própria tarefa já é dela).
  await harness.useCases.projects.addMember.execute(ctx(manager), { projectId, userId: ana.userId })
  return harness
}

type Harness = Awaited<ReturnType<typeof setup>>

/** Passos concluídos do guia para quem está no contexto. */
async function doneKeys(harness: Harness, context: TenantContext, project: string = projectId) {
  const view = await harness.useCases.guide.get.execute(context, {
    projectId: toProjectId(project),
  })
  return view.trail.filter((step) => step.done).map((step) => step.key)
}

async function createRoot(harness: Harness, title: string, project: string = projectId) {
  const view = await harness.useCases.wbs.createDeliverable.execute(ctx(manager), {
    projectId: project,
    parentId: null,
    title,
  })
  const row = view.deliverables.find((item) => item.kind === 'deliverable' && item.title === title)
  if (!row || row.kind !== 'deliverable') throw new Error('entrega não criada')
  return row.id
}

describe('guia: a EAP e os marcos concluem os passos (ADR-10)', () => {
  it('criar a primeira entrega conclui "Liste as entregas principais", só para quem criou', async () => {
    const harness = await setup()
    await createRoot(harness, 'Fundação')
    expect(await doneKeys(harness, ctx(manager))).toContain('wbs.deliverables')
    expect(await doneKeys(harness, ctx(ana))).not.toContain('wbs.deliverables')
  })

  it('ligar uma tarefa a uma entrega conclui "Quebre cada entrega em tarefas", só para quem ligou', async () => {
    const harness = await setup()
    const infra = await createRoot(harness, 'Infra')
    expect(await doneKeys(harness, ctx(ana))).not.toContain('wbs.tasks')
    await harness.useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: infra })
    expect(await doneKeys(harness, ctx(ana))).toContain('wbs.tasks')
    expect(await doneKeys(harness, ctx(manager))).not.toContain('wbs.tasks')
  })

  it('desligar a tarefa não conclui o passo', async () => {
    const harness = await setup()
    await harness.useCases.tasks.setDeliverable.execute(ctx(ana), {
      taskId,
      deliverableId: null,
    })
    expect(await doneKeys(harness, ctx(ana))).not.toContain('wbs.tasks')
  })

  it('criar marco conclui "Marque os marcos", só para quem criou', async () => {
    const harness = await setup()
    await harness.useCases.milestones.create.execute(ctx(manager), {
      projectId,
      title: 'Piloto',
      dueOn: '2026-06-01',
      deliverableId: null,
      criterion: null,
    })
    expect(await doneKeys(harness, ctx(manager))).toContain('milestones.create')
    expect(await doneKeys(harness, ctx(ana))).not.toContain('milestones.create')
  })

  it('recusa não conclui passo: criar entrega com módulo desligado não grava progresso', async () => {
    const harness = await setup()
    await setProjectModules(harness.unitOfWork, orgA, projectId, manager.userId, {
      wbs: 'disabled',
    })
    await expect(createRoot(harness, 'Fundação')).rejects.toBeInstanceOf(PermissionDeniedError)
    expect(await doneKeys(harness, ctx(manager))).not.toContain('wbs.deliverables')
  })
})

describe('guard de módulo para entrega e marco (resolvedores por id)', () => {
  it('a entrega resolve o projeto dela: com a EAP desligada só naquele projeto, a outra segue', async () => {
    const harness = await setup()
    const outro = await harness.useCases.projects.createProject.execute(ctx(manager), {
      name: 'Outro',
    })
    await harness.useCases.projectModules.change.execute(ctx(manager), {
      projectId: toProjectId(outro.id),
      enable: ['wbs'],
    })
    const aqui = await createRoot(harness, 'Daqui')
    const deOutro = await createRoot(harness, 'De outro', outro.id)
    await setProjectModules(harness.unitOfWork, orgA, toProjectId(outro.id), manager.userId, {
      wbs: 'disabled',
    })
    await expect(
      harness.useCases.wbs.renameDeliverable.execute(ctx(manager), {
        deliverableId: deOutro,
        title: 'Renomeada',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      harness.useCases.wbs.renameDeliverable.execute(ctx(manager), {
        deliverableId: aqui,
        title: 'Renomeada',
      }),
    ).resolves.toBeDefined()
  })

  it('marco resolve o projeto dele: marcos desligados no projeto recusam a edição', async () => {
    const harness = await setup()
    const created = await harness.useCases.milestones.create.execute(ctx(manager), {
      projectId,
      title: 'Marco',
      dueOn: '2026-06-01',
      deliverableId: null,
      criterion: null,
    })
    await setProjectModules(harness.unitOfWork, orgA, projectId, manager.userId, {
      milestones: 'disabled',
    })
    await expect(
      harness.useCases.milestones.update.execute(ctx(manager), {
        milestoneId: created.id,
        title: 'X',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('id de entrega ou marco inexistente passa pelo guard e recebe NotFound do caso de uso', async () => {
    const harness = await setup()
    await expect(
      harness.useCases.wbs.renameDeliverable.execute(ctx(manager), {
        deliverableId: toDeliverableId('00000000000000000000000055'),
        title: 'X',
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' })
    await expect(
      harness.useCases.milestones.remove.execute(ctx(manager), {
        milestoneId: toMilestoneId('00000000000000000000000055'),
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('a tarefa de quem não participa não liga a entrega, mesmo com a EAP ligada', async () => {
    const harness = await setup()
    const infra = await createRoot(harness, 'Infra')
    await expect(
      harness.useCases.tasks.setDeliverable.execute(ctx(carla), { taskId, deliverableId: infra }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })
})
