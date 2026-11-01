import { describe, expect, it } from 'vitest'
import { createUser, toOrganizationId, toTaskId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
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

describe('casos de uso de tarefas', () => {
  it('cria tarefa com o criador responsável e registra evento na mesma transação', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: userId,
        organizationId,
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'collaborator',
        defaultRateCents: 4500,
        createdAt: project.createdAt,
      }),
    )

    const created = await useCases.tasks.create.execute(actor, {
      projectId: project.id,
      title: 'Nova tarefa',
    })
    const saved = await unitOfWork.repositories.tasks.findById(organizationId, toTaskId(created.id))
    expect(saved?.participations[0]).toMatchObject({
      role: 'responsible',
      participant: { kind: 'user', userId },
    })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, toTaskId(created.id)),
    ).toMatchObject([{ type: 'task_created', actorUserId: userId, asManager: false }])
    expect(notifier.changes).toEqual([
      { organizationId, change: { kind: 'task', ids: [created.id] } },
    ])
  })

  it('nega criação por colaborador que não é membro do projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await expect(
      useCases.tasks.create.execute(actor, { projectId: project.id, title: 'Tarefa' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('retorna detalhe editável para participante e somente leitura para membro', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const task = aTask().inProject(project).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId: otherUserId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: userId,
        organizationId,
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'collaborator',
        defaultRateCents: 4500,
        createdAt: project.createdAt,
      }),
    )
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: otherUserId,
        organizationId,
        name: 'Bia Lima',
        email: 'bia@example.com',
        role: 'collaborator',
        defaultRateCents: 4500,
        createdAt: project.createdAt,
      }),
    )
    const editable = await useCases.tasks.getDetail.execute(actor, { taskId: task.id })
    const readOnly = await useCases.tasks.getDetail.execute(
      { ...actor, userId: otherUserId },
      { taskId: task.id },
    )
    expect(editable).toMatchObject({ canEdit: true, readOnly: false, total: null })
    expect(readOnly).toMatchObject({ canEdit: false, readOnly: true })
  })

  it('edita campos, grava eventos com marca de gestor e notifica', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    const result = await useCases.tasks.update.execute(manager, {
      taskId: task.id,
      changes: { title: 'Título novo', description: 'Descrição' },
    })
    expect(result).toMatchObject({ title: 'Título novo', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      { type: 'renamed', asManager: true },
      { type: 'description_edited', asManager: true },
    ])
    expect(notifier.changes).toHaveLength(1)
  })

  it('nega edição por colaborador que não participa da tarefa', async () => {
    const { useCases, unitOfWork } = setup()
    const otherUser = aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()
    const task = aTask().ownedBy(otherUser).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.update.execute(actor, { taskId: task.id, changes: { title: 'Alterada' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('desfaz tarefa se a gravação de eventos falhar', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const originalSaveMany = unitOfWork.repositories.timeline.saveMany.bind(
      unitOfWork.repositories.timeline,
    )
    unitOfWork.repositories.timeline.saveMany = () =>
      Promise.reject(new Error('falha ao gravar evento'))
    await expect(
      useCases.tasks.update.execute(actor, {
        taskId: task.id,
        changes: { title: 'Título alterado' },
      }),
    ).rejects.toThrow('falha ao gravar evento')
    expect((await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.title).toBe(
      task.title,
    )
    unitOfWork.repositories.timeline.saveMany = originalSaveMany
  })

  it('move tarefa e registra evento de mudança de estado', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const moved = await useCases.tasks.move.execute(actor, { taskId: task.id, status: 'review' })
    expect(moved.status).toBe('review')
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      {
        type: 'status_changed',
        payload: { before: 'planning', after: 'review' },
        asManager: false,
      },
    ])
  })

  it('valida entrada de atualização', async () => {
    const { useCases } = setup()
    await expect(
      useCases.tasks.update.execute(actor, { taskId: 'inválido', changes: { title: 'x' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
