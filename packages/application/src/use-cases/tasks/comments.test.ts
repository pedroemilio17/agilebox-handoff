import { describe, expect, it } from 'vitest'
import {
  createContributor,
  createOrganization,
  createParticipation,
  createTaskComment,
  createUser,
  NotFoundError,
  PermissionDeniedError,
  toContributorId,
  toOrganizationId,
  toParticipationId,
  toTaskCommentId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, Task } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const id = (n: number) => String(n).padStart(26, '0')
const organizationId = toOrganizationId(id(1))
const otherOrganizationId = toOrganizationId(id(9))
const anaId = toUserId(id(2))
const brunoId = toUserId(id(3))
const brunaId = toUserId(id(4))
const outsiderId = toUserId(id(5))
const managerId = toUserId(id(6))
const contributorId = toContributorId(id(7))
const taskId = toTaskId(id(8))
const ana: Actor = { userId: anaId, organizationId, role: 'collaborator' }
const bruno: Actor = { userId: brunoId, organizationId, role: 'collaborator' }
const outsider: Actor = { userId: outsiderId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const timestamp = '2026-01-02T00:00:00.000Z'

function setup(actor: Actor = ana, unitOfWork = new InMemoryUnitOfWork()) {
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
    clock: new FixedClock(timestamp),
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

/** Tarefa de Ana com Bruno e Bruna como apoio (participantes), uma entidade e Caio fora da tarefa. */
async function seed(unitOfWork: InMemoryUnitOfWork, status: Task['status'] = 'in_progress') {
  const project = aProject().build()
  await unitOfWork.repositories.projects.save(organizationId, project)
  const people = [
    ['Ana Silva', anaId],
    ['Bruno Lima', brunoId],
    ['Bruna Costa', brunaId],
    ['Caio Souza', outsiderId],
    ['Gestora Lia', managerId],
  ] as const
  for (const [name, userId] of people) {
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: userId,
        organizationId,
        name,
        email: `${userId}@example.com`,
        role: userId === managerId ? 'manager' : 'collaborator',
        defaultRateCents: 4500,
        createdAt: timestamp,
      }),
    )
  }
  await unitOfWork.repositories.contributors.save(
    organizationId,
    createContributor({
      id: contributorId,
      organizationId,
      name: 'Cliente Alfa',
      source: 'manual',
      defaultRateCents: 0,
      createdBy: anaId,
      createdAt: timestamp,
    }),
  )
  const base = aTask().inProject(project).ownedBy(aUser().build()).build()
  const participation = (
    participant: Parameters<typeof createParticipation>[0]['participant'],
    n: number,
  ) =>
    createParticipation({
      id: toParticipationId(id(20 + n)),
      taskId,
      participant,
      role: 'support',
      hoursHundredths: 0,
      rateCents: 4500,
      addedAt: timestamp,
    })
  const task: Task = {
    ...base,
    id: taskId,
    status,
    participations: [
      ...base.participations,
      participation({ kind: 'user', userId: brunoId }, 1),
      participation({ kind: 'user', userId: brunaId }, 2),
      participation({ kind: 'contributor', contributorId }, 3),
    ],
  }
  await unitOfWork.repositories.tasks.save(organizationId, task)
  await unitOfWork.repositories.projects.addMember(organizationId, {
    projectId: project.id,
    userId: outsiderId,
    addedBy: anaId,
    addedAt: timestamp,
  })
  return task
}

describe('casos de uso de comentários', () => {
  it('participante comenta, registra o evento e resolve a menção só entre participantes-usuários', async () => {
    const { useCases, unitOfWork, notifier } = setup(bruno)
    await seed(unitOfWork)
    const result = await useCases.tasks.comments.add.execute(bruno, {
      taskId,
      body: 'Oi @Bruna, e @Cliente Alfa? Também @Caio e @Bru',
    })

    expect(result).toMatchObject({
      authorName: 'Bruno Lima',
      asManager: false,
      mentions: [{ id: brunaId, name: 'Bruna Costa' }],
      canEdit: true,
      canRemove: true,
    })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.find((event) => event.type === 'comment_added')).toMatchObject({
      type: 'comment_added',
      asManager: false,
      actorUserId: brunoId,
      payload: { commentId: result.id, excerpt: 'Oi @Bruna, e @Cliente Alfa? Também @Caio e @Bru' },
    })
    expect(notifier.changes.at(-1)?.change).toEqual({ kind: 'task', ids: [taskId] })
  })

  it('não gera aviso: menção fica só registrada no comentário', async () => {
    const { useCases, unitOfWork, notifier } = setup(bruno)
    await seed(unitOfWork)
    const before = notifier.changes.length
    await useCases.tasks.comments.add.execute(bruno, { taskId, body: '@Ana Silva revisa' })
    expect(notifier.changes).toHaveLength(before + 1)
    expect(notifier.changes.at(-1)?.change).toEqual({ kind: 'task', ids: [taskId] })
    const comments = await unitOfWork.repositories.comments.listByTask(organizationId, taskId)
    expect(comments[0]?.mentions).toEqual([anaId])
  })

  it('gestor comenta marcado como Gestor e o evento sai marcado', async () => {
    const { useCases, unitOfWork } = setup(manager)
    await seed(unitOfWork)
    const result = await useCases.tasks.comments.add.execute(manager, { taskId, body: 'Ok' })
    expect(result).toMatchObject({ asManager: true, authorName: 'Gestora Lia' })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.find((event) => event.type === 'comment_added')).toMatchObject({
      asManager: true,
    })
  })

  it('recusa quem não participa da tarefa e aceita comentário em tarefa concluída', async () => {
    const { useCases, unitOfWork } = setup(outsider)
    await seed(unitOfWork, 'done')
    await expect(
      useCases.tasks.comments.add.execute(outsider, { taskId, body: 'Oi' }),
    ).rejects.toThrow(PermissionDeniedError)

    const { useCases: participantCases } = setup(bruno)
    await expect(
      participantCases.tasks.comments.add.execute(bruno, { taskId, body: 'Obrigado' }),
    ).rejects.toThrow(NotFoundError)
  })

  it('aceita de 1 a 2000 caracteres sem contar espaços e marca o limite', async () => {
    const { useCases, unitOfWork } = setup(bruno)
    await seed(unitOfWork)
    await expect(
      useCases.tasks.comments.add.execute(bruno, { taskId, body: '   ' }),
    ).rejects.toThrow(ValidationError)
    await expect(
      useCases.tasks.comments.add.execute(bruno, { taskId, body: 'a'.repeat(2001) }),
    ).rejects.toThrow('Comentário deve ter até 2000 caracteres')
    await useCases.tasks.comments.add.execute(bruno, { taskId, body: 'a'.repeat(2000) })
    expect(await unitOfWork.repositories.comments.listByTask(organizationId, taskId)).toHaveLength(
      1,
    )
  })

  it('só o autor edita o próprio comentário; a edição marca editedAt e não gera evento', async () => {
    const { useCases, unitOfWork } = setup(bruno)
    await seed(unitOfWork)
    const added = await useCases.tasks.comments.add.execute(bruno, { taskId, body: 'Versão um' })
    const eventsBefore = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)

    await expect(
      useCases.tasks.comments.edit.execute(ana, { taskId, commentId: added.id, body: 'Ana edita' }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.tasks.comments.edit.execute(manager, {
        taskId,
        commentId: added.id,
        body: 'Gestor',
      }),
    ).rejects.toThrow(PermissionDeniedError)

    const edited = await useCases.tasks.comments.edit.execute(bruno, {
      taskId,
      commentId: added.id,
      body: 'Versão dois com @Ana Silva',
    })
    expect(edited).toMatchObject({
      body: 'Versão dois com @Ana Silva',
      mentions: [{ id: anaId, name: 'Ana Silva' }],
    })
    expect(edited.editedAt).toBe(timestamp)
    const eventsAfter = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(eventsAfter).toHaveLength(eventsBefore.length)
  })

  it('o autor remove o próprio comentário e a remoção gera evento', async () => {
    const { useCases, unitOfWork } = setup(bruno)
    await seed(unitOfWork)
    const added = await useCases.tasks.comments.add.execute(bruno, { taskId, body: 'Apagar' })
    await useCases.tasks.comments.remove.execute(bruno, { taskId, commentId: added.id })

    expect(await unitOfWork.repositories.comments.listByTask(organizationId, taskId)).toEqual([])
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.find((event) => event.type === 'comment_removed')).toMatchObject({
      type: 'comment_removed',
      asManager: false,
      payload: { commentId: added.id },
    })
  })

  it('outro participante não remove comentário alheio; o gestor remove qualquer um, marcado como Gestor', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    await seed(unitOfWork)
    const added = await setup(bruno, unitOfWork).useCases.tasks.comments.add.execute(bruno, {
      taskId,
      body: 'De Bruno',
    })
    await expect(
      setup(ana, unitOfWork).useCases.tasks.comments.remove.execute(ana, {
        taskId,
        commentId: added.id,
      }),
    ).rejects.toThrow(PermissionDeniedError)

    await setup(manager, unitOfWork).useCases.tasks.comments.remove.execute(manager, {
      taskId,
      commentId: added.id,
    })
    expect(await unitOfWork.repositories.comments.listByTask(organizationId, taskId)).toEqual([])
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.find((event) => event.type === 'comment_removed')).toMatchObject({
      asManager: true,
    })
  })

  it('o detalhe traz comentários só para participante ou gestor; outro membro vê lista vazia', async () => {
    const { useCases, unitOfWork } = setup(bruno)
    await seed(unitOfWork)
    await useCases.tasks.comments.add.execute(ana, { taskId, body: 'Primeiro' })
    await useCases.tasks.comments.add.execute(bruno, { taskId, body: 'Segundo' })

    const detail = await useCases.tasks.getDetail.execute(bruno, { taskId })
    expect(detail.comments.map((comment) => comment.body)).toEqual(['Primeiro', 'Segundo'])
    expect(detail.commentCount).toBe(2)

    const member = await useCases.tasks.getDetail.execute(outsider, { taskId })
    expect(member).toMatchObject({ readOnly: true, comments: [], commentCount: 0 })
  })

  it('o card traz a contagem para quem vê os comentários e zero para quem não vê', async () => {
    const { useCases, unitOfWork } = setup(bruno)
    await seed(unitOfWork)
    await useCases.tasks.comments.add.execute(bruno, { taskId, body: 'Um' })
    const { tasks: board } = await useCases.tasks.listBoard.execute(bruno, {})
    expect(board.find((task) => task.id === taskId)?.commentCount).toBe(1)
    const team = await useCases.tasks.listTeamBoard.execute(outsider, {})
    expect(team.find((task) => task.id === taskId)?.commentCount).toBe(0)
  })

  it('não expõe comentários de outra organização', async () => {
    const { unitOfWork } = setup(bruno)
    await seed(unitOfWork)
    await unitOfWork.repositories.organizations.save(
      createOrganization({ id: otherOrganizationId, name: 'Outra', createdAt: timestamp }),
    )
    await unitOfWork.repositories.comments.save(
      organizationId,
      createTaskComment({
        id: toTaskCommentId(id(40)),
        organizationId,
        taskId,
        authorId: brunoId,
        body: 'Só aqui',
        mentions: [],
        createdAt: timestamp,
        editedAt: null,
        asManager: false,
      }),
    )
    expect(
      await unitOfWork.repositories.comments.findById(otherOrganizationId, toTaskCommentId(id(40))),
    ).toBeNull()
  })
})
