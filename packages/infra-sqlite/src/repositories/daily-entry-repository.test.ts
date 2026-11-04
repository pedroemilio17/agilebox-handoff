import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aProject, aTask } from '@agilebox/application/testing'
import {
  createDailyEntry,
  createUser,
  parseDateOnly,
  toDailyEntryId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { DailyEntry } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { dailyEntries, organizations, users } from '../schema/index.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteDailyEntryRepository } from './daily-entry-repository.js'
import { createSqliteTaskRepositories } from './task-repositories.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const managerA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB0')
const anaA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB1')
const managerB = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB2')
const taskA = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB3')
const taskB = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB4')
const entryOne = toDailyEntryId('01ARZ3NDEKTSV4RRFFQ69G5FB5')
const entryTwo = toDailyEntryId('01ARZ3NDEKTSV4RRFFQ69G5FB6')
const today = parseDateOnly('2026-11-04')

function entry(overrides: Partial<Parameters<typeof createDailyEntry>[0]> = {}): DailyEntry {
  return createDailyEntry({
    id: entryOne,
    organizationId: orgA,
    userId: anaA,
    date: '2026-11-04',
    answers: { progress: 'Revisei a API.', nextStep: '', blocker: '' },
    noNews: false,
    taskRefs: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  })
}

async function setup() {
  const database = createSqliteClient(':memory:')
  database
    .insert(organizations)
    .values([
      { id: orgA, name: 'A', createdAt },
      { id: orgB, name: 'B', createdAt },
    ])
    .run()
  const core = createSqliteCoreRepositories(database)
  const people = [
    [orgA, managerA, 'Gestora', 'manager'],
    [orgA, anaA, 'Ana', 'collaborator'],
    [orgB, managerB, 'Outra', 'manager'],
  ] as const
  for (const [organizationId, id, name, role] of people) {
    await core.users.save(
      organizationId,
      createUser({
        id,
        organizationId,
        name,
        email: `${name.toLowerCase()}@test.example`,
        role,
        defaultRateCents: 0,
        createdAt,
      }),
    )
  }
  const project = aProject().with({ createdBy: managerA }).build()
  await core.projects.save(orgA, project)
  await createSqliteTaskRepositories(database).tasks.save(
    orgA,
    aTask().inProject(project).with({ id: taskA, createdBy: managerA }).build(),
  )
  const projectB = aProject()
    .with({
      id: toProjectId('01ARZ3NDEKTSV4RRFFQ69G5FB8'),
      organizationId: orgB,
      createdBy: managerB,
      name: 'Projeto B',
    })
    .build()
  await core.projects.save(orgB, projectB)
  await createSqliteTaskRepositories(database).tasks.save(
    orgB,
    aTask()
      .inProject(projectB)
      .with({
        id: taskB,
        organizationId: orgB,
        createdBy: managerB,
        responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB7'),
      })
      .build(),
  )
  const repository = createSqliteDailyEntryRepository(database)
  return { database, repository }
}

describe('repositório de dailies', () => {
  it('grava, lê por pessoa e data, lista por data e preserva as citações', async () => {
    const { repository } = await setup()
    await repository.save(orgA, entry({ taskRefs: [taskA] }))
    const found = await repository.findByUserAndDate(orgA, anaA, today)
    expect(found).toMatchObject({
      id: entryOne,
      userId: anaA,
      date: '2026-11-04',
      answers: { progress: 'Revisei a API.', nextStep: '', blocker: '' },
      noNews: false,
      taskRefs: [taskA],
    })
    await expect(repository.listByDate(orgA, today)).resolves.toHaveLength(1)
    await expect(
      repository.findByUserAndDate(orgA, anaA, parseDateOnly('2026-11-03')),
    ).resolves.toBeNull()
  })

  it('atualiza pelo id e mantém o createdAt', async () => {
    const { repository } = await setup()
    await repository.save(orgA, entry())
    await repository.save(
      orgA,
      entry({
        answers: { progress: '', nextStep: '', blocker: 'Sem acesso.' },
        updatedAt: '2026-11-04T15:00:00.000Z',
      }),
    )
    await expect(repository.findByUserAndDate(orgA, anaA, today)).resolves.toMatchObject({
      createdAt,
      updatedAt: '2026-11-04T15:00:00.000Z',
      answers: { blocker: 'Sem acesso.' },
    })
  })

  it('o índice único impede duas dailies da mesma pessoa no mesmo dia', async () => {
    const { repository } = await setup()
    await repository.save(orgA, entry())
    await expect(repository.save(orgA, entry({ id: entryTwo }))).rejects.toThrow(/UNIQUE/)
  })

  it('isola organizações: não grava daily de usuário de outra organização', async () => {
    const { repository } = await setup()
    await repository.save(orgA, entry({ organizationId: orgB, userId: managerB }))
    await expect(repository.listByDate(orgA, today)).resolves.toEqual([])
    await expect(repository.listByDate(orgB, today)).resolves.toEqual([])
  })

  it('isola organizações: não grava citação de tarefa de outra organização', async () => {
    const { repository } = await setup()
    await repository.save(orgA, entry({ taskRefs: [taskB] }))
    await expect(repository.listByDate(orgA, today)).resolves.toEqual([])
  })

  it('a tabela tem organization_id obrigatório e limite de 500 caracteres no banco', async () => {
    const { database } = await setup()
    const columns = database.$client.prepare("PRAGMA table_info('daily_entries')").all() as {
      name: string
      notnull: number
    }[]
    expect(columns.find((column) => column.name === 'organization_id')?.notnull).toBe(1)
    expect(() =>
      database
        .insert(dailyEntries)
        .values({
          id: entryTwo,
          organizationId: orgA,
          userId: anaA,
          date: '2026-11-04',
          progress: 'a'.repeat(501),
          nextStep: '',
          blocker: '',
          noNews: false,
          taskRefs: '[]',
          createdAt,
          updatedAt: createdAt,
        })
        .run(),
    ).toThrow()
  })

  it('excluir o usuário apaga as dailies dele (CASCADE)', async () => {
    const { database, repository } = await setup()
    await repository.save(orgA, entry())
    database.delete(users).where(eq(users.id, anaA)).run()
    expect(database.select().from(dailyEntries).all()).toEqual([])
  })
})
