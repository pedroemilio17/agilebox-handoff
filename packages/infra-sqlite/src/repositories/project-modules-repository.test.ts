import { afterEach, describe, expect, it } from 'vitest'
import {
  describeProjectModulesRepositoryContract,
  projectModulesFixtures,
  projectModulesSeed,
} from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations, projects, users } from '../schema/index.js'
import { createSqliteProjectModulesRepository } from './project-modules-repository.js'

const { organizationA, organizationB, managerA, projectA } = projectModulesFixtures
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
  return { database, repository: createSqliteProjectModulesRepository(database) }
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.$client.close()
})

describeProjectModulesRepositoryContract('SQLite', () => Promise.resolve(setup().repository))

describe('módulos do projeto no SQLite', () => {
  it('a falha no meio do pedido desfaz as linhas já escritas', async () => {
    const { database, repository } = setup()
    // A segunda linha do pedido falha: a primeira, já escrita, precisa sumir também.
    database.$client.exec(
      "CREATE TRIGGER falha_linha BEFORE INSERT ON project_modules WHEN NEW.module_id = 'backlog' BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;",
    )

    await expect(
      repository.save(
        organizationA,
        projectA,
        [
          { moduleId: 'agenda', state: 'active' },
          { moduleId: 'backlog', state: 'active' },
        ],
        managerA,
        createdAt,
      ),
    ).rejects.toThrow('falha simulada')

    expect(await repository.list(organizationA, projectA)).toEqual([])
  })
})
