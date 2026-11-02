import { describe, expect, it } from 'vitest'
import { toEventId, toOrganizationId, toParticipationId, toTaskId, toUserId } from '@agilebox/core'
import { aProject, aTask, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { taskOpens } from '../schema/task-opens.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteTaskRepositories } from './task-repositories.js'

describe('repositórios SQLite de tarefas, envolvimentos, linha do tempo e aberturas', () => {
  it('persiste a tarefa com envolvimentos e carrega o nome do projeto', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    await core.projects.save(organizationId, project)
    const task = aTask()
      .with({ organizationId, projectId: project.id, projectName: project.name })
      .build()
    const repositories = createSqliteTaskRepositories(database)

    await repositories.tasks.save(organizationId, task)

    await expect(repositories.tasks.findById(organizationId, task.id)).resolves.toEqual(task)
    await expect(repositories.participations.listByTask(organizationId, task.id)).resolves.toEqual(
      task.participations,
    )
    database.$client.close()
  })

  it('isola tarefas e registros filhos entre organizações', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const otherOrganizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
    const user = aUser().with({ organizationId }).build()
    const otherUser = aUser()
      .with({ id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX'), organizationId: otherOrganizationId })
      .build()
    await database.insert(organizations).values([
      { id: organizationId, name: 'A', createdAt: user.createdAt },
      { id: otherOrganizationId, name: 'B', createdAt: user.createdAt },
    ])
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    await core.users.save(otherOrganizationId, otherUser)
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    await core.projects.save(organizationId, project)
    const task = aTask().with({ organizationId, projectId: project.id }).build()
    const repositories = createSqliteTaskRepositories(database)
    await repositories.tasks.save(organizationId, task)

    await expect(repositories.tasks.findById(otherOrganizationId, task.id)).resolves.toBeNull()
    await expect(
      repositories.tasks.listByProject(otherOrganizationId, project.id),
    ).resolves.toEqual([])
    await expect(
      repositories.participations.listByTask(otherOrganizationId, task.id),
    ).resolves.toEqual([])
    await expect(repositories.timeline.listByTask(otherOrganizationId, task.id)).resolves.toEqual(
      [],
    )
    database.$client.close()
  })

  it('lista eventos do mais recente para o mais antigo e soma aberturas por usuário', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    await core.projects.save(organizationId, project)
    const task = aTask().with({ organizationId, projectId: project.id }).build()
    const repositories = createSqliteTaskRepositories(database)
    await repositories.tasks.save(organizationId, task)
    const first = {
      id: toEventId('01ARZ3NDEKTSV4RRFFQ69G5FB1'),
      taskId: task.id,
      at: '2026-01-01T10:00:00.000Z',
      actorUserId: user.id,
      asManager: false,
      type: 'task_created' as const,
      payload: {},
    }
    const second = {
      ...first,
      id: toEventId('01ARZ3NDEKTSV4RRFFQ69G5FB2'),
      at: '2026-01-02T10:00:00.000Z',
    }
    await repositories.timeline.saveMany(organizationId, [first, second])
    await repositories.taskOpens.recordOpen(organizationId, task.id, user.id, first.at)
    await repositories.taskOpens.recordOpen(organizationId, task.id, user.id, second.at)

    await expect(repositories.timeline.listByTask(organizationId, task.id)).resolves.toEqual([
      second,
      first,
    ])
    await expect(repositories.tasks.listFrequent(organizationId, user.id)).resolves.toEqual([task])
    await repositories.taskOpens.recordOpen(
      organizationId,
      task.id,
      user.id,
      '2026-01-03T10:00:00.000Z',
    )
    await expect(database.select().from(taskOpens)).resolves.toMatchObject([
      { userId: user.id, taskId: task.id, lastOpenedAt: '2026-01-03T10:00:00.000Z', openCount: 3 },
    ])
    await expect(repositories.tasks.listFrequent(organizationId, user.id)).resolves.toEqual([task])
    database.$client.close()
  })

  it('não inclui tarefa de outra pessoa nas listas pessoais', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    const otherUser = aUser()
      .with({
        id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX'),
        organizationId,
        email: 'bia@example.com',
      })
      .build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    await core.users.save(organizationId, otherUser)
    await core.projects.save(organizationId, project)
    const mine = aTask()
      .with({
        organizationId,
        projectId: project.id,
        createdBy: user.id,
        responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
      })
      .build()
    const theirs = aTask()
      .with({
        id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB3'),
        organizationId,
        projectId: project.id,
        createdBy: otherUser.id,
        responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB6'),
      })
      .build()
    const repositories = createSqliteTaskRepositories(database)
    await repositories.tasks.save(organizationId, mine)
    await repositories.tasks.save(organizationId, theirs)

    await expect(repositories.tasks.listRecent(organizationId, user.id)).resolves.toEqual([mine])
    database.$client.close()
  })

  it('saveBacklogRanks é atômico no banco: falha no meio do lote desfaz as posições já gravadas (M3.9)', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    await core.projects.save(organizationId, project)
    const first = aTask()
      .with({
        id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB3'),
        organizationId,
        projectId: project.id,
        createdBy: user.id,
        responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB5'),
      })
      .build()
    const second = aTask()
      .with({
        id: toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB6'),
        organizationId,
        projectId: project.id,
        createdBy: user.id,
        responsibleParticipationId: toParticipationId('01ARZ3NDEKTSV4RRFFQ69G5FB7'),
      })
      .build()
    const repositories = createSqliteTaskRepositories(database)
    await repositories.tasks.save(organizationId, { ...first, backlogRank: 1, onBoard: false })
    await repositories.tasks.save(organizationId, { ...second, backlogRank: 2, onBoard: false })
    // Gatilho que falha só ao gravar a segunda tarefa do lote.
    database.$client.exec(
      `CREATE TRIGGER falha_posicao BEFORE UPDATE OF backlog_rank ON tasks WHEN NEW.id = '${second.id}' BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;`,
    )

    await expect(
      repositories.tasks.saveBacklogRanks(organizationId, [
        { id: first.id, backlogRank: 2 },
        { id: second.id, backlogRank: 1 },
      ]),
    ).rejects.toThrow('falha simulada')

    await expect(repositories.tasks.listBacklog(organizationId)).resolves.toMatchObject([
      { id: first.id, backlogRank: 1 },
      { id: second.id, backlogRank: 2 },
    ])
    database.$client.close()
  })
})
