import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aProject, aTask, aUser } from '@agilebox/application/testing'
import {
  createTaskComment,
  toOrganizationId,
  toParticipationId,
  toTaskCommentId,
  toTaskId,
} from '@agilebox/core'
import type { TaskComment, UserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import {
  organizations,
  projects,
  taskComments,
  taskParticipations,
  tasks,
  users,
} from '../schema/index.js'
import { createSqliteTaskCommentRepository } from './task-comment-repository.js'
import { createSqliteTaskRepositories } from './task-repositories.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const taskOne = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FAZ')
const taskTwo = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB0')

async function setup() {
  const database = createSqliteClient(':memory:')
  database
    .insert(organizations)
    .values([
      { id: orgA, name: 'A', createdAt },
      { id: orgB, name: 'B', createdAt },
    ])
    .run()
  const user = aUser().with({ organizationId: orgA }).build()
  const other = aUser()
    .with({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB1' as UserId,
      organizationId: orgA,
      name: 'Bruno Lima',
      email: 'bruno@example.com',
    })
    .build()
  database.insert(users).values([user, other]).run()
  const project = aProject().with({ organizationId: orgA }).build()
  database
    .insert(projects)
    .values({ ...project, nameKey: 'projeto' })
    .run()
  const repositories = createSqliteTaskRepositories(database)
  const comments = createSqliteTaskCommentRepository(database)
  await repositories.tasks.save(
    orgA,
    aTask()
      .with({ id: taskOne, organizationId: orgA, number: 1, createdBy: user.id })
      .inProject(project)
      .build(),
  )
  await repositories.tasks.save(
    orgA,
    aTask()
      .with({
        id: taskTwo,
        organizationId: orgA,
        number: 2,
        createdBy: user.id,
        responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB2'),
      })
      .inProject(project)
      .build(),
  )
  return { database, comments, user, other }
}

let sequence = 2000
function aComment(
  overrides: Partial<TaskComment> & Pick<TaskComment, 'authorId' | 'body'>,
): TaskComment {
  sequence += 1
  return createTaskComment({
    id: toTaskCommentId(String(sequence).padStart(26, '0')),
    organizationId: orgA,
    taskId: taskOne,
    mentions: [],
    createdAt,
    editedAt: null,
    asManager: false,
    ...overrides,
  })
}

describe('repositório de comentários (SQLite)', () => {
  it('grava e lista por tarefa do mais antigo para o mais novo, com menções', async () => {
    const { comments, user, other } = await setup()
    const first = aComment({
      authorId: user.id,
      body: 'Primeiro',
      createdAt: '2026-01-01T10:00:00.000Z',
    })
    const second = aComment({
      authorId: other.id,
      body: 'Segundo, com @Bruno',
      mentions: [other.id],
      createdAt: '2026-01-01T11:00:00.000Z',
      asManager: true,
    })
    await comments.save(orgA, second)
    await comments.save(orgA, first)

    const listed = await comments.listByTask(orgA, taskOne)
    expect(listed.map((comment) => comment.body)).toEqual(['Primeiro', 'Segundo, com @Bruno'])
    expect(listed[1]).toMatchObject({ mentions: [other.id], asManager: true, authorId: other.id })
  })

  it('conta comentários por tarefa e devolve vazio sem identificadores', async () => {
    const { comments, user } = await setup()
    await comments.save(orgA, aComment({ authorId: user.id, body: 'Um' }))
    await comments.save(orgA, aComment({ authorId: user.id, body: 'Dois' }))
    await comments.save(orgA, aComment({ authorId: user.id, body: 'Outra', taskId: taskTwo }))

    const counts = await comments.countByTasks(orgA, [taskOne, taskTwo])
    expect(counts.find((row) => row.taskId === taskOne)?.count).toBe(2)
    expect(counts.find((row) => row.taskId === taskTwo)?.count).toBe(1)
    expect(await comments.countByTasks(orgA, [])).toEqual([])
  })

  it('atualiza corpo, menções e data de edição pelo mesmo identificador', async () => {
    const { comments, user, other } = await setup()
    const original = aComment({ authorId: user.id, body: 'Antes' })
    await comments.save(orgA, original)
    await comments.save(
      orgA,
      createTaskComment({
        ...original,
        body: 'Depois, @Bruno',
        mentions: [other.id],
        editedAt: '2026-01-03T00:00:00.000Z',
      }),
    )

    const found = await comments.findById(orgA, original.id)
    expect(found).toMatchObject({
      body: 'Depois, @Bruno',
      mentions: [other.id],
      editedAt: '2026-01-03T00:00:00.000Z',
      createdAt,
    })
    expect(await comments.listByTask(orgA, taskOne)).toHaveLength(1)
  })

  it('remove só o comentário indicado', async () => {
    const { comments, user } = await setup()
    const keep = aComment({ authorId: user.id, body: 'Fica' })
    const drop = aComment({ authorId: user.id, body: 'Sai' })
    await comments.save(orgA, keep)
    await comments.save(orgA, drop)
    await comments.remove(orgA, drop.id)
    expect((await comments.listByTask(orgA, taskOne)).map((comment) => comment.body)).toEqual([
      'Fica',
    ])
  })

  it('isola organizações: não lê, conta nem grava comentário de outra organização', async () => {
    const { comments, user } = await setup()
    const mine = aComment({ authorId: user.id, body: 'Da A' })
    await comments.save(orgA, mine)
    expect(await comments.listByTask(orgB, taskOne)).toEqual([])
    expect(await comments.countByTasks(orgB, [taskOne])).toEqual([])
    expect(await comments.findById(orgB, mine.id)).toBeNull()

    const intruder = aComment({ authorId: user.id, body: 'Intruso' })
    await comments.save(orgB, intruder)
    expect(await comments.findById(orgA, intruder.id)).toBeNull()
    await comments.remove(orgB, mine.id)
    expect((await comments.listByTask(orgA, taskOne)).map((comment) => comment.body)).toEqual([
      'Da A',
    ])
  })

  it('apaga os comentários junto com a tarefa (ON DELETE CASCADE)', async () => {
    const { database, comments, user } = await setup()
    await comments.save(orgA, aComment({ authorId: user.id, body: 'Some' }))
    // Participações da tarefa não têm cascata; o teste só remove o que a tarefa exige.
    database.delete(taskParticipations).where(eq(taskParticipations.taskId, taskOne)).run()
    database.delete(tasks).where(eq(tasks.id, taskOne)).run()
    expect(database.select().from(taskComments).all()).toEqual([])
  })

  it('recusa corpo vazio ou acima de 2000 caracteres no próprio banco', async () => {
    const { database, user } = await setup()
    const base = {
      organizationId: orgA,
      taskId: taskOne,
      authorId: user.id,
      mentions: '[]',
      createdAt,
      editedAt: null,
      asManager: false,
    }
    expect(() =>
      database
        .insert(taskComments)
        .values({ ...base, id: '00000000000000000000000901', body: '' })
        .run(),
    ).toThrow()
    expect(() =>
      database
        .insert(taskComments)
        .values({ ...base, id: '00000000000000000000000902', body: 'a'.repeat(2001) })
        .run(),
    ).toThrow()
  })
})
