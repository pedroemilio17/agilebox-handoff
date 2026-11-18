import { describe, expect, it } from 'vitest'
import { toOrganizationId } from '@agilebox/core'
import { aMeeting, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from './client.js'
import { organizations } from './schema/organizations.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteImpedimentRepository } from './repositories/impediment-repository.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteRetroActionRepository } from './repositories/retro-action-repository.js'
import { createSqliteDailyEntryRepository } from './repositories/daily-entry-repository.js'
import { createSqliteAcceptanceRepository } from './repositories/acceptance-repository.js'
import { createSqliteBoardSettingsRepository } from './repositories/board-settings-repository.js'
import { createSqliteProjectModulesRepository } from './repositories/project-modules-repository.js'
import { createSqliteGuideProgressRepository } from './repositories/guide-progress-repository.js'
import { createSqliteProjectSetupRepository } from './repositories/project-setup-repository.js'
import { createSqliteTeamToolsRepository } from './repositories/team-tools-repository.js'
import { createSqliteSprintRepositories } from './repositories/sprint-repository.js'
import { createSqliteDefinitionOfDoneRepository } from './repositories/definition-of-done-repository.js'
import { createSqliteTaskCommentRepository } from './repositories/task-comment-repository.js'
import { createSqliteDeliverableRepositories } from './repositories/deliverable-repository.js'
import { createSqliteRiskRepository } from './repositories/risk-repository.js'
import { createSqliteTaskDependencyRepository } from './repositories/task-dependency-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { createSqliteUnitOfWork } from './unit-of-work.js'

describe('SqliteUnitOfWork', () => {
  it('desfaz todas as gravações quando a operação falha', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    await createSqliteCoreRepositories(database).users.save(organizationId, user)
    const meetings = createSqliteMeetingRepository(database)
    const unitOfWork = createSqliteUnitOfWork(database, {
      ...createSqliteCoreRepositories(database),
      ...createSqliteTaskRepositories(database),
      ...createSqliteDeliverableRepositories(database),
      risks: createSqliteRiskRepository(database),
      taskDependencies: createSqliteTaskDependencyRepository(database),
      acceptance: createSqliteAcceptanceRepository(database),
      impediments: createSqliteImpedimentRepository(database),
      boardSettings: createSqliteBoardSettingsRepository(database),
      teamTools: createSqliteTeamToolsRepository(database),
      projectModules: createSqliteProjectModulesRepository(database),
      projectSetup: createSqliteProjectSetupRepository(database),
      ...createSqliteSprintRepositories(database),
      definitionOfDone: createSqliteDefinitionOfDoneRepository(database),
      guideProgress: createSqliteGuideProgressRepository(database),
      comments: createSqliteTaskCommentRepository(database),
      meetings,
      retroActions: createSqliteRetroActionRepository(database),
      dailyEntries: createSqliteDailyEntryRepository(database),
    })
    const meeting = aMeeting().with({ organizationId, createdBy: user.id }).build()

    await expect(
      unitOfWork.run(organizationId, async (repositories) => {
        await repositories.meetings.save(organizationId, meeting)
        throw new Error('falha simulada')
      }),
    ).rejects.toThrow('falha simulada')

    await expect(meetings.findById(organizationId, meeting.id)).resolves.toBeNull()
    database.$client.close()
  })

  it('confirma gravações quando a operação termina', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    const meetings = createSqliteMeetingRepository(database)
    const unitOfWork = createSqliteUnitOfWork(database, {
      ...core,
      ...createSqliteTaskRepositories(database),
      ...createSqliteDeliverableRepositories(database),
      risks: createSqliteRiskRepository(database),
      taskDependencies: createSqliteTaskDependencyRepository(database),
      acceptance: createSqliteAcceptanceRepository(database),
      impediments: createSqliteImpedimentRepository(database),
      boardSettings: createSqliteBoardSettingsRepository(database),
      teamTools: createSqliteTeamToolsRepository(database),
      projectModules: createSqliteProjectModulesRepository(database),
      projectSetup: createSqliteProjectSetupRepository(database),
      ...createSqliteSprintRepositories(database),
      definitionOfDone: createSqliteDefinitionOfDoneRepository(database),
      guideProgress: createSqliteGuideProgressRepository(database),
      comments: createSqliteTaskCommentRepository(database),
      meetings,
      retroActions: createSqliteRetroActionRepository(database),
      dailyEntries: createSqliteDailyEntryRepository(database),
    })
    const meeting = aMeeting().with({ organizationId, createdBy: user.id }).build()

    await unitOfWork.run(organizationId, (repositories) =>
      repositories.meetings.save(organizationId, meeting),
    )

    await expect(meetings.findById(organizationId, meeting.id)).resolves.toEqual(meeting)
    database.$client.close()
  })
})
