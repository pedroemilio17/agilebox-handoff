import { describe, expect, it } from 'vitest'
import { parseDateOnly, toOrganizationId } from '@agilebox/core'
import { aMeeting, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteMeetingRepository } from './meeting-repository.js'

describe('repositório SQLite de agenda', () => {
  it('persiste agendamentos e participantes e filtra por mês e data futura', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    await createSqliteCoreRepositories(database).users.save(organizationId, user)
    const repository = createSqliteMeetingRepository(database)
    const meeting = aMeeting().with({ organizationId, createdBy: user.id }).build()

    await repository.save(organizationId, meeting)

    await expect(repository.findById(organizationId, meeting.id)).resolves.toEqual(meeting)
    await expect(repository.listByMonth(organizationId, '2026-01')).resolves.toEqual([meeting])
    await expect(
      repository.listUpcoming(organizationId, parseDateOnly('2026-01-15')),
    ).resolves.toEqual([meeting])
    await expect(
      repository.listUpcoming(organizationId, parseDateOnly('2026-01-16')),
    ).resolves.toEqual([])
    database.$client.close()
  })

  it('não lê nem remove agendamento de outra organização', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const otherOrganizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
    const user = aUser().with({ organizationId }).build()
    await database.insert(organizations).values([
      { id: organizationId, name: 'A', createdAt: user.createdAt },
      { id: otherOrganizationId, name: 'B', createdAt: user.createdAt },
    ])
    await createSqliteCoreRepositories(database).users.save(organizationId, user)
    const repository = createSqliteMeetingRepository(database)
    const meeting = aMeeting().with({ organizationId, createdBy: user.id }).build()
    await repository.save(organizationId, meeting)

    await expect(repository.findById(otherOrganizationId, meeting.id)).resolves.toBeNull()
    await repository.remove(otherOrganizationId, meeting.id)
    await expect(repository.findById(organizationId, meeting.id)).resolves.toEqual(meeting)
    database.$client.close()
  })
})
