import { describe, expect, it } from 'vitest'
import { toOrganizationId, toUserId } from '@agilebox/core'
import { aMeeting, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from './client.js'
import { organizations } from './schema/organizations.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { createSqliteTeamRepositories } from './repositories/team-repositories.js'
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
      ...createSqliteTeamRepositories(database),
      meetings,
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
      ...createSqliteTeamRepositories(database),
      meetings,
    })
    const meeting = aMeeting().with({ organizationId, createdBy: user.id }).build()

    await unitOfWork.run(organizationId, (repositories) =>
      repositories.meetings.save(organizationId, meeting),
    )

    await expect(meetings.findById(organizationId, meeting.id)).resolves.toEqual(meeting)
    database.$client.close()
  })

  it('desfaz a mudança de módulo junto com o histórico quando a operação falha', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    await core.users.save(organizationId, user)
    const team = createSqliteTeamRepositories(database)
    const unitOfWork = createSqliteUnitOfWork(database, {
      ...core,
      ...createSqliteTaskRepositories(database),
      ...team,
      meetings: createSqliteMeetingRepository(database),
    })

    await expect(
      unitOfWork.run(organizationId, async (repositories) => {
        await repositories.teamModules.save(organizationId, {
          moduleId: 'sprints',
          state: 'active',
          config: {},
          changedBy: user.id,
          changedAt: user.createdAt,
        })
        await repositories.teamModuleEvents.append(organizationId, {
          id: 'event-1',
          moduleId: 'sprints',
          fromState: 'disabled',
          toState: 'active',
          changedBy: toUserId(user.id),
          changedAt: user.createdAt,
        })
        throw new Error('falha simulada')
      }),
    ).rejects.toThrow('falha simulada')

    await expect(team.teamModules.list(organizationId)).resolves.toEqual([])
    await expect(team.teamModuleEvents.list(organizationId)).resolves.toEqual([])
    database.$client.close()
  })
})
