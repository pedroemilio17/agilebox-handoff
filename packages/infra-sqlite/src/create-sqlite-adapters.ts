import { createSqliteClient } from './client.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { createSqliteTeamRepositories } from './repositories/team-repositories.js'
import { createSqliteUnitOfWork } from './unit-of-work.js'
import { organizations } from './schema/index.js'
import { toOrganizationId } from '@agilebox/core'
import type { Organization } from '@agilebox/core'

export function createSqliteAdapters(filename: string, migrationsFolder?: string) {
  const database = createSqliteClient(filename, migrationsFolder)
  return createSqliteAdaptersForDatabase(database)
}

export function createSqliteAdaptersForDatabase(database: ReturnType<typeof createSqliteClient>) {
  const teamRepositories = createSqliteTeamRepositories(database)
  const repositories = {
    ...createSqliteCoreRepositories(database),
    ...createSqliteTaskRepositories(database),
    meetings: createSqliteMeetingRepository(database),
    teamModuleEvents: teamRepositories.teamModuleEvents,
    teamModules: teamRepositories.teamModules,
    teamSettings: teamRepositories.teamSettings,
  }
  return {
    ...repositories,
    unitOfWork: createSqliteUnitOfWork(database, repositories),
    async hasOrganizations() {
      const [row] = await database.select({ id: organizations.id }).from(organizations).limit(1)
      return row !== undefined
    },
    async getFirstOrganizationId() {
      const [row] = await database.select({ id: organizations.id }).from(organizations).limit(1)
      return row ? toOrganizationId(row.id) : null
    },
    async saveOrganization(organization: Organization) {
      await database.insert(organizations).values(organization)
    },
    settings: {
      get(key: string) {
        const row = database.$client
          .prepare('SELECT value FROM local_settings WHERE key = ?')
          .get(key) as { value: string } | undefined
        return row?.value
      },
      set(key: string, value: string) {
        database.$client
          .prepare(
            'INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          )
          .run(key, value)
      },
    },
    close: () => database.$client.close(),
  }
}
