import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
  toProjectId,
} from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import type { WbsRowDto, WbsViewDto } from '@agilebox/contract'
import {
  ana,
  bia,
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

/** Módulos ligados no projeto da fixture: a EAP, os marcos e a estimativa (para o custo e o progresso). */
const WBS_MODULES: readonly ModuleId[] = ['wbs', 'milestones', 'estimates.hours']

async function setup(options: { readonly archived?: boolean } = {}) {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, {
    projectModules: WBS_MODULES,
    estimatedHoursHundredths: 400,
    archived: options.archived ?? false,
  })
  return harness
}

type Harness = Awaited<ReturnType<typeof setup>>
type UseCases = Harness['useCases']

async function createRoot(useCases: UseCases, title: string, actor = manager) {
  return useCases.wbs.createDeliverable.execute(ctx(actor), {
    projectId,
    parentId: null,
    title,
  })
}

/** Id da entrega pelo título, na última visão. */
function idOf(view: WbsViewDto, title: string): string {
  const row = view.deliverables.find(
    (item): item is Extract<WbsRowDto, { kind: 'deliverable' }> =>
      item.kind === 'deliverable' && item.title === title,
  )
  if (!row) throw new Error(`entrega "${title}" não está na visão`)
  return row.id
}

function codesOf(view: WbsViewDto): string[] {
  return view.deliverables.flatMap((row) =>
    row.kind === 'deliverable' ? [`${row.code} ${row.title}`] : [],
  )
}

/** Um projeto só do gestor, com entregas Fundação > Infra > Banco e Relatórios. */
async function seedTree(useCases: UseCases) {
  let view = await createRoot(useCases, 'Fundação')
  const fundacao = idOf(view, 'Fundação')
  view = await useCases.wbs.createDeliverable.execute(ctx(manager), {
    projectId,
    parentId: fundacao,
    title: 'Infra',
  })
  const infra = idOf(view, 'Infra')
  await useCases.wbs.createDeliverable.execute(ctx(manager), {
    projectId,
    parentId: infra,
    title: 'Banco',
  })
  view = await createRoot(useCases, 'Relatórios')
  return { view, fundacao, infra, banco: idOf(view, 'Banco'), relatorios: idOf(view, 'Relatórios') }
}

describe('EAP: criar, renomear, mover e remover', () => {
  it('cria entrega raiz no fim e filha no fim dos irmãos, com código e nível da árvore', async () => {
    const { useCases } = await setup()
    const { view } = await seedTree(useCases)
    expect(codesOf(view)).toEqual(['1 Fundação', '1.1 Infra', '1.1.1 Banco', '2 Relatórios'])
    const levels = view.deliverables.flatMap((row) =>
      row.kind === 'deliverable' ? [row.level] : [],
    )
    expect(levels).toEqual([1, 2, 3, 1])
  })

  it('recusa o quarto nível com a mensagem da EAP', async () => {
    const { useCases } = await setup()
    const { banco } = await seedTree(useCases)
    await expect(
      useCases.wbs.createDeliverable.execute(ctx(manager), {
        projectId,
        parentId: banco,
        title: 'Muito fundo',
      }),
    ).rejects.toThrow('A EAP aceita até 3 níveis')
  })

  it('recusa pai de outro projeto, com mensagem clara', async () => {
    const { useCases } = await setup()
    const outro = await useCases.projects.createProject.execute(ctx(manager), { name: 'Outro' })
    // Projeto novo nasce só com o núcleo: a EAP precisa ser ligada nele.
    await useCases.projectModules.change.execute(ctx(manager), {
      projectId: toProjectId(outro.id),
      enable: ['wbs'],
    })
    const outroView = await useCases.wbs.createDeliverable.execute(ctx(manager), {
      projectId: outro.id,
      parentId: null,
      title: 'Do outro',
    })
    await expect(
      useCases.wbs.createDeliverable.execute(ctx(manager), {
        projectId,
        parentId: idOf(outroView, 'Do outro'),
        title: 'Filha de outro',
      }),
    ).rejects.toThrow(new ValidationError('A entrega pai é de outro projeto'))
  })

  it('título vazio é recusado e o nome sem espaço das bordas é gravado', async () => {
    const { useCases } = await setup()
    await expect(createRoot(useCases, '   ')).rejects.toBeInstanceOf(ValidationError)
    const view = await createRoot(useCases, '  Fundação  ')
    expect(codesOf(view)).toEqual(['1 Fundação'])
  })

  it('renomeia a entrega', async () => {
    const { useCases } = await setup()
    const { fundacao } = await seedTree(useCases)
    const view = await useCases.wbs.renameDeliverable.execute(ctx(manager), {
      deliverableId: fundacao,
      title: 'Base',
    })
    expect(codesOf(view)[0]).toBe('1 Base')
  })

  it('move a entrega para outro pai na posição pedida e reencaixa os irmãos', async () => {
    const { useCases } = await setup()
    const { relatorios, fundacao } = await seedTree(useCases)
    // Relatórios (raiz 2) vira filha de Fundação na posição 0: Infra passa para a posição 1.
    const view = await useCases.wbs.moveDeliverable.execute(ctx(manager), {
      deliverableId: relatorios,
      parentId: fundacao,
      position: 0,
    })
    expect(codesOf(view)).toEqual(['1 Fundação', '1.1 Relatórios', '1.2 Infra', '1.2.1 Banco'])
  })

  it('não move a entrega para dentro dela mesma, nem passa de três níveis com a subárvore', async () => {
    const { useCases } = await setup()
    const { fundacao, infra, banco, relatorios } = await seedTree(useCases)
    // Fundação dentro do próprio Banco: laço.
    await expect(
      useCases.wbs.moveDeliverable.execute(ctx(manager), {
        deliverableId: fundacao,
        parentId: banco,
        position: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    // Infra (com Banco embaixo, dois níveis) cabe como filha de Relatórios (nível 1): níveis 2 e 3.
    await expect(
      useCases.wbs.moveDeliverable.execute(ctx(manager), {
        deliverableId: infra,
        parentId: relatorios,
        position: 0,
      }),
    ).resolves.toBeDefined()
    // Agora Relatórios tem três níveis embaixo dela: não cabe dentro de Banco (nível 3).
    await expect(
      useCases.wbs.moveDeliverable.execute(ctx(manager), {
        deliverableId: relatorios,
        parentId: banco,
        position: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('remove entrega vazia; com subentrega, tarefa ou marco ligados, recusa com a mensagem do motivo', async () => {
    const { useCases } = await setup()
    const { infra, banco, relatorios, fundacao } = await seedTree(useCases)

    await expect(
      useCases.wbs.removeDeliverable.execute(ctx(manager), { deliverableId: fundacao }),
    ).rejects.toThrow(new ConflictError('Esta entrega tem subentregas. Mova ou remova-as antes.'))

    // Tarefa de ana ligada ao Banco.
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: banco })
    await expect(
      useCases.wbs.removeDeliverable.execute(ctx(manager), { deliverableId: banco }),
    ).rejects.toThrow('Há tarefas ligadas a esta entrega. Desligue-as antes de remover.')
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: null })

    // Marco ligado a Relatórios.
    await useCases.milestones.create.execute(ctx(manager), {
      projectId,
      title: 'Entrega final',
      dueOn: '2026-12-01',
      deliverableId: relatorios,
      criterion: null,
    })
    await expect(
      useCases.wbs.removeDeliverable.execute(ctx(manager), { deliverableId: relatorios }),
    ).rejects.toThrow('Há marcos ligados a esta entrega. Desligue-os antes de remover.')

    // Sem nada ligado, remove de verdade (a folha Banco, depois Infra).
    await useCases.wbs.removeDeliverable.execute(ctx(manager), { deliverableId: banco })
    const view = await useCases.wbs.removeDeliverable.execute(ctx(manager), {
      deliverableId: infra,
    })
    expect(codesOf(view)).toEqual(['1 Fundação', '2 Relatórios'])
  })
})

describe('EAP: quem edita a estrutura', () => {
  it('colaboradores que não criaram o projeto não criam, renomeiam, movem nem removem', async () => {
    const { useCases } = await setup()
    const { fundacao, relatorios } = await seedTree(useCases)
    await expect(createRoot(useCases, 'Nova', ana)).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.wbs.renameDeliverable.execute(ctx(carla), { deliverableId: fundacao, title: 'X' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.wbs.moveDeliverable.execute(ctx(ana), {
        deliverableId: relatorios,
        parentId: fundacao,
        position: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.wbs.removeDeliverable.execute(ctx(bia), { deliverableId: relatorios }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('quem criou o projeto (sem ser gestor) edita a EAP, com o módulo ligado pelo gestor', async () => {
    const { useCases } = await setup()
    const created = await useCases.projects.createProject.execute(ctx(ana), { name: 'Da Ana' })
    const anaProject = toProjectId(created.id)
    await useCases.projectModules.change.execute(ctx(manager), {
      projectId: anaProject,
      enable: ['wbs'],
    })
    const view = await useCases.wbs.createDeliverable.execute(ctx(ana), {
      projectId: anaProject,
      parentId: null,
      title: 'Entrega da Ana',
    })
    expect(codesOf(view)).toEqual(['1 Entrega da Ana'])
    expect(view.canEdit).toBe(true)
  })

  it('projeto arquivado recusa escrita e a leitura continua', async () => {
    const { useCases } = await setup()
    const { fundacao } = await seedTree(useCases)
    await useCases.projects.archive.execute(ctx(manager), { projectId })
    await expect(createRoot(useCases, 'Depois')).rejects.toBeInstanceOf(ConflictError)
    await expect(
      useCases.wbs.renameDeliverable.execute(ctx(manager), { deliverableId: fundacao, title: 'X' }),
    ).rejects.toBeInstanceOf(ConflictError)
    await expect(
      useCases.wbs.removeDeliverable.execute(ctx(manager), { deliverableId: fundacao }),
    ).rejects.toBeInstanceOf(ConflictError)
    const view = await useCases.wbs.get.execute(ctx(manager), { projectId })
    expect(view.canEdit).toBe(false)
    expect(view.deliverables.length).toBeGreaterThan(0)
  })

  it('módulo da EAP desligado no projeto: criar e ler são recusados', async () => {
    const { useCases, unitOfWork } = await setup()
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, { wbs: 'disabled' })
    await expect(createRoot(useCases, 'Fundação')).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(useCases.wbs.get.execute(ctx(manager), { projectId })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    )
  })

  it('encerrando (winding_down): não cria entrega, mas renomeia e remove', async () => {
    const { useCases, unitOfWork } = await setup()
    const { fundacao, relatorios } = await seedTree(useCases)
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, { wbs: 'winding_down' })
    await expect(createRoot(useCases, 'Nova')).rejects.toBeInstanceOf(ConflictError)
    await expect(
      useCases.wbs.renameDeliverable.execute(ctx(manager), {
        deliverableId: fundacao,
        title: 'Base',
      }),
    ).resolves.toBeDefined()
    await expect(
      useCases.wbs.removeDeliverable.execute(ctx(manager), { deliverableId: relatorios }),
    ).resolves.toBeDefined()
  })

  it('outro tenant não enxerga nem altera a EAP: o projeto não existe para ele', async () => {
    const { useCases } = await setup()
    const { fundacao } = await seedTree(useCases)
    await expect(useCases.wbs.get.execute(ctx(otherManager), { projectId })).rejects.toBeInstanceOf(
      NotFoundError,
    )
    await expect(
      useCases.wbs.createDeliverable.execute(ctx(otherManager), {
        projectId,
        parentId: null,
        title: 'Invasora',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      useCases.wbs.renameDeliverable.execute(ctx(otherManager), {
        deliverableId: fundacao,
        title: 'Invasora',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('a EAP publica a mudança do projeto no notificador', async () => {
    const { useCases, notifier } = await setup()
    await createRoot(useCases, 'Fundação')
    expect(notifier.changes.at(-1)?.change).toEqual({ kind: 'project', ids: [projectId] })
  })
})

describe('EAP: leitura consolidada', () => {
  it('quem não participa do projeto não lê a EAP; quem é membro lê, sem valor se não for gestor', async () => {
    const { useCases } = await setup()
    await seedTree(useCases)
    await expect(useCases.wbs.get.execute(ctx(carla), { projectId })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    )
    await useCases.projects.addMember.execute(ctx(manager), { projectId, userId: ana.userId })
    const asMember = await useCases.wbs.get.execute(ctx(ana), { projectId })
    expect(asMember.summary.cost).toBeNull()
    expect(
      asMember.deliverables.every((row) => row.kind !== 'deliverable' || row.totals.cost === null),
    ).toBe(true)
    expect(asMember.canEdit).toBe(false)
  })

  it('o gestor vê os custos; horas e progresso vêm para todos que veem o projeto', async () => {
    const { useCases } = await setup()
    const { fundacao } = await seedTree(useCases)
    await useCases.projects.addMember.execute(ctx(manager), { projectId, userId: ana.userId })
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: fundacao })
    const asManager = await useCases.wbs.get.execute(ctx(manager), { projectId })
    const root = asManager.deliverables.find(
      (row): row is Extract<WbsRowDto, { kind: 'deliverable' }> =>
        row.kind === 'deliverable' && row.id === fundacao,
    )
    expect(root?.totals).toMatchObject({ hours: 4, progress: 0, tasks: 1 })
    expect(root?.totals.cost).toBe(60)
    expect(asManager.summary).toMatchObject({ tasks: 1, hours: 4, cost: 60 })
    expect(asManager.canEdit).toBe(true)

    const asAna = await useCases.wbs.get.execute(ctx(ana), { projectId })
    const rootForAna = asAna.deliverables.find(
      (row): row is Extract<WbsRowDto, { kind: 'deliverable' }> =>
        row.kind === 'deliverable' && row.id === fundacao,
    )
    expect(rootForAna?.totals.hours).toBe(4)
    expect(rootForAna?.totals.cost).toBeNull()
  })

  it('tarefa sem entrega entra no resumo do projeto, e tarefa arquivada fica de fora', async () => {
    const { useCases } = await setup()
    await seedTree(useCases)
    const view = await useCases.wbs.get.execute(ctx(manager), { projectId })
    expect(view.tasksWithoutDeliverable).toBe(1)
    expect(view.summary.tasks).toBe(1)
    expect(view.deliverables.some((row) => row.kind === 'task')).toBe(false)

    const archived = await setup({ archived: true })
    await seedTree(archived.useCases)
    const onlyArchived = await archived.useCases.wbs.get.execute(ctx(manager), { projectId })
    expect(onlyArchived.tasksWithoutDeliverable).toBe(0)
    expect(onlyArchived.summary.tasks).toBe(0)
  })

  it('tarefa aparece como folha com chave, responsável e estado Concluído', async () => {
    const { useCases } = await setup()
    const { banco } = await seedTree(useCases)
    await useCases.tasks.setDeliverable.execute(ctx(ana), { taskId, deliverableId: banco })
    const view = await useCases.wbs.get.execute(ctx(manager), { projectId })
    const leaf = view.deliverables.find((row) => row.kind === 'task')
    expect(leaf).toMatchObject({
      kind: 'task',
      taskId,
      deliverableId: banco,
      responsibleName: 'Ana',
      estimatedHours: 4,
      done: false,
    })
    expect(leaf && leaf.kind === 'task' ? leaf.key : '').toMatch(/-1$/)
  })
})
