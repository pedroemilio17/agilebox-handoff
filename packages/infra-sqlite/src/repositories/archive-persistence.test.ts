import { describe, expect, it } from 'vitest'
import {
  archiveProject,
  archiveTask,
  toOrganizationId,
  unarchiveProject,
  unarchiveTask,
} from '@agilebox/core'
import { aProject, aTask, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteTaskRepositories } from './task-repositories.js'

const archivedAt = '2026-02-01T10:00:00.000Z'

async function setup() {
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
  const tasks = createSqliteTaskRepositories(database)
  const task = aTask()
    .with({ organizationId, projectId: project.id, projectName: project.name, createdBy: user.id })
    .build()
  await tasks.tasks.save(organizationId, task)
  return { database, organizationId, user, project, task, core, tasks }
}

describe('persistência do arquivamento', () => {
  it('grava e devolve a tarefa arquivada com quando e quem, e desarquivada volta limpa', async () => {
    const { database, organizationId, user, task, tasks } = await setup()
    const archived = archiveTask(task, user.id, archivedAt)
    await tasks.tasks.save(organizationId, archived)
    await expect(tasks.tasks.findById(organizationId, task.id)).resolves.toEqual(archived)

    await tasks.tasks.save(organizationId, unarchiveTask(archived))
    await expect(tasks.tasks.findById(organizationId, task.id)).resolves.toEqual(task)
    database.$client.close()
  })

  it('grava e devolve o projeto arquivado e desarquivado', async () => {
    const { database, organizationId, user, project, core } = await setup()
    const archived = archiveProject(project, user.id, archivedAt)
    await core.projects.save(organizationId, archived)
    await expect(core.projects.findById(organizationId, project.id)).resolves.toEqual(archived)
    await expect(core.projects.list(organizationId)).resolves.toEqual([archived])

    await core.projects.save(organizationId, unarchiveProject(archived))
    await expect(core.projects.findById(organizationId, project.id)).resolves.toEqual(project)
    database.$client.close()
  })

  it('o projeto arquivado de uma organização não aparece para outra', async () => {
    const { database, user, project, core, organizationId } = await setup()
    const foreign = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAZ')
    await database
      .insert(organizations)
      .values({ id: foreign, name: 'Outra', createdAt: user.createdAt })
    await core.projects.save(organizationId, archiveProject(project, user.id, archivedAt))
    await expect(core.projects.findById(foreign, project.id)).resolves.toBeNull()
    await expect(core.projects.list(foreign)).resolves.toEqual([])
    await expect(core.projects.findById(organizationId, project.id)).resolves.toMatchObject({
      archivedAt,
    })
    database.$client.close()
  })
})
