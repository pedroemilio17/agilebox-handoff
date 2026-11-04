import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { aMeeting } from '@agilebox/application/testing'
import {
  createRetroAction,
  createUser,
  parseDateOnly,
  toMeetingId,
  toOrganizationId,
  toRetroActionId,
  toUserId,
} from '@agilebox/core'
import type { Meeting, RetroAction } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { meetings, organizations, retroActions, users } from '../schema/index.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteMeetingRepository } from './meeting-repository.js'
import { createSqliteRetroActionRepository } from './retro-action-repository.js'

const createdAt = '2026-01-01T00:00:00.000Z'
const orgA = toOrganizationId('00000000000000000000000001')
const orgB = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const managerA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB0')
const responsibleA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB1')
const managerB = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB2')
const retroA = toMeetingId('01ARZ3NDEKTSV4RRFFQ69G5FB3')
const retroB = toMeetingId('01ARZ3NDEKTSV4RRFFQ69G5FB4')
const actionOne = toRetroActionId('01ARZ3NDEKTSV4RRFFQ69G5FB5')
const actionTwo = toRetroActionId('01ARZ3NDEKTSV4RRFFQ69G5FB6')
const occurrence = parseDateOnly('2026-11-06')

function retro(id: Meeting['id'], organizationId: Meeting['organizationId']): Meeting {
  return aMeeting()
    .with({
      id,
      organizationId,
      kind: 'retro',
      recurrence: 'weekly',
      date: occurrence,
      time: '16:00',
      endTime: '17:00',
      participants: [],
      createdBy: organizationId === orgA ? managerA : managerB,
    })
    .build()
}

function action(overrides: Partial<RetroAction> = {}): RetroAction {
  return createRetroAction({
    id: actionOne,
    organizationId: orgA,
    meetingId: retroA,
    occurrenceDate: occurrence,
    title: 'Revisar prazos',
    responsibleId: responsibleA,
    dueDate: parseDateOnly('2026-11-13'),
    done: false,
    doneAt: null,
    createdAt,
    createdBy: managerA,
    ...overrides,
  })
}

async function setup() {
  const database = createSqliteClient(':memory:')
  database
    .insert(organizations)
    .values([
      { id: orgA, name: 'A', createdAt },
      { id: orgB, name: 'B', createdAt },
    ])
    .run()
  const core = createSqliteCoreRepositories(database)
  await core.users.save(
    orgA,
    createUser({
      id: managerA,
      organizationId: orgA,
      name: 'Gestora',
      email: 'g@a.test',
      role: 'manager',
      defaultRateCents: 0,
      createdAt,
    }),
  )
  await core.users.save(
    orgA,
    createUser({
      id: responsibleA,
      organizationId: orgA,
      name: 'Ana',
      email: 'a@a.test',
      role: 'collaborator',
      defaultRateCents: 0,
      createdAt,
    }),
  )
  await core.users.save(
    orgB,
    createUser({
      id: managerB,
      organizationId: orgB,
      name: 'Outra',
      email: 'o@b.test',
      role: 'manager',
      defaultRateCents: 0,
      createdAt,
    }),
  )
  const meetingRepository = createSqliteMeetingRepository(database)
  await meetingRepository.save(orgA, retro(retroA, orgA))
  await meetingRepository.save(orgB, retro(retroB, orgB))
  const repository = createSqliteRetroActionRepository(database)
  return { database, repository, meetingRepository }
}

describe('repositório de combinados da retro', () => {
  it('grava, lê por ocorrência e lista por agendamentos, em ordem de criação', async () => {
    const { repository } = await setup()
    await repository.save(orgA, action({ id: actionTwo, createdAt: '2026-11-06T17:00:00.000Z' }))
    await repository.save(orgA, action())
    const listed = await repository.listByOccurrence(orgA, retroA, occurrence)
    expect(listed.map((item) => item.id)).toEqual([actionOne, actionTwo])
    expect(listed[0]).toMatchObject({
      title: 'Revisar prazos',
      responsibleId: responsibleA,
      dueDate: '2026-11-13',
      done: false,
      doneAt: null,
    })
    await expect(repository.listByMeetings(orgA, [retroA])).resolves.toHaveLength(2)
    await expect(repository.listByMeetings(orgA, [])).resolves.toEqual([])
    await expect(
      repository.listByOccurrence(orgA, retroA, parseDateOnly('2026-11-13')),
    ).resolves.toEqual([])
  })

  it('atualiza título, responsável, prazo e conclusão', async () => {
    const { repository } = await setup()
    await repository.save(orgA, action())
    await repository.save(
      orgA,
      action({
        title: 'Novo',
        responsibleId: null,
        dueDate: null,
        done: true,
        doneAt: '2026-11-07T10:00:00.000Z',
      }),
    )
    await expect(repository.findById(orgA, actionOne)).resolves.toMatchObject({
      title: 'Novo',
      responsibleId: null,
      dueDate: null,
      done: true,
      doneAt: '2026-11-07T10:00:00.000Z',
    })
  })

  it('isolamento: outra organização não lê, não lista e não grava combinados daqui', async () => {
    const { repository } = await setup()
    await repository.save(orgA, action())
    await expect(repository.findById(orgB, actionOne)).resolves.toBeNull()
    await expect(repository.listByOccurrence(orgB, retroA, occurrence)).resolves.toEqual([])
    await expect(repository.listByMeetings(orgB, [retroA])).resolves.toEqual([])
    // Gravar um combinado de agendamento de outra organização não tem efeito.
    await repository.save(orgB, action({ organizationId: orgB, meetingId: retroA }))
    await expect(repository.listByOccurrence(orgA, retroA, occurrence)).resolves.toHaveLength(1)
    await expect(repository.findById(orgB, actionOne)).resolves.toBeNull()
  })

  it('isolamento: não grava responsável de outra organização', async () => {
    const { repository } = await setup()
    await repository.save(orgA, action({ responsibleId: managerB }))
    await expect(repository.findById(orgA, actionOne)).resolves.toBeNull()
  })

  it('remove só o combinado da organização informada', async () => {
    const { repository } = await setup()
    await repository.save(orgA, action())
    await repository.remove(orgB, actionOne)
    await expect(repository.findById(orgA, actionOne)).resolves.not.toBeNull()
    await repository.remove(orgA, actionOne)
    await expect(repository.findById(orgA, actionOne)).resolves.toBeNull()
  })

  it('excluir o agendamento leva os combinados em cascata', async () => {
    const { repository, meetingRepository, database } = await setup()
    await repository.save(orgA, action())
    await repository.save(orgA, action({ id: actionTwo }))
    await meetingRepository.remove(orgA, retroA)
    expect(
      database.select().from(retroActions).where(eq(retroActions.meetingId, retroA)).all(),
    ).toEqual([])
    expect(database.select().from(meetings).where(eq(meetings.id, retroA)).all()).toEqual([])
  })

  it('excluir o responsável deixa o combinado sem responsável (SET NULL)', async () => {
    const { repository, database } = await setup()
    await repository.save(orgA, action())
    database.delete(users).where(eq(users.id, responsibleA)).run()
    await expect(repository.findById(orgA, actionOne)).resolves.toMatchObject({
      responsibleId: null,
      title: 'Revisar prazos',
    })
  })

  it('a tabela tem organization_id obrigatório', () => {
    const { database } = { database: createSqliteClient(':memory:') }
    const columns = database.$client.prepare("PRAGMA table_info('retro_actions')").all() as {
      name: string
      notnull: number
    }[]
    expect(columns.find((column) => column.name === 'organization_id')?.notnull).toBe(1)
  })
})
