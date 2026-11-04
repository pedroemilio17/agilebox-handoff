import { describe, expect, it } from 'vitest'
import {
  createDefinitionOfDoneItem,
  createProject,
  createUser,
  createTask,
  DefinitionOfDoneNotConfirmedError,
  toDefinitionOfDoneItemId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, DefinitionOfDoneItem, Project, Task, TaskId } from '@agilebox/core'
import { aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const ownerId = toUserId('00000000000000000000000002')
const managerId = toUserId('00000000000000000000000004')
const projectId = toProjectId('00000000000000000000000003')
const taskId = toTaskId('00000000000000000000000005')
const owner: Actor = { userId: ownerId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const timestamp = '2026-01-01T00:00:00.000Z'

function setup(actor: Actor = owner) {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    boardSettings: unitOfWork.repositories.boardSettings,
    changeNotifier: new RecordingNotifier(),
    checklist: unitOfWork.repositories.checklist,
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    comments: unitOfWork.repositories.comments,
    contributors: unitOfWork.repositories.contributors,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
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
  return { useCases, unitOfWork }
}

async function seed(
  unitOfWork: InMemoryUnitOfWork,
  options: { status?: Task['status']; titles?: readonly string[] } = {},
) {
  await unitOfWork.repositories.users.save(organizationId, aUser().with({ id: ownerId }).build())
  await unitOfWork.repositories.users.save(
    organizationId,
    createUser({ ...aUser().build(), id: managerId, name: 'Gestor', role: 'manager' }),
  )
  const project: Project = createProject({
    id: projectId,
    organizationId,
    name: 'Projeto DoD',
    createdBy: ownerId,
    createdAt: timestamp,
  })
  await unitOfWork.repositories.projects.save(organizationId, project)
  await unitOfWork.repositories.projects.addMember(organizationId, {
    projectId,
    userId: ownerId,
    addedBy: ownerId,
    addedAt: timestamp,
  })
  const task = createTask({
    id: taskId,
    organizationId,
    number: 1,
    projectId,
    projectName: project.name,
    createdBy: ownerId,
    title: 'Publicar versão',
    createdAt: timestamp,
    responsibleParticipationId: toParticipationId('00000000000000000000000006'),
    responsibleRateCents: 4500,
  })
  await unitOfWork.repositories.tasks.save(organizationId, {
    ...task,
    status: options.status ?? 'review',
  })
  const items = (
    options.titles ?? ['Testes passando', 'Documentação atualizada', 'Revisado por outra pessoa']
  ).map((title, position): DefinitionOfDoneItem =>
    createDefinitionOfDoneItem({
      id: toDefinitionOfDoneItemId(`0000000000000000000000001${position}`),
      organizationId,
      projectId,
      title,
      position,
    }),
  )
  await unitOfWork.repositories.definitionOfDone.saveMany(organizationId, items)
  return items
}

async function timelineTypes(unitOfWork: InMemoryUnitOfWork, id: TaskId = taskId) {
  const events = await unitOfWork.repositories.timeline.listByTask(organizationId, id)
  return events.map((event) => event.type)
}

describe('conferência da definição de pronto ao concluir', () => {
  it('concluir sem confirmar falha e devolve os itens que faltaram', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const error = await useCases.tasks.move
      .execute(owner, { taskId, status: 'done' })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(DefinitionOfDoneNotConfirmedError)
    expect(
      (error as DefinitionOfDoneNotConfirmedError).missingItems.map((item) => item.title),
    ).toEqual(['Testes passando', 'Documentação atualizada', 'Revisado por outra pessoa'])
    const stored = await unitOfWork.repositories.tasks.findById(organizationId, taskId)
    expect(stored?.status).toBe('review')
  })

  it('confirmação parcial falha e lista só os que faltaram', async () => {
    const { useCases, unitOfWork } = setup()
    const [first, second] = await seed(unitOfWork)
    const error = await useCases.tasks.move
      .execute(owner, {
        taskId,
        status: 'done',
        confirmedDefinitionItemIds: [first!.id, second!.id],
      })
      .catch((caught: unknown) => caught)
    expect((error as DefinitionOfDoneNotConfirmedError).missingItems).toEqual([
      { id: '00000000000000000000000012', title: 'Revisado por outra pessoa' },
    ])
  })

  it('confirmar todos conclui, registra a confirmação com a contagem e a linha do tempo', async () => {
    const { useCases, unitOfWork } = setup()
    const items = await seed(unitOfWork)
    const moved = await useCases.tasks.move.execute(owner, {
      taskId,
      status: 'done',
      confirmedDefinitionItemIds: items.map((item) => item.id),
    })
    expect(moved.status).toBe('done')
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    const confirmed = events.find((event) => event.type === 'definition_confirmed')
    expect(confirmed).toMatchObject({
      type: 'definition_confirmed',
      payload: { count: 3 },
      asManager: false,
    })
    expect(
      (await timelineTypes(unitOfWork)).filter((type) => type === 'status_changed'),
    ).toHaveLength(1)
  })

  it('gestor que conclui com a confirmação tem o evento marcado como Gestor', async () => {
    const { useCases, unitOfWork } = setup(manager)
    const items = await seed(unitOfWork)
    await useCases.tasks.move.execute(manager, {
      taskId,
      status: 'done',
      confirmedDefinitionItemIds: items.map((item) => item.id),
    })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, taskId)
    expect(events.filter((event) => event.type === 'definition_confirmed')).toEqual([
      expect.objectContaining({ asManager: true }),
    ])
  })

  it('projeto sem itens conclui sem exigir nada e sem evento de confirmação', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, { titles: [] })
    const moved = await useCases.tasks.move.execute(owner, { taskId, status: 'done' })
    expect(moved.status).toBe('done')
    expect(await timelineTypes(unitOfWork)).not.toContain('definition_confirmed')
  })

  it('item adicionado depois da conclusão anterior precisa ser confirmado de novo', async () => {
    const { useCases, unitOfWork } = setup()
    const items = await seed(unitOfWork, { titles: ['A'] })
    await useCases.tasks.move.execute(owner, {
      taskId,
      status: 'done',
      confirmedDefinitionItemIds: items.map((item) => item.id),
    })
    await useCases.tasks.move.execute(owner, { taskId, status: 'review' })
    await useCases.projects.definitionOfDone.add.execute(owner, { projectId, title: 'Novo item' })
    await expect(
      useCases.tasks.move.execute(owner, {
        taskId,
        status: 'done',
        confirmedDefinitionItemIds: items.map((item) => item.id),
      }),
    ).rejects.toMatchObject({ missingItems: [expect.objectContaining({ title: 'Novo item' })] })
  })

  it('reabrir (sair de Concluído) não exige confirmação', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, { status: 'done', titles: ['A'] })
    const reopened = await useCases.tasks.move.execute(owner, { taskId, status: 'review' })
    expect(reopened.status).toBe('review')
  })

  it('criar tarefa já concluída também exige a confirmação', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, { titles: ['A'] })
    await expect(
      useCases.tasks.create.execute(owner, { projectId, title: 'Nova', status: 'done' }),
    ).rejects.toBeInstanceOf(DefinitionOfDoneNotConfirmedError)
    const [item] = await unitOfWork.repositories.definitionOfDone.listByProject(
      organizationId,
      projectId,
    )
    const created = await useCases.tasks.create.execute(owner, {
      projectId,
      title: 'Nova',
      status: 'done',
      confirmedDefinitionItemIds: [item!.id],
    })
    expect(created.status).toBe('done')
    const events = await unitOfWork.repositories.timeline.listByTask(
      organizationId,
      toTaskId(created.id),
    )
    expect(events.map((event) => event.type)).toContain('definition_confirmed')
  })

  it('o detalhe da tarefa traz a definição de pronto do projeto', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, { titles: ['A', 'B'] })
    const detail = await useCases.tasks.getDetail.execute(owner, { taskId })
    expect(detail.projectDefinitionOfDone.map((item) => [item.title, item.position])).toEqual([
      ['A', 0],
      ['B', 1],
    ])
  })

  it('isolamento: itens de outra organização não confirmam nem aparecem', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork, { titles: [] })
    await unitOfWork.repositories.definitionOfDone.saveMany(otherOrganizationId, [
      createDefinitionOfDoneItem({
        id: toDefinitionOfDoneItemId('00000000000000000000000077'),
        organizationId: otherOrganizationId,
        projectId,
        title: 'De outra organização',
        position: 0,
      }),
    ])
    const detail = await useCases.tasks.getDetail.execute(owner, { taskId })
    expect(detail.projectDefinitionOfDone).toEqual([])
    await expect(
      useCases.tasks.move.execute(owner, { taskId, status: 'done' }),
    ).resolves.toMatchObject({
      status: 'done',
    })
  })
})
