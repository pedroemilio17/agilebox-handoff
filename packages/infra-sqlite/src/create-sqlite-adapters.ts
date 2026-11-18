import { createSqliteClient } from './client.js'
import { createSqliteAcceptanceRepository } from './repositories/acceptance-repository.js'
import { createSqliteBoardSettingsRepository } from './repositories/board-settings-repository.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteDailyEntryRepository } from './repositories/daily-entry-repository.js'
import { createSqliteDefinitionOfDoneRepository } from './repositories/definition-of-done-repository.js'
import { createSqliteDeliverableRepositories } from './repositories/deliverable-repository.js'
import { createSqliteGuideProgressRepository } from './repositories/guide-progress-repository.js'
import { createSqliteImpedimentRepository } from './repositories/impediment-repository.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteProjectModulesRepository } from './repositories/project-modules-repository.js'
import { createSqliteProjectSetupRepository } from './repositories/project-setup-repository.js'
import { createSqliteRetroActionRepository } from './repositories/retro-action-repository.js'
import { createSqliteSprintRepositories } from './repositories/sprint-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { createSqliteTaskDependencyRepository } from './repositories/task-dependency-repository.js'
import { createSqliteTeamToolsRepository } from './repositories/team-tools-repository.js'
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
    acceptance: createSqliteAcceptanceRepository(database),
    ...createSqliteTaskRepositories(database),
    meetings: createSqliteMeetingRepository(database),
    retroActions: createSqliteRetroActionRepository(database),
    comments: createSqliteTaskCommentRepository(database),
    boardSettings: createSqliteBoardSettingsRepository(database),
    definitionOfDone: createSqliteDefinitionOfDoneRepository(database),
    guideProgress: createSqliteGuideProgressRepository(database),
    impediments: createSqliteImpedimentRepository(database),
    dailyEntries: createSqliteDailyEntryRepository(database),
    teamTools: createSqliteTeamToolsRepository(database),
    projectModules: createSqliteProjectModulesRepository(database),
    projectSetup: createSqliteProjectSetupRepository(database),
    ...createSqliteDeliverableRepositories(database),
    taskDependencies: createSqliteTaskDependencyRepository(database),
    ...createSqliteSprintRepositories(database),
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
