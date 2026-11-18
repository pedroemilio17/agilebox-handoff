import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
  toProjectId,
  toRiskId,
} from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import {
  NOW,
  ana,
  anaId,
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
import { aProject } from '../../testing/builders'

const RISK_MODULES: readonly ModuleId[] = ['risks', 'wbs']
const otherProjectId = toProjectId('00000000000000000000000030')

async function setup(modules: readonly ModuleId[] = RISK_MODULES) {
  const harness = createTaskHarness(manager)
  await seedTaskHarness(harness.unitOfWork, { projectModules: modules })
  return harness
}

type Harness = Awaited<ReturnType<typeof setup>>

type CreateRiskArgs = Parameters<
  ReturnType<typeof createTaskHarness>['useCases']['risks']['create']['execute']
>[1]

/** Entrada de criar risco, com valores padrão que o teste sobrescreve. */
function riskInput(overrides: Partial<CreateRiskArgs> = {}): CreateRiskArgs {
  return {
    projectId,
    title: 'Fornecedor atrasa',
    description: null,
    probability: 2,
    impact: 2,
    response: null,
    ownerId: null,
    deliverableId: null,
    ...overrides,
  }
}

async function createRisk(harness: Harness, overrides: Partial<CreateRiskArgs> = {}) {
  return harness.useCases.risks.create.execute(ctx(manager), riskInput(overrides))
}

async function addMember(harness: Harness, userId: typeof anaId) {
  await harness.unitOfWork.repositories.projects.addMember(orgA, {
    projectId,
    userId,
    addedBy: managerId,
    addedAt: NOW,
  })
}

describe('riscos: criar, listar e ordenar', () => {
  it('gestor cria risco aberto e a lista ordena por pontuação, da maior para a menor', async () => {
    const harness = await setup()
    await createRisk(harness, { title: 'Baixo', probability: 1, impact: 1 })
    const created = await createRisk(harness, { title: 'Alto', probability: 3, impact: 3 })
    await createRisk(harness, { title: 'Médio', probability: 2, impact: 2 })

    expect(created).toMatchObject({
      title: 'Alto',
      status: 'open',
      ownerName: null,
      updatedAt: NOW,
    })
    const list = await harness.useCases.risks.list.execute(ctx(manager), { projectId })
    expect(list.canEdit).toBe(true)
    expect(list.risks.map((risk) => risk.title)).toEqual(['Alto', 'Médio', 'Baixo'])
  })

  it('dono precisa ser membro do projeto e aparece com o nome', async () => {
    const harness = await setup()
    await expect(createRisk(harness, { ownerId: anaId })).rejects.toThrow(ValidationError)

    await addMember(harness, anaId)
    const created = await createRisk(harness, { ownerId: anaId })
    expect(created).toMatchObject({ ownerId: anaId, ownerName: 'Ana' })
    const list = await harness.useCases.risks.list.execute(ctx(manager), { projectId })
    expect(list.risks[0]).toMatchObject({ ownerName: 'Ana' })
  })

  it('recusa título vazio e probabilidade fora da escala', async () => {
    const harness = await setup()
    await expect(createRisk(harness, { title: '   ' })).rejects.toThrow(ValidationError)
    await expect(createRisk(harness, { probability: 4 })).rejects.toThrow(ValidationError)
  })
})

describe('riscos: entrega (EAP)', () => {
  it('liga o risco a uma entrega do projeto e mostra o título na lista', async () => {
    const harness = await setup()
    const deliverable = await harness.useCases.wbs.createDeliverable.execute(ctx(manager), {
      projectId,
      parentId: null,
      title: 'Infra',
    })
    const row = deliverable.deliverables.find((item) => item.kind === 'deliverable')
    if (!row || row.kind !== 'deliverable') throw new Error('entrega não criada')
    await createRisk(harness, { deliverableId: row.id })

    const list = await harness.useCases.risks.list.execute(ctx(manager), { projectId })
    expect(list.risks[0]).toMatchObject({ deliverableId: row.id, deliverableTitle: 'Infra' })
  })

  it('sem a EAP ligada, a entrega não pode ser associada e a lista não mostra o título', async () => {
    const harness = await setup(['risks'])
    await expect(
      createRisk(harness, { deliverableId: '00000000000000000000000040' }),
    ).rejects.toThrow(ValidationError)
    const list = await harness.useCases.risks.list.execute(ctx(manager), { projectId })
    expect(list.risks).toEqual([])
  })

  it('entrega de outro projeto é recusada', async () => {
    const harness = await setup()
    await harness.unitOfWork.repositories.projects.save(
      orgA,
      aProject()
        .with({ id: otherProjectId, organizationId: orgA, createdBy: managerId, name: 'Outro' })
        .build(),
    )
    await setProjectModules(harness.unitOfWork, orgA, otherProjectId, managerId, { wbs: 'active' })
    const other = await harness.useCases.wbs.createDeliverable.execute(ctx(manager), {
      projectId: otherProjectId,
      parentId: null,
      title: 'Outra entrega',
    })
    const row = other.deliverables.find((item) => item.kind === 'deliverable')
    if (!row || row.kind !== 'deliverable') throw new Error('entrega não criada')
    await expect(createRisk(harness, { deliverableId: row.id })).rejects.toThrow(ValidationError)
  })
})

describe('riscos: editar e remover', () => {
  it('campo ausente não muda, nulo desliga o dono e a situação muda', async () => {
    const harness = await setup()
    await addMember(harness, anaId)
    const created = await createRisk(harness, { ownerId: anaId, response: 'Trocar fornecedor' })

    const updated = await harness.useCases.risks.update.execute(ctx(manager), {
      riskId: created.id,
      impact: 3,
    })
    expect(updated).toMatchObject({ impact: 3, response: 'Trocar fornecedor', ownerId: anaId })

    const closed = await harness.useCases.risks.update.execute(ctx(manager), {
      riskId: created.id,
      ownerId: null,
      status: 'mitigated',
    })
    expect(closed).toMatchObject({ ownerId: null, ownerName: null, status: 'mitigated' })
  })

  it('situação desconhecida é recusada', async () => {
    const harness = await setup()
    const created = await createRisk(harness)
    await expect(
      harness.useCases.risks.update.execute(ctx(manager), {
        riskId: created.id,
        status: 'arquivado',
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('remove o risco; editar ou remover um risco que não existe responde não encontrado', async () => {
    const harness = await setup()
    const created = await createRisk(harness)
    await harness.useCases.risks.remove.execute(ctx(manager), { riskId: created.id })
    const list = await harness.useCases.risks.list.execute(ctx(manager), { projectId })
    expect(list.risks).toEqual([])
    const missing = toRiskId('00000000000000000000000050')
    await expect(
      harness.useCases.risks.update.execute(ctx(manager), { riskId: missing, impact: 1 }),
    ).rejects.toThrow(NotFoundError)
    await expect(
      harness.useCases.risks.remove.execute(ctx(manager), { riskId: missing }),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('riscos: permissões', () => {
  it('colaborador que não é gestor nem criador não cria nem edita; sem ser membro não lê', async () => {
    const harness = await setup()
    const created = await createRisk(harness)
    await expect(harness.useCases.risks.create.execute(ctx(ana), riskInput())).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      harness.useCases.risks.update.execute(ctx(ana), { riskId: created.id, impact: 1 }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      harness.useCases.risks.remove.execute(ctx(ana), { riskId: created.id }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(harness.useCases.risks.list.execute(ctx(ana), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
  })

  it('membro lê a lista, mas canEdit fica falso', async () => {
    const harness = await setup()
    await createRisk(harness)
    await addMember(harness, anaId)
    const list = await harness.useCases.risks.list.execute(ctx(ana), { projectId })
    expect(list.canEdit).toBe(false)
    expect(list.risks).toHaveLength(1)
  })

  it('gestor de outra organização não acha o projeto', async () => {
    const harness = await setup()
    await expect(
      harness.useCases.risks.create.execute(ctx(otherManager), riskInput()),
    ).rejects.toThrow(NotFoundError)
  })

  it('projeto arquivado recusa criar e editar, e a lista mostra canEdit falso', async () => {
    const harness = await setup()
    const created = await createRisk(harness)
    const project = await harness.unitOfWork.repositories.projects.findById(orgA, projectId)
    if (!project) throw new Error('projeto não encontrado')
    await harness.unitOfWork.repositories.projects.save(orgA, {
      ...project,
      archivedAt: NOW,
      archivedBy: managerId,
    })
    await expect(createRisk(harness)).rejects.toThrow(ConflictError)
    await expect(
      harness.useCases.risks.update.execute(ctx(manager), { riskId: created.id, impact: 1 }),
    ).rejects.toThrow(ConflictError)
    const list = await harness.useCases.risks.list.execute(ctx(manager), { projectId })
    expect(list.canEdit).toBe(false)
  })
})

describe('riscos: módulo do projeto (guard)', () => {
  it('com o módulo desligado no projeto, o caso de uso é recusado', async () => {
    const harness = await setup(['wbs'])
    await expect(createRisk(harness)).rejects.toThrow(PermissionDeniedError)
    await expect(harness.useCases.risks.list.execute(ctx(manager), { projectId })).rejects.toThrow(
      PermissionDeniedError,
    )
  })

  it('encerrando, não aceita risco novo, mas edita e remove o que já existe', async () => {
    const harness = await setup()
    const created = await createRisk(harness)
    await setProjectModules(harness.unitOfWork, orgA, projectId, managerId, {
      risks: 'winding_down',
    })
    await expect(createRisk(harness)).rejects.toThrow(ConflictError)
    await expect(
      harness.useCases.risks.update.execute(ctx(manager), { riskId: created.id, impact: 1 }),
    ).resolves.toMatchObject({ impact: 1 })
    await harness.useCases.risks.remove.execute(ctx(manager), { riskId: created.id })
  })
})
