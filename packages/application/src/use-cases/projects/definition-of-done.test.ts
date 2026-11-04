import { describe, expect, it } from 'vitest'
import {
  createDefinitionOfDoneItem,
  createProject,
  createUser,
  toDefinitionOfDoneItemId,
  toOrganizationId,
  toProjectId,
  toUserId,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from '@agilebox/core'
import type { Actor, ProjectId } from '@agilebox/core'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const creatorId = toUserId('00000000000000000000000002')
const colleagueId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const projectId = toProjectId('00000000000000000000000005')
const creator: Actor = { userId: creatorId, organizationId, role: 'collaborator' }
const colleague: Actor = { userId: colleagueId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

function setup(actor: Actor = creator, unitOfWork = new InMemoryUnitOfWork()) {
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    retroActions: unitOfWork.repositories.retroActions,
    dailyEntries: unitOfWork.repositories.dailyEntries,
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    comments: unitOfWork.repositories.comments,
    contributors: unitOfWork.repositories.contributors,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
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

async function seedProject(unitOfWork: InMemoryUnitOfWork, id: ProjectId = projectId) {
  for (const user of [
    aUser().with({ id: creatorId, name: 'Criador' }).build(),
    aUser().with({ id: colleagueId, name: 'Colega' }).build(),
    createUser({ ...aUser().build(), id: managerId, name: 'Gestor', role: 'manager' }),
  ])
    await unitOfWork.repositories.users.save(organizationId, user)
  const project = createProject({
    id,
    organizationId,
    name: 'Projeto DoD',
    createdBy: creatorId,
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  await unitOfWork.repositories.projects.save(organizationId, project)
  await unitOfWork.repositories.projects.addMember(organizationId, {
    projectId: project.id,
    userId: creatorId,
    addedBy: creatorId,
    addedAt: '2026-01-01T00:00:00.000Z',
  })
  await unitOfWork.repositories.projects.addMember(organizationId, {
    projectId: project.id,
    userId: colleagueId,
    addedBy: creatorId,
    addedAt: '2026-01-01T00:00:00.000Z',
  })
  return project
}

function itemFor(n: number, title: string, position: number, id = projectId) {
  return createDefinitionOfDoneItem({
    id: toDefinitionOfDoneItemId(`0000000000000000000000${String(n).padStart(4, '0')}`),
    organizationId,
    projectId: id,
    title,
    position,
  })
}

describe('definição de pronto: casos de uso', () => {
  it('gestor e criador adicionam, renomeiam, reordenam e removem', async () => {
    const { useCases, unitOfWork, notifier } = setup(creator)
    await seedProject(unitOfWork)
    const added = await useCases.projects.definitionOfDone.add.execute(creator, {
      projectId,
      title: ' Testes passando ',
    })
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ title: 'Testes passando', position: 0, projectId })
    const second = await useCases.projects.definitionOfDone.add.execute(creator, {
      projectId,
      title: 'Documentação atualizada',
    })
    const [first, last] = second
    expect(last?.position).toBe(1)

    const renamed = await useCases.projects.definitionOfDone.rename.execute(creator, {
      projectId,
      itemId: last!.id,
      title: 'Documentação revisada',
    })
    expect(renamed.map((item) => item.title)).toEqual(['Testes passando', 'Documentação revisada'])

    const moved = await useCases.projects.definitionOfDone.move.execute(manager, {
      projectId,
      itemId: last!.id,
      position: 0,
    })
    expect(moved.map((item) => [item.title, item.position])).toEqual([
      ['Documentação revisada', 0],
      ['Testes passando', 1],
    ])

    const removed = await useCases.projects.definitionOfDone.remove.execute(creator, {
      projectId,
      itemId: first!.id,
    })
    expect(removed.map((item) => [item.title, item.position])).toEqual([
      ['Documentação revisada', 0],
    ])
    expect(notifier.changes.at(-1)?.change).toEqual({ kind: 'project', ids: [projectId] })
  })

  it('colaborador que não criou o projeto recebe FORBIDDEN em todas as alterações', async () => {
    const { useCases, unitOfWork } = setup(colleague)
    await seedProject(unitOfWork)
    await unitOfWork.repositories.definitionOfDone.saveMany(organizationId, [itemFor(1, 'A', 0)])
    await expect(
      useCases.projects.definitionOfDone.add.execute(colleague, { projectId, title: 'B' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.projects.definitionOfDone.rename.execute(colleague, {
        projectId,
        itemId: '00000000000000000000000001',
        title: 'B',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.projects.definitionOfDone.remove.execute(colleague, {
        projectId,
        itemId: '00000000000000000000000001',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    await expect(
      useCases.projects.definitionOfDone.move.execute(colleague, {
        projectId,
        itemId: '00000000000000000000000001',
        position: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('colaborador do projeto lê a lista, mas não de projeto que não vê', async () => {
    const { useCases, unitOfWork } = setup(colleague)
    await seedProject(unitOfWork)
    await unitOfWork.repositories.definitionOfDone.saveMany(organizationId, [itemFor(1, 'A', 0)])
    await expect(
      useCases.projects.definitionOfDone.list.execute(colleague, { projectId }),
    ).resolves.toEqual([expect.objectContaining({ title: 'A' })])
    const outsider: Actor = {
      userId: toUserId('00000000000000000000000007'),
      organizationId,
      role: 'collaborator',
    }
    const { useCases: outsiderCases } = setup(outsider, unitOfWork)
    await expect(
      outsiderCases.projects.definitionOfDone.list.execute(outsider, { projectId }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('recusa o 21º item e título inválido', async () => {
    const { useCases, unitOfWork } = setup(creator)
    await seedProject(unitOfWork)
    for (let index = 0; index < 20; index += 1)
      await useCases.projects.definitionOfDone.add.execute(creator, {
        projectId,
        title: `Item ${index + 1}`,
      })
    await expect(
      useCases.projects.definitionOfDone.add.execute(creator, { projectId, title: 'Extra' }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      useCases.projects.definitionOfDone.add.execute(creator, {
        projectId,
        title: 'a'.repeat(201),
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('projeto inexistente ou de outra organização não é encontrado', async () => {
    const { useCases, unitOfWork } = setup(creator)
    await seedProject(unitOfWork)
    await expect(
      useCases.projects.definitionOfDone.add.execute(creator, {
        projectId: '00000000000000000000000099',
        title: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    const foreign = createProject({
      id: toProjectId('00000000000000000000000077'),
      organizationId: otherOrganizationId,
      name: 'Outro',
      createdBy: creatorId,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    await unitOfWork.repositories.projects.save(otherOrganizationId, foreign)
    await expect(
      useCases.projects.definitionOfDone.add.execute(creator, {
        projectId: foreign.id,
        title: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('a lista de projetos traz a contagem de itens', async () => {
    const { useCases, unitOfWork } = setup(creator)
    await seedProject(unitOfWork)
    await useCases.projects.definitionOfDone.add.execute(creator, { projectId, title: 'A' })
    await useCases.projects.definitionOfDone.add.execute(creator, { projectId, title: 'B' })
    const projects = await useCases.projects.listProjects.execute(creator)
    expect(projects).toEqual([expect.objectContaining({ id: projectId, definitionOfDoneCount: 2 })])
  })
})
