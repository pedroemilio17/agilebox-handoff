import { describe, expect, it } from 'vitest'
import { parseDateOnly, toMeetingId, toOrganizationId } from '@agilebox/core'
import { aMeeting, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteMeetingRepository } from './meeting-repository.js'

describe('repositório SQLite de agenda', () => {
  it('persiste agendamentos, série e participantes e filtra pelo intervalo', async () => {
    const database = createSqliteClient(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    await createSqliteCoreRepositories(database).users.save(organizationId, user)
    const repository = createSqliteMeetingRepository(database)
    const meeting = aMeeting().with({ organizationId, createdBy: user.id }).build()
    const series = aMeeting()
      .with({
        id: toMeetingId('01ARZ3NDEKTSV4RRFFQ69G5FB0'),
        organizationId,
        createdBy: user.id,
        date: parseDateOnly('2026-02-25'),
        time: '09:00',
        endTime: '10:30',
        kind: 'retro',
        recurrence: 'weekly',
        recurrenceUntil: parseDateOnly('2026-03-11'),
      })
      .build()

    await repository.save(organizationId, meeting)
    await repository.save(organizationId, series)

    await expect(repository.findById(organizationId, meeting.id)).resolves.toEqual(meeting)
    await expect(repository.findById(organizationId, series.id)).resolves.toEqual(series)
    await expect(
      repository.listOverlapping(
        organizationId,
        parseDateOnly('2026-01-01'),
        parseDateOnly('2026-01-31'),
      ),
    ).resolves.toEqual([meeting])
    // Série de 25/02 a 11/03: a janela de março pega a série inteira como candidata.
    await expect(
      repository.listOverlapping(
        organizationId,
        parseDateOnly('2026-03-01'),
        parseDateOnly('2026-03-31'),
      ),
    ).resolves.toEqual([series])
    await expect(
      repository.listOverlapping(
        organizationId,
        parseDateOnly('2026-03-12'),
        parseDateOnly('2026-03-31'),
      ),
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
