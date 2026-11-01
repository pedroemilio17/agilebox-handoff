import { describe, expect, it } from 'vitest'
import { toOrganizationId } from '@agilebox/core'
import { InMemoryUnitOfWork } from './in-memory-unit-of-work'
import { FixedClock } from './fixed-clock'
import { SequentialIdGenerator } from './sequential-id-generator'
import { RecordingNotifier } from './recording-notifier'
import { aUser } from '../builders'

const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')

describe('fakes da aplicação', () => {
  it('usa o instante fixado no relógio', async () => {
    const clock = new FixedClock('2026-10-31T12:00:00.000Z')
    await expect(clock.now(organizationId)).resolves.toBe('2026-10-31T12:00:00.000Z')
  })

  it('gera identificadores sequenciais válidos', async () => {
    const ids = new SequentialIdGenerator()
    await expect(ids.generate(organizationId)).resolves.toBe('00000000000000000000000000')
    await expect(ids.generate(organizationId)).resolves.toBe('00000000000000000000000001')
  })

  it('registra notificações publicadas', async () => {
    const notifier = new RecordingNotifier()
    const change = { kind: 'task' as const, ids: [] }
    await notifier.publish(organizationId, change)
    expect(notifier.changes).toEqual([{ organizationId, change }])
  })

  it('desfaz todas as gravações quando a operação falha', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const user = aUser().build()
    await expect(
      unitOfWork.run(organizationId, async ({ users }) => {
        await users.save(organizationId, user)
        throw new Error('falha simulada')
      }),
    ).rejects.toThrow('falha simulada')
    await expect(unitOfWork.repositories.users.list(organizationId)).resolves.toEqual([])
  })

  it('mantém os dados isolados por organização', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const user = aUser().build()
    const otherOrganization = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
    await unitOfWork.repositories.users.save(organizationId, user)
    await expect(unitOfWork.repositories.users.list(otherOrganization)).resolves.toEqual([])
  })
})
