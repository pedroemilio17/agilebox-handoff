import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aProject, aTask, aUser } from '@agilebox/application/testing'
import {
  createChecklistItem,
  toChecklistItemId,
  toOrganizationId,
  toParticipationId,
  toTaskId,
} from '@agilebox/core'
import type { ChecklistItem, TaskId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import {
  organizations,
  projects,
  taskChecklistItems,
  taskParticipations,
  tasks,
  users,
} from '../schema/index.js'
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
  database.insert(users).values(user).run()
  const project = aProject().with({ organizationId: orgA }).build()
  database
    .insert(projects)
    .values({ ...project, nameKey: 'projeto' })
    .run()
  const repositories = createSqliteTaskRepositories(database)
  await repositories.tasks.save(
    orgA,
    aTask().with({ id: taskOne, organizationId: orgA, number: 1, createdBy: user.id }).build(),
  )
  return { database, repositories, user, project }
}

let sequence = 1000
function anItem(
  taskId: TaskId,
  position: number,
  title: string,
  overrides: Partial<ChecklistItem> = {},
): ChecklistItem {
  sequence += 1
  return createChecklistItem({
    id: toChecklistItemId(String(sequence).padStart(26, '0')),
    organizationId: orgA,
    taskId,
    title,
    done: false,
    position,
    createdAt,
    doneAt: null,
    ...overrides,
  })
}

describe('repositório de subtarefas (SQLite)', () => {
  it('grava e lista por tarefa na ordem de posição', async () => {
    const { repositories } = await setup()
    await repositories.checklist.saveMany(orgA, [
      anItem(taskOne, 1, 'Segundo'),
      anItem(taskOne, 0, 'Primeiro', { id: toChecklistItemId('00000000000000000000000600') }),
    ])
    const items = await repositories.checklist.listByTask(orgA, taskOne)
    expect(items.map((item) => [item.title, item.position])).toEqual([
      ['Primeiro', 0],
      ['Segundo', 1],
    ])
    expect(items[0]).toMatchObject({ done: false, doneAt: null, organizationId: orgA })
  })

  it('atualiza (marcar, renomear, reposicionar) pelo mesmo identificador', async () => {
    const { repositories } = await setup()
    const item = anItem(taskOne, 0, 'Revisar')
    await repositories.checklist.saveMany(orgA, [item])
    await repositories.checklist.saveMany(orgA, [
      { ...item, title: 'Revisado', done: true, doneAt: '2026-01-03T00:00:00.000Z' },
    ])
    expect(await repositories.checklist.listByTask(orgA, taskOne)).toEqual([
      expect.objectContaining({
        id: item.id,
        title: 'Revisado',
        done: true,
        doneAt: '2026-01-03T00:00:00.000Z',
      }),
    ])
  })

  it('lista de várias tarefas e devolve vazio sem identificadores', async () => {
    const { repositories, user, project } = await setup()
    await repositories.tasks.save(
      orgA,
      aTask()
        .with({
          id: taskTwo,
          organizationId: orgA,
          number: 2,
          createdBy: user.id,
          responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB1'),
        })
        .inProject(project)
        .build(),
    )
    await repositories.checklist.saveMany(orgA, [
      anItem(taskOne, 0, 'Um'),
      anItem(taskTwo, 0, 'Dois'),
    ])
    const grouped = await repositories.checklist.listByTasks(orgA, [taskOne, taskTwo])
    expect(grouped.map((item) => item.title).sort()).toEqual(['Dois', 'Um'])
    expect(await repositories.checklist.listByTasks(orgA, [])).toEqual([])
  })

  it('remove um item sem afetar os demais', async () => {
    const { repositories } = await setup()
    const keep = anItem(taskOne, 0, 'Fica')
    const drop = anItem(taskOne, 1, 'Sai', { id: toChecklistItemId('00000000000000000000000777') })
    await repositories.checklist.saveMany(orgA, [keep, drop])
    await repositories.checklist.remove(orgA, drop.id)
    expect((await repositories.checklist.listByTask(orgA, taskOne)).map((i) => i.title)).toEqual([
      'Fica',
    ])
  })

  it('isola organizações: não lista nem grava itens de outra organização', async () => {
    const { repositories } = await setup()
    await repositories.checklist.saveMany(orgA, [anItem(taskOne, 0, 'Da A')])
    expect(await repositories.checklist.listByTask(orgB, taskOne)).toEqual([])
    expect(await repositories.checklist.listByTasks(orgB, [taskOne])).toEqual([])

    const intruder = anItem(taskOne, 1, 'Intruso', {
      id: toChecklistItemId('00000000000000000000000888'),
      organizationId: orgB,
    })
    await repositories.checklist.saveMany(orgB, [intruder])
    await repositories.checklist.remove(orgB, toChecklistItemId('00000000000000000000000500'))
    expect((await repositories.checklist.listByTask(orgA, taskOne)).map((i) => i.title)).toEqual([
      'Da A',
    ])
    expect(await repositories.checklist.listByTask(orgB, taskOne)).toEqual([])
  })

  it('apaga as subtarefas junto com a tarefa (ON DELETE CASCADE)', async () => {
    const { database, repositories } = await setup()
    await repositories.checklist.saveMany(orgA, [anItem(taskOne, 0, 'Some')])
    // Participações da tarefa não têm cascata; o teste só remove o que a tarefa exige.
    database.delete(taskParticipations).where(eq(taskParticipations.taskId, taskOne)).run()
    database.delete(tasks).where(eq(tasks.id, taskOne)).run()
    const remaining = database.select().from(taskChecklistItems).all()
    expect(remaining).toEqual([])
  })

  it('recusa título vazio ou acima de 200 caracteres no próprio banco', async () => {
    const { database } = await setup()
    const base = {
      organizationId: orgA,
      taskId: taskOne,
      done: false,
      position: 0,
      createdAt,
      doneAt: null,
    }
    expect(() =>
      database
        .insert(taskChecklistItems)
        .values({ ...base, id: '00000000000000000000000901', title: '' })
        .run(),
    ).toThrow()
    expect(() =>
      database
        .insert(taskChecklistItems)
        .values({ ...base, id: '00000000000000000000000902', title: 'a'.repeat(201) })
        .run(),
    ).toThrow()
  })
})
