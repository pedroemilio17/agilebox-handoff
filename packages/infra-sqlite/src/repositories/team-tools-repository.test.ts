import { afterEach, describe, expect, it } from 'vitest'
import {
  describeTeamToolsRepositoryContract,
  teamToolsFixtures,
} from '@agilebox/application/testing'
import { createUser } from '@agilebox/core'
import type { OrganizationId, UserId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { organizations, users } from '../schema/index.js'
import { createSqliteTeamToolsRepository } from './team-tools-repository.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const { organizationA, organizationB, managerA, managerB } = teamToolsFixtures
const openDatabases: ReturnType<typeof createSqliteClient>[] = []

function setup() {
  const database = createSqliteClient(':memory:')
  openDatabases.push(database)
  database
    .insert(organizations)
    .values([
      { id: organizationA, name: 'A', createdAt },
      { id: organizationB, name: 'B', createdAt },
    ])
    .run()
  database
    .insert(users)
    .values([manager(managerA, organizationA), manager(managerB, organizationB)])
    .run()
  return { database, repository: createSqliteTeamToolsRepository(database) }
}

function manager(id: UserId, organizationId: OrganizationId) {
  return createUser({
    id,
    organizationId,
    name: 'Gestora',
    email: `${id}@example.com`,
    role: 'manager',
    defaultRateCents: 4500,
    createdAt,
  })
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.$client.close()
})

describeTeamToolsRepositoryContract('SQLite', () => Promise.resolve(setup().repository))

describe('ajustes da equipe no SQLite', () => {
  it('a falha no meio da gravação desfaz nível, ferramentas e auditoria já escritos', async () => {
    const { database, repository } = setup()
    // A última escrita do pedido (a auditoria) falha: o que veio antes precisa sumir também.
    database.$client.exec(
      "CREATE TRIGGER falha_auditoria BEFORE INSERT ON team_tools_audit BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;",
    )

    await expect(
      repository.saveSettings(
        organizationA,
        { level: 'basic', modules: [{ moduleId: 'burndown', state: 'disabled' }] },
        managerA,
        createdAt,
      ),
    ).rejects.toThrow('falha simulada')

    const count = (table: string) =>
      (
        database.$client.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as {
          total: number
        }
      ).total
    expect(count('team_preferences')).toBe(0)
    expect(count('team_modules')).toBe(0)
    expect((await repository.getSettings(organizationA)).level).toBe('advanced')
  })

  it('guarda quem mudou o nível e quando, e não mexe na autoria quando o nível não muda', async () => {
    const { database, repository } = setup()
    await repository.saveSettings(
      organizationA,
      { level: 'intermediate', modules: [] },
      managerA,
      '2026-02-01T00:00:00.000Z',
    )
    await repository.saveSettings(
      organizationA,
      { level: 'intermediate', modules: [{ moduleId: 'checkins', state: 'disabled' }] },
      managerA,
      '2026-03-01T00:00:00.000Z',
    )

    expect(
      database.$client
        .prepare('SELECT changed_by AS by, changed_at AS at FROM team_preferences')
        .get(),
    ).toEqual({ by: managerA, at: '2026-02-01T00:00:00.000Z' })
  })

  it('o banco aceita uma só preferência por organização', async () => {
    const { database, repository } = setup()
    await repository.saveSettings(
      organizationA,
      { level: 'basic', modules: [] },
      managerA,
      createdAt,
    )
    expect(() =>
      database.$client
        .prepare('INSERT INTO team_preferences (organization_id, experience_level) VALUES (?, ?)')
        .run(organizationA, 'basic'),
    ).toThrow(/UNIQUE|PRIMARY/u)
  })

  it('o banco recusa nível e estado fora do conjunto, mesmo que o domínio falhe', () => {
    const { database } = setup()
    expect(() =>
      database.$client
        .prepare('INSERT INTO team_preferences (organization_id, experience_level) VALUES (?, ?)')
        .run(organizationA, 'expert'),
    ).toThrow(/CHECK/u)
    expect(() =>
      database.$client
        .prepare('INSERT INTO team_modules (organization_id, module_id, state) VALUES (?, ?, ?)')
        .run(organizationA, 'agenda', 'pausado'),
    ).toThrow(/CHECK/u)
  })
})
