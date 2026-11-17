import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
  toMilestoneId,
  toProjectId,
} from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { WbsViewDto } from '@agilebox/contract'
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
} from '../../testing/task-harness'

const WBS_MODULES: readonly ModuleId[] = ['wbs', 'milestones', 'estimates.hours']

async function setup() {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, { projectModules: WBS_MODULES })
  return harness
}

type UseCases = Awaited<ReturnType<typeof setup>>['useCases']

async function deliverableIn(useCases: UseCases, project: string, title: string): Promise<string> {
  const view = await useCases.wbs.createDeliverable.execute(ctx(manager), {
    projectId: project,
    parentId: null,
    title,
  })
  const row = view.deliverables.find((item) => item.kind === 'deliverable' && item.title === title)
  if (!row || row.kind !== 'deliverable') throw new Error('entrega não criada')
  return row.id
}

function milestonesOf(view: WbsViewDto) {
  return view.milestones.map((item) => ({
    title: item.title,
    dueOn: item.dueOn,
    deliverableId: item.deliverableId,
  }))
}

const base = { projectId, deliverableId: null, criterion: null }

describe('marcos: criar, editar e remover', () => {
  it('gestor cria marco com data e critério; a EAP lista ordenado pela data', async () => {
    const { useCases } = await setup()
    const later = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Homologação',
      dueOn: '2026-09-01',
      criterion: 'Aprovada pelo cliente',
    })
    expect(later).toMatchObject({
      title: 'Homologação',
      dueOn: '2026-09-01',
      criterion: 'Aprovada pelo cliente',
    })
    await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Piloto',
      dueOn: '2026-06-01',
    })
    const view = await useCases.wbs.get.execute(ctx(manager), { projectId })
    expect(milestonesOf(view).map((item) => item.title)).toEqual(['Piloto', 'Homologação'])
  })

  it('marco ligado a uma entrega do projeto aparece nela, com o título e a data', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Infra pronta',
      dueOn: '2026-07-15',
      deliverableId: infra,
    })
    const view = await useCases.wbs.get.execute(ctx(manager), { projectId })
    const row = view.deliverables.find((item) => item.kind === 'deliverable' && item.id === infra)
    const milestones = row && row.kind === 'deliverable' ? row.totals.milestones : []
    expect(milestones.map((item) => ({ title: item.title, dueOn: item.dueOn }))).toEqual([
      { title: 'Infra pronta', dueOn: '2026-07-15' },
    ])
  })

  it('edita campos; entrega nula desliga; campo ausente não muda', async () => {
    const { useCases } = await setup()
    const infra = await deliverableIn(useCases, projectId, 'Infra')
    const created = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Marco',
      dueOn: '2026-07-01',
      deliverableId: infra,
      criterion: 'Critério',
    })
    const moved = await useCases.milestones.update.execute(ctx(manager), {
      milestoneId: created.id,
      dueOn: '2026-08-01',
    })
    expect(moved).toMatchObject({
      title: 'Marco',
      dueOn: '2026-08-01',
      deliverableId: infra,
      criterion: 'Critério',
    })
    const unlinked = await useCases.milestones.update.execute(ctx(manager), {
      milestoneId: created.id,
      deliverableId: null,
      criterion: null,
    })
    expect(unlinked).toMatchObject({ deliverableId: null, criterion: null, dueOn: '2026-08-01' })
  })

  it('remove o marco da EAP', async () => {
    const { useCases } = await setup()
    const created = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Descartável',
      dueOn: '2026-07-01',
    })
    await useCases.milestones.remove.execute(ctx(manager), { milestoneId: created.id })
    const view = await useCases.wbs.get.execute(ctx(manager), { projectId })
    expect(view.milestones).toEqual([])
  })

  it('valida título, data, critério e entrega: vazio, data inválida, texto longo e entrega de outro projeto', async () => {
    const { useCases } = await setup()
    await expect(
      useCases.milestones.create.execute(ctx(manager), {
        ...base,
        title: '  ',
        dueOn: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.milestones.create.execute(ctx(manager), {
        ...base,
        title: 'X',
        dueOn: '31/07/2026',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.milestones.create.execute(ctx(manager), {
        ...base,
        title: 'X',
        dueOn: '2026-07-01',
        criterion: 'a'.repeat(281),
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    const outro = await useCases.projects.createProject.execute(ctx(manager), { name: 'Outro' })
    await useCases.projectModules.change.execute(ctx(manager), {
      projectId: toProjectId(outro.id),
      enable: ['wbs', 'milestones'],
    })
    const alheia = await deliverableIn(useCases, outro.id, 'Alheia')
    await expect(
      useCases.milestones.create.execute(ctx(manager), {
        ...base,
        title: 'X',
        dueOn: '2026-07-01',
        deliverableId: alheia,
      }),
    ).rejects.toThrow(new ValidationError('A entrega do marco é de outro projeto'))
  })

  it('id de marco inexistente é NotFound, na edição e na remoção', async () => {
    const { useCases } = await setup()
    const missing = toMilestoneId('00000000000000000000000077')
    await expect(
      useCases.milestones.update.execute(ctx(manager), { milestoneId: missing, title: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      useCases.milestones.remove.execute(ctx(manager), { milestoneId: missing }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('marcos: quem pode e quando', () => {
  it('colaboradores que não criaram o projeto não criam, editam nem removem marcos', async () => {
    const { useCases } = await setup()
    const created = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Marco',
      dueOn: '2026-07-01',
    })
    await expect(
      useCases.milestones.create.execute(ctx(ana), { ...base, title: 'X', dueOn: '2026-07-01' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.milestones.update.execute(ctx(carla), { milestoneId: created.id, title: 'X' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.milestones.remove.execute(ctx(ana), { milestoneId: created.id }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('projeto arquivado recusa criar, editar e remover', async () => {
    const { useCases } = await setup()
    const created = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Marco',
      dueOn: '2026-07-01',
    })
    await useCases.projects.archive.execute(ctx(manager), { projectId })
    await expect(
      useCases.milestones.create.execute(ctx(manager), {
        ...base,
        title: 'X',
        dueOn: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(ConflictError)
    await expect(
      useCases.milestones.update.execute(ctx(manager), { milestoneId: created.id, title: 'X' }),
    ).rejects.toBeInstanceOf(ConflictError)
    await expect(
      useCases.milestones.remove.execute(ctx(manager), { milestoneId: created.id }),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('módulo de marcos desligado recusa; encerrando, não cria mas edita', async () => {
    const { useCases, unitOfWork } = await setup()
    const created = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Marco',
      dueOn: '2026-07-01',
    })
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, {
      milestones: 'winding_down',
    })
    await expect(
      useCases.milestones.create.execute(ctx(manager), {
        ...base,
        title: 'X',
        dueOn: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(ConflictError)
    await expect(
      useCases.milestones.update.execute(ctx(manager), {
        milestoneId: created.id,
        title: 'Editado',
      }),
    ).resolves.toMatchObject({ title: 'Editado' })
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, { milestones: 'disabled' })
    await expect(
      useCases.milestones.update.execute(ctx(manager), { milestoneId: created.id, title: 'X' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('outro tenant não edita marco de outra organização', async () => {
    const { useCases } = await setup()
    const created = await useCases.milestones.create.execute(ctx(manager), {
      ...base,
      title: 'Marco',
      dueOn: '2026-07-01',
    })
    await expect(
      useCases.milestones.update.execute(ctx(otherManager), {
        milestoneId: created.id,
        title: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
