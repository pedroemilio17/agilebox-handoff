import { describe, expect, it } from 'vitest'
import {
  createChecklistItem,
  createOrganization,
  toChecklistItemId,
  toOrganizationId,
  toTaskId,
  toUserId,
  ValidationError,
  NotFoundError,
  PermissionDeniedError,
} from '@agilebox/core'
import type { Actor, TaskId } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const ownerId = toUserId('00000000000000000000000002')
const outsiderId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const owner: Actor = { userId: ownerId, organizationId, role: 'collaborator' }
const outsider: Actor = { userId: outsiderId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const taskId = toTaskId('00000000000000000000000004')

function setup(actor: Actor = owner) {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    checklist: unitOfWork.repositories.checklist,
    retroActions: unitOfWork.repositories.retroActions,
    dailyEntries: unitOfWork.repositories.dailyEntries,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork, notifier }
}

async function seedTask(
  unitOfWork: InMemoryUnitOfWork,
  options: { status?: 'in_progress' | 'done'; number?: number } = {},
) {
  const project = aProject().build()
  await unitOfWork.repositories.projects.save(organizationId, project)
  await unitOfWork.repositories.users.save(organizationId, aUser().build())
  const task = aTask()
    .inProject(project)
    .with({ number: options.number ?? 1 })
    .build()
  await unitOfWork.repositories.tasks.save(organizationId, {
    ...task,
    status: options.status ?? 'in_progress',
  })
  return task
}

async function itemsOf(unitOfWork: InMemoryUnitOfWork, id: TaskId = taskId) {
  return unitOfWork.repositories.checklist.listByTask(organizationId, id)
}

async function titles(unitOfWork: InMemoryUnitOfWork) {
  return (await itemsOf(unitOfWork)).map((item) => [item.title, item.position])
}

describe('casos de uso de subtarefas', () => {
  it('adiciona ao fim, devolve o progresso e registra o evento', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Revisar endpoints' })
    const result = await useCases.tasks.checklist.add.execute(owner, {
      taskId,
      title: '  Atualizar exemplos  ',
    })

    expect(await titles(unitOfWork)).toEqual([
      ['Revisar endpoints', 0],
      ['Atualizar exemplos', 1],
    ])
    expect(result.checklistProgress).toEqual({ done: 0, total: 2, percent: 0 })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.filter((event) => event.type === 'checklist_item_added')).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'checklist_item_added',
      asManager: false,
      actorUserId: ownerId,
      payload: { title: 'Atualizar exemplos' },
    })
  })

  it('aceita até 50 itens, recusa o 51º e não aceita itens em tarefa concluída', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    const task = await unitOfWork.repositories.tasks.findById(organizationId, taskId)
    const full = Array.from({ length: 50 }, (_, index) =>
      createChecklistItem({
        id: toChecklistItemId(String(1000 + index).padStart(26, '0')),
        organizationId,
        taskId,
        title: `Item ${index + 1}`,
        done: false,
        position: index,
        createdAt: '2026-01-01T00:00:00.000Z',
        doneAt: null,
      }),
    )
    await unitOfWork.repositories.checklist.saveMany(organizationId, full)
    await expect(
      useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Excedente' }),
    ).rejects.toThrow('Limite de 50 subtarefas por tarefa')
    expect(await itemsOf(unitOfWork)).toHaveLength(50)

    await useCases.tasks.move.execute(owner, { taskId, status: 'done' })
    expect(task?.status).toBe('in_progress')
    await expect(
      useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Depois de concluir' }),
    ).rejects.toThrow(ValidationError)
  })

  it('marca, desmarca e registra cada mudança; repetir a mesma marcação não gera evento', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    const added = await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Testar' })
    expect(added.checklistProgress.total).toBe(1)
    const [item] = await itemsOf(unitOfWork)
    const id = item!.id

    const done = await useCases.tasks.checklist.toggle.execute(owner, {
      taskId,
      itemId: id,
      done: true,
    })
    expect(done.checklistProgress).toEqual({ done: 1, total: 1, percent: 100 })
    expect((await itemsOf(unitOfWork))[0]).toMatchObject({
      done: true,
      doneAt: '2026-01-02T00:00:00.000Z',
    })
    await useCases.tasks.checklist.toggle.execute(owner, { taskId, itemId: id, done: true })
    await useCases.tasks.checklist.toggle.execute(owner, { taskId, itemId: id, done: false })

    const types = (await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)).map(
      (event) => event.type,
    )
    expect(types.filter((type) => type.startsWith('checklist_item_'))).toEqual([
      'checklist_item_reopened',
      'checklist_item_done',
      'checklist_item_added',
    ])
    expect((await itemsOf(unitOfWork))[0]).toMatchObject({ done: false, doneAt: null })
  })

  it('renomeia e reordena sem gerar evento; remover reatribui posições e gera evento', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    for (const title of ['A', 'B', 'C']) {
      await useCases.tasks.checklist.add.execute(owner, { taskId, title })
    }
    const before = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    const [first, second, third] = await itemsOf(unitOfWork)

    await useCases.tasks.checklist.rename.execute(owner, {
      taskId,
      itemId: second!.id,
      title: 'B2',
    })
    await useCases.tasks.checklist.move.execute(owner, {
      taskId,
      itemId: third!.id,
      position: 0,
    })
    expect(await titles(unitOfWork)).toEqual([
      ['C', 0],
      ['A', 1],
      ['B2', 2],
    ])
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)).toHaveLength(
      before.length,
    )

    await useCases.tasks.checklist.remove.execute(owner, { taskId, itemId: first!.id })
    expect(await titles(unitOfWork)).toEqual([
      ['C', 0],
      ['B2', 1],
    ])
    const removal = (await unitOfWork.repositories.timeline.listByTask(organizationId, taskId))[0]
    expect(removal).toMatchObject({ type: 'checklist_item_removed', payload: { title: 'A' } })
  })

  it('recusa posição inválida e subtarefa inexistente', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Único' })
    const [item] = await itemsOf(unitOfWork)
    await expect(
      useCases.tasks.checklist.move.execute(owner, { taskId, itemId: item!.id, position: 1 }),
    ).rejects.toThrow(ValidationError)
    await expect(
      useCases.tasks.checklist.toggle.execute(owner, {
        taskId,
        itemId: toChecklistItemId('00000000000000000000000999'),
        done: true,
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('bloqueia quem não participa da tarefa em todas as operações', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Privado' })
    const [item] = await itemsOf(unitOfWork)
    const id = item!.id

    await expect(
      useCases.tasks.checklist.add.execute(outsider, { taskId, title: 'Intruso' }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.tasks.checklist.toggle.execute(outsider, { taskId, itemId: id, done: true }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.tasks.checklist.rename.execute(outsider, { taskId, itemId: id, title: 'X' }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.tasks.checklist.remove.execute(outsider, { taskId, itemId: id }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(
      useCases.tasks.checklist.move.execute(outsider, { taskId, itemId: id, position: 0 }),
    ).rejects.toThrow(PermissionDeniedError)
    expect(await titles(unitOfWork)).toEqual([['Privado', 0]])
  })

  it('gestor edita qualquer tarefa e o evento sai marcado como Gestor', async () => {
    const { useCases, unitOfWork } = setup(manager)
    await seedTask(unitOfWork)
    await useCases.tasks.checklist.add.execute(manager, { taskId, title: 'Pelo gestor' })
    const [item] = await itemsOf(unitOfWork)
    await useCases.tasks.checklist.toggle.execute(manager, {
      taskId,
      itemId: item!.id,
      done: true,
    })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.filter((event) => event.type.startsWith('checklist_item_'))).toHaveLength(2)
    expect(events.every((event) => event.asManager)).toBe(true)
  })

  it('isola organizações: outra organização não vê nem altera as subtarefas', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Da organização' })
    const [item] = await itemsOf(unitOfWork)
    await unitOfWork.repositories.organizations.save(
      createOrganization({
        id: otherOrganizationId,
        name: 'Outra',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
    const stranger: Actor = {
      userId: ownerId,
      organizationId: otherOrganizationId,
      role: 'manager',
    }

    await expect(
      useCases.tasks.checklist.toggle.execute(stranger, { taskId, itemId: item!.id, done: true }),
    ).rejects.toThrow(NotFoundError)
    await expect(
      useCases.tasks.checklist.remove.execute(stranger, { taskId, itemId: item!.id }),
    ).rejects.toThrow(NotFoundError)
    expect(
      await unitOfWork.repositories.checklist.listByTasks(otherOrganizationId, [taskId]),
    ).toEqual([])
    expect((await itemsOf(unitOfWork))[0]?.done).toBe(false)
  })

  it('o quadro traz o progresso de cada tarefa; a lista vazia vira 0/0', async () => {
    const { useCases, unitOfWork } = setup()
    await seedTask(unitOfWork)
    await seedTask(unitOfWork, { number: 2 })
    const otherTaskId = toTaskId('00000000000000000000000005')
    await unitOfWork.repositories.tasks.save(organizationId, {
      ...aTask().with({ id: otherTaskId, number: 3 }).build(),
      status: 'todo',
    })
    await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Um' })
    await useCases.tasks.checklist.add.execute(owner, { taskId, title: 'Dois' })
    const [first] = await itemsOf(unitOfWork)
    await useCases.tasks.checklist.toggle.execute(owner, { taskId, itemId: first!.id, done: true })

    const { tasks: board } = await useCases.tasks.listBoard.execute(owner, {})
    const progressOf = (id: TaskId) => board.find((task) => task.id === id)?.checklistProgress
    expect(progressOf(taskId)).toEqual({ done: 1, total: 2, percent: 50 })
    expect(progressOf(otherTaskId)).toEqual({ done: 0, total: 0, percent: 0 })
  })
})
