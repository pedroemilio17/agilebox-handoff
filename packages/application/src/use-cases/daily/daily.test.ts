import { describe, expect, it } from 'vitest'
import {
  createContributor,
  createUser,
  PermissionDeniedError,
  NotFoundError,
  parseDateOnly,
  toContributorId,
  toOrganizationId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, UserId } from '@agilebox/core'
import { aTask } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const managerId = toUserId('00000000000000000000000003')
const anaId = toUserId('00000000000000000000000002')
const brunoId = toUserId('00000000000000000000000005')
const otherManagerId = toUserId('00000000000000000000000008')
const contributorId = toContributorId('00000000000000000000000011')
const ownTaskId = toTaskId('00000000000000000000000021')
const brunoTaskId = toTaskId('00000000000000000000000022')
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const ana: Actor = { userId: anaId, organizationId, role: 'collaborator' }
const bruno: Actor = { userId: brunoId, organizationId, role: 'collaborator' }
const otherOrgManager: Actor = {
  userId: otherManagerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

const TODAY = '2026-11-04'
const YESTERDAY = '2026-11-03'
const TOMORROW = '2026-11-05'
const answers = { progress: 'Revisei a API.', nextStep: 'Fechar exemplos.', blocker: '' }

function setup(actor: Actor = ana, clockInstant = '2026-11-04T15:00:00.000Z') {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    clock: new FixedClock(clockInstant),
    comments: unitOfWork.repositories.comments,
    contributors: unitOfWork.repositories.contributors,
    dailyEntries: unitOfWork.repositories.dailyEntries,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    retroActions: unitOfWork.repositories.retroActions,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

async function seed(unitOfWork: InMemoryUnitOfWork) {
  const people: [UserId, string, Actor['role']][] = [
    [managerId, 'Gestor', 'manager'],
    [anaId, 'Ana', 'collaborator'],
    [brunoId, 'Bruno', 'collaborator'],
  ]
  for (const [id, name, role] of people) {
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id,
        organizationId,
        name,
        email: `${name.toLowerCase()}@example.com`,
        role,
        defaultRateCents: 4500,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
  }
  await unitOfWork.repositories.users.save(
    otherOrganizationId,
    createUser({
      id: otherManagerId,
      organizationId: otherOrganizationId,
      name: 'Gestor de outra empresa',
      email: 'outra@example.com',
      role: 'manager',
      defaultRateCents: 4500,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  )
  await unitOfWork.repositories.contributors.save(
    organizationId,
    createContributor({
      id: contributorId,
      organizationId,
      name: 'Cliente Alfa',
      source: 'manual',
      defaultRateCents: 0,
      createdBy: managerId,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  )
  // Ana é criadora de uma tarefa (participa); Bruno é o criador da outra (Ana não participa).
  await unitOfWork.repositories.tasks.save(
    organizationId,
    aTask().with({ id: ownTaskId, createdBy: anaId, title: 'Tarefa da Ana' }).build(),
  )
  await unitOfWork.repositories.tasks.save(
    organizationId,
    aTask().with({ id: brunoTaskId, createdBy: brunoId, title: 'Tarefa do Bruno' }).build(),
  )
}

describe('daily: pessoa', () => {
  it('get de hoje mostra a daily como devida até ser preenchida', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(useCases.daily.getToday.execute(ana, { date: TODAY })).resolves.toEqual({
      date: TODAY,
      due: true,
      entry: null,
    })
  })

  it('salva a daily do dia, sem gerar aviso', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    await seed(unitOfWork)
    const saved = await useCases.daily.save.execute(ana, {
      date: TODAY,
      answers,
      taskRefs: [ownTaskId],
    })
    expect(saved).toMatchObject({
      userId: anaId,
      userName: 'Ana',
      date: TODAY,
      answers,
      noNews: false,
      taskRefs: [ownTaskId],
    })
    const today = await useCases.daily.getToday.execute(ana, { date: TODAY })
    expect(today.due).toBe(false)
    expect(today.entry?.id).toBe(saved.id)
    expect(notifier.changes).toEqual([])
  })

  it('duas gravações no mesmo dia: a segunda atualiza a primeira', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const first = await useCases.daily.save.execute(ana, { date: TODAY, answers })
    const second = await useCases.daily.save.execute(ana, {
      date: TODAY,
      answers: { ...answers, blocker: 'Aguardo a revisão.' },
    })
    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.answers.blocker).toBe('Aguardo a revisão.')
    const all = await unitOfWork.repositories.dailyEntries.listByDate(
      organizationId,
      parseDateOnly(TODAY),
    )
    expect(all).toHaveLength(1)
  })

  it('o gestor também preenche a própria daily', async () => {
    const { useCases, unitOfWork } = setup(manager)
    await seed(unitOfWork)
    await expect(
      useCases.daily.save.execute(manager, { date: TODAY, answers, noNews: false }),
    ).resolves.toMatchObject({ userId: managerId })
  })

  it('recusa data futura', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(useCases.daily.save.execute(ana, { date: TOMORROW, answers })).rejects.toThrow(
      ValidationError,
    )
    await expect(useCases.daily.getToday.execute(ana, { date: TOMORROW })).rejects.toThrow(
      ValidationError,
    )
  })

  it('recusa data que não é hoje (retroativa ou outra data)', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(useCases.daily.save.execute(ana, { date: YESTERDAY, answers })).rejects.toThrow(
      PermissionDeniedError,
    )
  })

  it('recusa salvar por outra pessoa', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.daily.save.execute(ana, { date: TODAY, userId: brunoId, answers }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.daily.save.execute(ana, { date: TODAY, userId: anaId, answers }),
    ).resolves.toMatchObject({ userId: anaId })
  })

  it('recusa tarefa de que não participa e tarefa inexistente', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.daily.save.execute(ana, { date: TODAY, answers, taskRefs: [brunoTaskId] }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.daily.save.execute(ana, {
        date: TODAY,
        answers,
        taskRefs: ['00000000000000000000000099'],
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('citar tarefa não altera a tarefa nem gera linha do tempo', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const before = await unitOfWork.repositories.tasks.findById(organizationId, ownTaskId)
    await useCases.daily.save.execute(ana, { date: TODAY, answers, taskRefs: [ownTaskId] })
    expect(await unitOfWork.repositories.tasks.findById(organizationId, ownTaskId)).toEqual(before)
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, ownTaskId)).toEqual([])
  })

  it('recusa limite acima de 500 caracteres e daily vazia sem "sem novidades"', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.daily.save.execute(ana, {
        date: TODAY,
        answers: { ...answers, progress: 'a'.repeat(501) },
      }),
    ).rejects.toThrow(ValidationError)
    await expect(
      useCases.daily.save.execute(ana, {
        date: TODAY,
        answers: { progress: '  ', nextStep: '', blocker: '' },
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('aceita "sem novidades" sem respostas', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.daily.save.execute(ana, {
        date: TODAY,
        answers: { progress: '', nextStep: '', blocker: '' },
        noNews: true,
      }),
    ).resolves.toMatchObject({ noNews: true })
  })
})

describe('daily: gestor e acesso', () => {
  it('colaborador não lista nem lê a daily de outra pessoa', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.daily.save.execute(ana, { date: TODAY, answers })
    await expect(useCases.daily.listForDate.execute(bruno, { date: TODAY })).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      useCases.daily.getForUser.execute(bruno, { userId: anaId, date: TODAY }),
    ).rejects.toThrow(PermissionDeniedError)
  })

  it('gestor lista todas as pessoas com done e lê as dailies em somente leitura', async () => {
    const { useCases, unitOfWork } = setup(ana)
    await seed(unitOfWork)
    await useCases.daily.save.execute(ana, { date: TODAY, answers })
    const list = await useCases.daily.listForDate.execute(manager, { date: TODAY })
    expect(list).toHaveLength(3)
    expect(list).toEqual(
      expect.arrayContaining([
        { userId: managerId, userName: 'Gestor', done: false },
        { userId: anaId, userName: 'Ana', done: true },
        { userId: brunoId, userName: 'Bruno', done: false },
      ]),
    )
    const read = await useCases.daily.getForUser.execute(manager, { userId: anaId, date: TODAY })
    expect(read).toMatchObject({ userId: anaId, userName: 'Ana', answers })
    await expect(
      useCases.daily.getForUser.execute(manager, { userId: brunoId, date: TODAY }),
    ).resolves.toBeNull()
  })

  it('entidade nunca tem daily: não aparece na lista e não é encontrada', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const list = await useCases.daily.listForDate.execute(manager, { date: TODAY })
    expect(list.map((row) => row.userId)).not.toContain(contributorId)
    await expect(
      useCases.daily.getForUser.execute(manager, { userId: contributorId, date: TODAY }),
    ).rejects.toThrow(NotFoundError)
  })

  it('isola as organizações: o gestor de outra não vê nem lê as daily desta', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await useCases.daily.save.execute(ana, { date: TODAY, answers })
    const list = await useCases.daily.listForDate.execute(otherOrgManager, { date: TODAY })
    expect(list.map((row) => row.userId)).toEqual([otherManagerId])
    await expect(
      useCases.daily.getForUser.execute(otherOrgManager, { userId: anaId, date: TODAY }),
    ).rejects.toThrow(NotFoundError)
  })

  it('o gestor recebe o mesmo estado da lista do dia, sem notificar', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    await seed(unitOfWork)
    await useCases.daily.listForDate.execute(manager, { date: TODAY })
    expect(notifier.changes).toEqual([])
  })
})
