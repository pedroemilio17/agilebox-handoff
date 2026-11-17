import { afterEach, describe, expect, it } from 'vitest'
import {
  describeProjectSetupRepositoryContract,
  projectModulesFixtures,
  projectModulesSeed,
} from '@agilebox/application/testing'
import { ValidationError } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { organizations, projects, users } from '../schema/index.js'
import { createSqliteProjectSetupRepository } from './project-setup-repository.js'
import { mapProjectSetupRow } from '../mappers/project-setup-mappers.js'

const { organizationA, organizationB, projectA } = projectModulesFixtures
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
  return { database, repository: createSqliteProjectSetupRepository(database) }
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.$client.close()
})

describeProjectSetupRepositoryContract('SQLite', () => Promise.resolve(setup().repository))

describe('configuração do projeto no SQLite', () => {
  it('a coluna answers guarda o JSON das respostas e volta como objeto', async () => {
    const { database, repository } = setup()
    const answers = { workType: 'finite', experience: 'never' } as const
    await repository.save(organizationA, {
      projectId: projectA,
      answers,
      recommendedPreset: 'simples',
      startedFromPreset: 'simples',
      guideLevel: 'never',
    })

    const [row] = database.$client
      .prepare('SELECT answers FROM project_setup WHERE project_id = ?')
      .all(projectA) as { answers: string }[]
    expect(JSON.parse(row?.answers ?? 'null')).toEqual(answers)
    expect(await repository.get(organizationA, projectA)).toEqual(
      expect.objectContaining({ answers }),
    )
  })

  it('o banco recusa preset fora do catálogo (CHECK), e o mapper recusa linha inválida', async () => {
    const { database, repository } = setup()
    await repository.save(organizationA, {
      projectId: projectA,
      answers: null,
      recommendedPreset: 'simples',
      startedFromPreset: 'simples',
      guideLevel: 'never',
    })
    expect(() =>
      database.$client.exec("UPDATE project_setup SET started_from_preset = 'cascata'"),
    ).toThrow(/CHECK constraint failed/)

    expect(() =>
      mapProjectSetupRow({
        projectId: projectA,
        organizationId: organizationA,
        answers: null,
        recommendedPreset: null,
        startedFromPreset: 'cascata',
        guideLevel: null,
      }),
    ).toThrow(ValidationError)
  })
})
