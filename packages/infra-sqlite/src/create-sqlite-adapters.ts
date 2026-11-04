import { createSqliteClient } from './client.js'
import { createSqliteBoardSettingsRepository } from './repositories/board-settings-repository.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteDailyEntryRepository } from './repositories/daily-entry-repository.js'
import { createSqliteDefinitionOfDoneRepository } from './repositories/definition-of-done-repository.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteRetroActionRepository } from './repositories/retro-action-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { createSqliteTaskCommentRepository } from './repositories/task-comment-repository.js'
import { createSqliteUnitOfWork } from './unit-of-work.js'
import { organizations } from './schema/index.js'
import { toOrganizationId } from '@agilebox/core'
import type { Organization } from '@agilebox/core'

export function createSqliteAdapters(filename: string, migrationsFolder?: string) {
  const database = createSqliteClient(filename, migrationsFolder)
  return createSqliteAdaptersForDatabase(database)
}

export function createSqliteAdaptersForDatabase(database: ReturnType<typeof createSqliteClient>) {
  const repositories = {
    ...createSqliteCoreRepositories(database),
    ...createSqliteTaskRepositories(database),
    meetings: createSqliteMeetingRepository(database),
    retroActions: createSqliteRetroActionRepository(database),
    comments: createSqliteTaskCommentRepository(database),
    boardSettings: createSqliteBoardSettingsRepository(database),
    definitionOfDone: createSqliteDefinitionOfDoneRepository(database),
    dailyEntries: createSqliteDailyEntryRepository(database),
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
