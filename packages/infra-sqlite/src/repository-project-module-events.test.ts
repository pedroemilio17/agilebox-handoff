import { afterEach, describe, expect, it } from 'vitest'
import {
  describeProjectModuleEventRepositoryContract,
  projectModulesFixtures,
  projectModulesSeed,
} from '@agilebox/application/testing'
import { createSqliteClient } from './client.js'
import { createSqliteProjectModuleEventRepository } from './repositories/project-module-event-repository.js'
import { organizations, projects, users } from './schema/index.js'

const { organizationA, organizationB } = projectModulesFixtures
const openDatabases: ReturnType<typeof createSqliteClient>[] = []
const createdAt = '2026-01-01T00:00:00.000Z'

function setup() {
  const database = createSqliteClient(':memory:')
  openDatabases.push(database)
  const { users: seededUsers, projects: seededProjects } = projectModulesSeed()
  database
    .insert(organizations)
    .values([
      { id: organizationA, name: 'A', createdAt },
      { id: organizationB, name: 'B', createdAt },
    ])
    .run()
  database.insert(users).values(seededUsers).run()
  database.insert(projects).values(seededProjects).run()
  return { database, repository: createSqliteProjectModuleEventRepository(database) }
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.$client.close()
})

describeProjectModuleEventRepositoryContract('SQLite', () => Promise.resolve(setup().repository))

describe('histórico de módulos por projeto no SQLite', () => {
  it('recusa gravar evento de outra organização, sem gravar nada', async () => {
    const { database, repository } = setup()

    await expect(
      repository.append(organizationA, [
        {
          organizationId: organizationB,
          projectId: projectModulesFixtures.projectA,
          moduleId: 'sprints',
          action: 'enabled',
          actorId: projectModulesFixtures.managerA,
          actorRole: 'manager',
          auto: false,
          relatedModuleId: null,
          at: createdAt,
        },
      ]),
    ).rejects.toMatchObject({ name: 'ValidationError' })
    expect(
      database.$client.prepare('SELECT COUNT(*) AS n FROM project_module_events').get(),
    ).toEqual({
      n: 0,
    })
  })

  it('recusa ação fora do conjunto no banco (CHECK)', () => {
    const { database } = setup()

    expect(() =>
      database.$client
        .prepare(
          `INSERT INTO project_module_events
           (organization_id, project_id, module_id, action, actor_id, actor_role, auto, related_module_id, at)
           VALUES (?, ?, 'sprints', 'apagado', ?, 'manager', 0, NULL, ?)`,
        )
        .run(
          organizationA,
          projectModulesFixtures.projectA,
          projectModulesFixtures.managerA,
          createdAt,
        ),
    ).toThrow(/CHECK/)
  })
})
