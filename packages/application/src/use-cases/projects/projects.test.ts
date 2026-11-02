import { describe, expect, it, vi } from 'vitest'
import {
  createTenantContext,
  createUser,
  toOrganizationId,
  toProjectId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aProject, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const actor: Actor = { userId, organizationId, role: 'collaborator' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const users = [
    aUser().build(),
    aUser().with({ id: otherUserId, name: 'Bia Lima' }).build(),
    createUser({ ...aUser().build(), id: managerId, name: 'Gestor', role: 'manager' }),
  ]
  for (const user of users) void unitOfWork.repositories.users.save(organizationId, user)
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

describe('casos de uso de projetos', () => {
  it('cria projeto, torna criador membro e notifica', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Projeto novo' },
    )
    expect(
      await unitOfWork.repositories.projects.listMembers(organizationId, toProjectId(project.id)),
    ).toEqual([
      {
        projectId: toProjectId(project.id),
        userId,
        addedBy: userId,
        addedAt: '2026-01-02T00:00:00.000Z',
      },
    ])
    expect(notifier.changes[0]?.change).toEqual({ kind: 'project', ids: [project.id] })
  })

  it('devolve projeto existente com o mesmo nome normalizado', async () => {
    const { useCases } = setup()
    const created = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Gestão Ágil' },
    )
    const reused = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: '  gestao agil  ' },
    )
    expect(reused.id).toBe(created.id)
  })

  it('não reaproveita projeto arquivado com o mesmo nome e cria um projeto novo', async () => {
    const { useCases } = setup()
    const archived = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Gestão Ágil' },
    )
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: archived.id,
    })
    const created = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'gestao agil' },
    )
    expect(created.id).not.toBe(archived.id)
    expect(await useCases.projects.listProjects.execute(createTenantContext(actor), actor)).toEqual(
      [expect.objectContaining({ id: created.id })],
    )
  })

  it('rejeita nome de projeto vazio', async () => {
    const { useCases } = setup()
    await expect(
      useCases.projects.createProject.execute(createTenantContext(actor), actor, { name: '  ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('lista apenas projetos de que colaborador é membro e todos para gestor', async () => {
    const { useCases, unitOfWork } = setup()
    const mine = aProject().build()
    const theirs = aProject()
      .with({
        id: toProjectId('00000000000000000000000009'),
        name: 'Outro',
        createdBy: otherUserId,
      })
      .build()
    await unitOfWork.repositories.projects.save(organizationId, mine)
    await unitOfWork.repositories.projects.save(organizationId, theirs)
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: mine.id,
      userId,
      addedBy: userId,
      addedAt: mine.createdAt,
    })
    expect(
      await useCases.projects.listProjects.execute(createTenantContext(actor), actor),
    ).toHaveLength(1)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    expect(
      await useCases.projects.listProjects.execute(createTenantContext(manager), manager),
    ).toHaveLength(2)
  })

  it('permite ao criador adicionar e remover membro, com notificações', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await useCases.projects.addMember.execute(createTenantContext(actor), actor, {
      projectId: project.id,
      userId: otherUserId,
    })
    expect(
      await unitOfWork.repositories.projects.listMembers(organizationId, project.id),
    ).toHaveLength(1)
    await useCases.projects.removeMember.execute(createTenantContext(actor), actor, {
      projectId: project.id,
      userId: otherUserId,
    })
    expect(
      await unitOfWork.repositories.projects.listMembers(organizationId, project.id),
    ).toHaveLength(0)
    expect(notifier.changes).toHaveLength(2)
  })

  it('nega colaborador que não criou o projeto ao gerenciar membros', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await expect(
      useCases.projects.addMember.execute(createTenantContext(actor), actor, {
        projectId: project.id,
        userId: managerId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('permite gestor gerenciar membros e lista de membros usa nomes da organização', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    await useCases.projects.addMember.execute(createTenantContext(manager), manager, {
      projectId: project.id,
      userId,
    })
    await expect(
      useCases.projects.listMembers.execute(createTenantContext(manager), manager, {
        projectId: project.id,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: userId, name: 'Ana Silva' })])
  })

  it('arquivar oculta o projeto da lista, desarquivar devolve, e includeArchived mostra', async () => {
    const { useCases } = setup()
    const project = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Arquivável' },
    )
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: project.id,
    })
    expect(await useCases.projects.listProjects.execute(createTenantContext(actor), actor)).toEqual(
      [],
    )
    expect(
      await useCases.projects.listProjects.execute(createTenantContext(actor), actor, {
        includeArchived: true,
      }),
    ).toHaveLength(1)
    await useCases.projects.unarchiveProject.execute(createTenantContext(actor), actor, {
      projectId: project.id,
    })
    expect(await useCases.projects.listProjects.execute(createTenantContext(actor), actor)).toEqual(
      [expect.objectContaining({ id: project.id })],
    )
  })

  it('nega arquivar e desarquivar a colaborador que não criou o projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await expect(
      useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
        projectId: project.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.projects.unarchiveProject.execute(createTenantContext(actor), actor, {
        projectId: project.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('renomeia projeto e notifica', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Antigo' },
    )
    const renamed = await useCases.projects.renameProject.execute(
      createTenantContext(actor),
      actor,
      {
        projectId: project.id,
        name: '  Novo nome ',
      },
    )
    expect(renamed).toEqual(expect.objectContaining({ id: project.id, name: 'Novo nome' }))
    expect(
      await unitOfWork.repositories.projects.findById(organizationId, toProjectId(project.id)),
    ).toEqual(expect.objectContaining({ name: 'Novo nome', nameKey: 'novo nome' }))
    expect(notifier.changes.at(-1)?.change).toEqual({ kind: 'project', ids: [project.id] })
  })

  it('rejeita renomear para nome vazio', async () => {
    const { useCases } = setup()
    const project = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Projeto' },
    )
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: project.id,
        name: '  ',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('criador que não é membro arquiva, desarquiva e renomeia o próprio projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: userId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    expect(await unitOfWork.repositories.projects.listMembers(organizationId, project.id)).toEqual(
      [],
    )
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: project.id,
    })
    await useCases.projects.unarchiveProject.execute(createTenantContext(actor), actor, {
      projectId: project.id,
    })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: project.id,
        name: 'Criado por mim',
      }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Criado por mim' }))
  })

  it('gestor arquiva, desarquiva e renomeia projeto de outro criador', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    await useCases.projects.archiveProject.execute(createTenantContext(manager), manager, {
      projectId: project.id,
    })
    await useCases.projects.unarchiveProject.execute(createTenantContext(manager), manager, {
      projectId: project.id,
    })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(manager), manager, {
        projectId: project.id,
        name: 'Renomeado pelo gestor',
      }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Renomeado pelo gestor' }))
  })

  it('rejeita renomear para nome de outro projeto ativo, com mensagem própria', async () => {
    const { useCases } = setup()
    await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Projeto Alfa',
    })
    const beta = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Projeto Beta',
    })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: beta.id,
        name: '  projeto ALFA ',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Já existe um projeto com este nome',
    })
    expect(
      (await useCases.projects.listProjects.execute(createTenantContext(actor), actor)).map(
        (project) => project.name,
      ),
    ).toEqual(['Projeto Alfa', 'Projeto Beta'])
  })

  it('aceita renomear só para trocar maiúsculas do próprio nome e para nome de projeto arquivado', async () => {
    const { useCases } = setup()
    const alfa = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Projeto Alfa',
    })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: alfa.id,
        name: 'PROJETO ALFA',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: alfa.id, name: 'PROJETO ALFA' }))
    const beta = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Projeto Beta',
    })
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: beta.id,
    })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: alfa.id,
        name: 'projeto beta',
      }),
    ).resolves.toEqual(expect.objectContaining({ name: 'projeto beta' }))
  })

  it('rejeita renomear para nome de projeto ativo mesmo com um arquivado de mesmo nome criado antes', async () => {
    const { useCases } = setup()
    const alfaArchived = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Alfa' },
    )
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: alfaArchived.id,
    })
    await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'alfa',
    })
    const beta = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Beta',
    })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: beta.id,
        name: 'ALFA',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Já existe um projeto com este nome',
    })
  })

  it('rejeita renomear quando a checagem não vê o ativo e a gravação bate no índice único', async () => {
    const { useCases, unitOfWork } = setup()
    await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Alfa',
    })
    const beta = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Beta',
    })
    vi.spyOn(unitOfWork.repositories.projects, 'findActiveByNameKey').mockResolvedValueOnce(null)
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: beta.id,
        name: 'alfa',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Já existe um projeto com este nome',
    })
    expect(
      await unitOfWork.repositories.projects.findById(organizationId, toProjectId(beta.id)),
    ).toEqual(expect.objectContaining({ name: 'Beta' }))
  })

  it('rejeita desarquivar quando outro projeto ativo já tem o nome, e o projeto segue arquivado', async () => {
    const { useCases, unitOfWork } = setup()
    const old = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Alfa',
    })
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: old.id,
    })
    await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'alfa',
    })
    await expect(
      useCases.projects.unarchiveProject.execute(createTenantContext(actor), actor, {
        projectId: old.id,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Já existe um projeto com este nome',
    })
    expect(
      await unitOfWork.repositories.projects.findById(organizationId, toProjectId(old.id)),
    ).toEqual(expect.objectContaining({ archivedAt: '2026-01-02T00:00:00.000Z' }))
  })

  it('barra na gravação o desarquivar quando a checagem não vê o ativo', async () => {
    const { useCases, unitOfWork } = setup()
    const old = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Alfa',
    })
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: old.id,
    })
    await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'alfa',
    })
    vi.spyOn(unitOfWork.repositories.projects, 'findActiveByNameKey').mockResolvedValueOnce(null)
    await expect(
      useCases.projects.unarchiveProject.execute(createTenantContext(actor), actor, {
        projectId: old.id,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Já existe um projeto com este nome',
    })
  })

  it('reaproveita o projeto ativo quando um arquivado de mesmo nome foi criado antes', async () => {
    const { useCases } = setup()
    const old = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Alfa',
    })
    await useCases.projects.archiveProject.execute(createTenantContext(actor), actor, {
      projectId: old.id,
    })
    const active = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: 'Alfa' },
    )
    const reused = await useCases.projects.createProject.execute(
      createTenantContext(actor),
      actor,
      { name: ' alfa ' },
    )
    expect(reused.id).toBe(active.id)
  })

  it('nega renomear a colaborador que não criou o projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), actor, {
        projectId: project.id,
        name: 'Outro',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('isolamento entre organizações (M1.10a)', () => {
  const otherOrganizationId = toOrganizationId('00000000000000000000000099')
  const outsiderId = toUserId('00000000000000000000000077')
  const outsider: Actor = {
    userId: outsiderId,
    organizationId: otherOrganizationId,
    role: 'manager',
  }

  async function setupTwoTenants() {
    const { useCases, unitOfWork, notifier } = setup()
    await unitOfWork.repositories.users.save(
      otherOrganizationId,
      createUser({
        ...aUser().build(),
        id: outsiderId,
        name: 'Gestor de outro time',
        role: 'manager',
      }),
    )
    const mine = await useCases.projects.createProject.execute(createTenantContext(actor), actor, {
      name: 'Projeto A',
    })
    return { useCases, unitOfWork, notifier, projectId: toProjectId(mine.id) }
  }

  it('lista de outro time não devolve projetos de nenhum outro time, nem para gestor', async () => {
    const { useCases } = await setupTwoTenants()
    expect(
      await useCases.projects.listProjects.execute(createTenantContext(outsider), outsider, {
        includeArchived: true,
      }),
    ).toEqual([])
  })

  it('projeto de outro time não é lido nem alterado (NOT_FOUND para todos os casos de uso)', async () => {
    const { useCases, unitOfWork, projectId } = await setupTwoTenants()
    const ctx = createTenantContext(outsider)
    const input = { projectId, userId: outsiderId }

    await expect(
      useCases.projects.renameProject.execute(ctx, outsider, { projectId, name: 'Invadido' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.projects.archiveProject.execute(ctx, outsider, { projectId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.projects.listMembers.execute(ctx, outsider, { projectId }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(useCases.projects.addMember.execute(ctx, outsider, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      useCases.projects.removeMember.execute(ctx, outsider, input),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })

    const stored = await unitOfWork.repositories.projects.findById(organizationId, projectId)
    expect(stored).toEqual(expect.objectContaining({ name: 'Projeto A', archivedAt: null }))
  })

  it('nome igual em outro time gera projeto próprio, sem reaproveitar o do time vizinho', async () => {
    const { useCases } = await setupTwoTenants()
    const theirs = await useCases.projects.createProject.execute(
      createTenantContext(outsider),
      outsider,
      { name: 'Projeto A' },
    )
    const listed = await useCases.projects.listProjects.execute(
      createTenantContext(outsider),
      outsider,
    )
    expect(listed.map((project) => project.id)).toEqual([theirs.id])
    expect(
      (await useCases.projects.listProjects.execute(createTenantContext(actor), actor)).map(
        (project) => project.name,
      ),
    ).toEqual(['Projeto A'])
  })

  it('contexto de um time com ator de outro é recusado e não grava nada', async () => {
    const { useCases, unitOfWork, projectId } = await setupTwoTenants()

    await expect(
      useCases.projects.createProject.execute(createTenantContext(actor), outsider, {
        name: 'Intruso',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.projects.renameProject.execute(createTenantContext(actor), outsider, {
        projectId,
        name: 'Invadido',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.projects.archiveProject.execute(createTenantContext(outsider), actor, { projectId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(await unitOfWork.repositories.projects.list(otherOrganizationId)).toEqual([])
    expect(
      (await unitOfWork.repositories.projects.list(organizationId)).map((project) => project.name),
    ).toEqual(['Projeto A'])
    expect(await unitOfWork.repositories.projects.findById(organizationId, projectId)).toEqual(
      expect.objectContaining({ name: 'Projeto A', archivedAt: null }),
    )
  })
})
