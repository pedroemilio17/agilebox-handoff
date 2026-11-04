import { describe, expect, it } from 'vitest'
import { createUser, toOrganizationId, toProjectId, toUserId } from '@agilebox/core'
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
    checklist: unitOfWork.repositories.checklist,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
    contributors: unitOfWork.repositories.contributors,
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

describe('casos de uso de projetos', () => {
  it('cria projeto, torna criador membro e notifica', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = await useCases.projects.createProject.execute(actor, { name: 'Projeto novo' })
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
    const created = await useCases.projects.createProject.execute(actor, { name: 'Gestão Ágil' })
    const reused = await useCases.projects.createProject.execute(actor, { name: '  gestao agil  ' })
    expect(reused.id).toBe(created.id)
  })

  it('rejeita nome de projeto vazio', async () => {
    const { useCases } = setup()
    await expect(
      useCases.projects.createProject.execute(actor, { name: '  ' }),
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
    expect(await useCases.projects.listProjects.execute(actor)).toHaveLength(1)
    expect(
      await useCases.projects.listProjects.execute({
        ...actor,
        userId: managerId,
        role: 'manager',
      }),
    ).toHaveLength(2)
  })

  it('permite ao criador adicionar e remover membro, com notificações', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await useCases.projects.addMember.execute(actor, { projectId: project.id, userId: otherUserId })
    expect(
      await unitOfWork.repositories.projects.listMembers(organizationId, project.id),
    ).toHaveLength(1)
    await useCases.projects.removeMember.execute(actor, {
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
      useCases.projects.addMember.execute(actor, { projectId: project.id, userId: managerId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('permite gestor gerenciar membros e lista de membros usa nomes da organização', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    await useCases.projects.addMember.execute(manager, { projectId: project.id, userId })
    await expect(
      useCases.projects.listMembers.execute(manager, { projectId: project.id }),
    ).resolves.toEqual([expect.objectContaining({ id: userId, name: 'Ana Silva' })])
  })
})
