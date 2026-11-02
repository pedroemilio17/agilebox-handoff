import { describe, expect, it, vi } from 'vitest'
import {
  createTenantContext,
  createUser,
  toOrganizationId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000003')
const managerId = toUserId('00000000000000000000000004')
const actor: Actor = { userId, organizationId, role: 'collaborator' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: notifier,
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
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

describe('casos de uso de tarefas', () => {
  it('cria com prazo e responsável interpretados, tarifas próprias e histórico completo', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    await unitOfWork.repositories.users.save(
      organizationId,
      aUser().with({ id: otherUserId, name: 'Bruno', defaultRateCents: 7200 }).build(),
    )
    const created = await useCases.tasks.create.execute(
      createTenantContext({ ...actor, role: 'manager' }),
      { ...actor, role: 'manager' },
      {
        projectId: project.id,
        title: 'Criação rápida',
        status: 'todo',
        responsibleId: otherUserId,
        deadline: '2026-01-12',
      },
    )
    const saved = await unitOfWork.repositories.tasks.findById(organizationId, toTaskId(created.id))
    expect(created).toMatchObject({ status: 'todo', deadline: '2026-01-12' })
    expect(saved?.participations).toHaveLength(2)
    expect(saved?.participations.find((person) => person.role === 'responsible')).toMatchObject({
      participant: { kind: 'user', userId: otherUserId },
      rateCents: 7200,
    })
    expect(
      saved?.participations.find(
        (person) => person.participant.kind === 'user' && person.participant.userId === userId,
      )?.role,
    ).toBe('support')
    const events = await unitOfWork.repositories.timeline.listByTask(
      organizationId,
      toTaskId(created.id),
    )
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'task_created',
        'status_changed',
        'deadline_changed',
        'responsible_changed',
        'participant_added',
      ]),
    )
    expect(events.every((event) => event.asManager)).toBe(true)
  })
  it('não deixa uma tarefa parcial se o responsável não existir ou se o histórico falhar', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    const manager = { ...actor, role: 'manager' as const }
    await expect(
      useCases.tasks.create.execute(createTenantContext(manager), manager, {
        projectId: project.id,
        title: 'Inválida',
        responsibleId: otherUserId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    vi.spyOn(unitOfWork.repositories.timeline, 'saveMany').mockRejectedValue(
      new Error('Falha ao persistir histórico'),
    )
    await expect(
      useCases.tasks.create.execute(createTenantContext(manager), manager, {
        projectId: project.id,
        title: 'Falha',
        deadline: '2026-01-12',
      }),
    ).rejects.toThrow('Falha ao persistir histórico')
    expect(await unitOfWork.repositories.tasks.listBoard(organizationId, {})).toEqual([])
    expect(notifier.changes).toHaveLength(0)
  })

  it('confirma andamento com evento próprio, marca Gestor e preserva o estado', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const task = { ...aTask().build(), status: 'review' as const }
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const result = await useCases.tasks.update.execute(
      createTenantContext({ ...actor, role: 'manager' }),
      { ...actor, role: 'manager' },
      { taskId: task.id, changes: { progressConfirmed: true } },
    )
    expect(result.status).toBe('review')
    expect(result.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      { type: 'progress_confirmed', payload: {}, asManager: true, actorUserId: userId },
    ])
    expect(notifier.changes).toHaveLength(1)
  })
  it('nega confirmar uma tarefa sem permissão ou fora dos estados em andamento', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.update.execute(
        createTenantContext({ ...actor, userId: otherUserId }),
        { ...actor, userId: otherUserId },
        { taskId: task.id, changes: { progressConfirmed: true } },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.tasks.update.execute(createTenantContext(actor), actor, {
        taskId: task.id,
        changes: { progressConfirmed: true },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)).toEqual([])
  })

  it.each(['planning', 'todo', 'in_progress', 'review', 'done'] as const)(
    'cria diretamente em %s e registra a mudança na mesma transação como Gestor',
    async (status) => {
      const { useCases, unitOfWork, notifier } = setup()
      const project = aProject().build()
      await unitOfWork.repositories.projects.save(organizationId, project)
      await unitOfWork.repositories.users.save(
        organizationId,
        createUser({ ...aUser().build(), id: managerId, role: 'manager' }),
      )
      const manager: Actor = { organizationId, userId: managerId, role: 'manager' }
      const created = await useCases.tasks.create.execute(createTenantContext(manager), manager, {
        projectId: project.id,
        title: 'Tarefa por coluna',
        status,
      })
      expect(created.status).toBe(status)
      const saved = await unitOfWork.repositories.tasks.findById(
        organizationId,
        toTaskId(created.id),
      )
      expect(saved?.status).toBe(status)
      const events = await unitOfWork.repositories.timeline.listByTask(
        organizationId,
        toTaskId(created.id),
      )
      expect(events).toHaveLength(status === 'planning' ? 1 : 2)
      expect(events.every((event) => event.asManager && event.actorUserId === managerId)).toBe(true)
      expect(events.find((event) => event.type === 'task_created')).toBeTruthy()
      if (status !== 'planning')
        expect(events.find((event) => event.type === 'status_changed')).toMatchObject({
          payload: { before: 'planning', after: status },
        })
      expect(notifier.changes).toHaveLength(1)
    },
  )

  it('cria tarefa com o criador responsável e registra evento na mesma transação', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: userId,
        organizationId,
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'collaborator',
        defaultRateCents: 4500,
        createdAt: project.createdAt,
      }),
    )

    const created = await useCases.tasks.create.execute(createTenantContext(actor), actor, {
      projectId: project.id,
      title: 'Nova tarefa',
    })
    const saved = await unitOfWork.repositories.tasks.findById(organizationId, toTaskId(created.id))
    expect(saved?.participations[0]).toMatchObject({
      role: 'responsible',
      participant: { kind: 'user', userId },
    })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, toTaskId(created.id)),
    ).toMatchObject([{ type: 'task_created', actorUserId: userId, asManager: false }])
    expect(notifier.changes).toEqual([
      { organizationId, change: { kind: 'task', ids: [created.id] } },
    ])
  })

  it('nega criação por colaborador que não é membro do projeto', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().with({ createdBy: otherUserId }).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await expect(
      useCases.tasks.create.execute(createTenantContext(actor), actor, {
        projectId: project.id,
        title: 'Tarefa',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('retorna detalhe editável para participante e somente leitura para membro', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    const task = aTask().inProject(project).build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.projects.addMember(organizationId, {
      projectId: project.id,
      userId: otherUserId,
      addedBy: userId,
      addedAt: project.createdAt,
    })
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: userId,
        organizationId,
        name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'collaborator',
        defaultRateCents: 4500,
        createdAt: project.createdAt,
      }),
    )
    await unitOfWork.repositories.users.save(
      organizationId,
      createUser({
        id: otherUserId,
        organizationId,
        name: 'Bia Lima',
        email: 'bia@example.com',
        role: 'collaborator',
        defaultRateCents: 4500,
        createdAt: project.createdAt,
      }),
    )
    const editable = await useCases.tasks.getDetail.execute(createTenantContext(actor), actor, {
      taskId: task.id,
    })
    const readOnly = await useCases.tasks.getDetail.execute(
      createTenantContext({ ...actor, userId: otherUserId }),
      { ...actor, userId: otherUserId },
      { taskId: task.id },
    )
    expect(editable).toMatchObject({ canEdit: true, readOnly: false, total: null })
    expect(readOnly).toMatchObject({ canEdit: false, readOnly: true })
  })

  it('edita campos, grava eventos com marca de gestor e notifica', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    const result = await useCases.tasks.update.execute(createTenantContext(manager), manager, {
      taskId: task.id,
      changes: { title: 'Título novo', description: 'Descrição' },
    })
    expect(result).toMatchObject({ title: 'Título novo', updatedAt: '2026-01-02T00:00:00.000Z' })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      { type: 'description_edited', asManager: true },
      { type: 'renamed', asManager: true },
    ])
    expect(notifier.changes).toHaveLength(1)
  })

  it('nega edição por colaborador que não participa da tarefa', async () => {
    const { useCases, unitOfWork } = setup()
    const otherUser = aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()
    const task = aTask().ownedBy(otherUser).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.update.execute(createTenantContext(actor), actor, {
        taskId: task.id,
        changes: { title: 'Alterada' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('desfaz tarefa se a gravação de eventos falhar', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const originalSaveMany = unitOfWork.repositories.timeline.saveMany.bind(
      unitOfWork.repositories.timeline,
    )
    unitOfWork.repositories.timeline.saveMany = () =>
      Promise.reject(new Error('falha ao gravar evento'))
    await expect(
      useCases.tasks.update.execute(createTenantContext(actor), actor, {
        taskId: task.id,
        changes: { title: 'Título alterado' },
      }),
    ).rejects.toThrow('falha ao gravar evento')
    expect((await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.title).toBe(
      task.title,
    )
    unitOfWork.repositories.timeline.saveMany = originalSaveMany
  })

  it('move tarefa e registra evento de mudança de estado', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const moved = await useCases.tasks.move.execute(createTenantContext(actor), actor, {
      taskId: task.id,
      status: 'review',
    })
    expect(moved.status).toBe('review')
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      {
        type: 'status_changed',
        payload: { before: 'planning', after: 'review' },
        asManager: false,
      },
    ])
  })

  it('arquiva e desarquiva com entrada na linha do tempo do participante', async () => {
    const { useCases, unitOfWork, notifier } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await useCases.tasks.archive.execute(createTenantContext(actor), actor, { taskId: task.id })
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.archivedAt,
    ).toBe('2026-01-02T00:00:00.000Z')
    await useCases.tasks.unarchive.execute(createTenantContext(actor), actor, { taskId: task.id })
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.archivedAt,
    ).toBeNull()
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)
    expect(events.map((event) => event.type).sort()).toEqual(['archived', 'unarchived'])
    expect(events.every((event) => !event.asManager && event.actorUserId === userId)).toBe(true)
    expect(notifier.changes).toHaveLength(2)
  })

  it('marca como Gestor o arquivamento feito pelo gestor em tarefa alheia', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await useCases.tasks.archive.execute(
      createTenantContext({ userId: managerId, organizationId, role: 'manager' }),
      { userId: managerId, organizationId, role: 'manager' },
      {
        taskId: task.id,
      },
    )
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([{ type: 'archived', asManager: true, actorUserId: managerId }])
  })

  it('nega arquivar tarefa de que o colaborador não participa', async () => {
    const { useCases, unitOfWork } = setup()
    const otherUser = aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()
    const task = aTask().ownedBy(otherUser).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.archive.execute(createTenantContext(actor), actor, { taskId: task.id }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.archivedAt,
    ).toBeNull()
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)).toEqual([])
  })

  it('valida entrada de atualização', async () => {
    const { useCases } = setup()
    await expect(
      useCases.tasks.update.execute(createTenantContext(actor), actor, {
        taskId: 'inválido',
        changes: { title: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('isolamento entre organizações (M1.10b)', () => {
  const otherOrganizationId = toOrganizationId('00000000000000000000000099')
  const outsider: Actor = {
    userId: toUserId('00000000000000000000000077'),
    organizationId: otherOrganizationId,
    role: 'manager',
  }
  const outsiderCtx = createTenantContext(outsider)

  function setupWithTask() {
    const scope = setup()
    const task = aTask().build()
    void scope.unitOfWork.repositories.projects.save(organizationId, aProject().build())
    void scope.unitOfWork.repositories.tasks.save(organizationId, task)
    return { ...scope, task }
  }

  it('listagens de outro time não devolvem tarefas deste time, nem para gestor', async () => {
    const { useCases, task } = setupWithTask()
    await expect(useCases.tasks.listTeamBoard.execute(outsiderCtx, outsider, {})).resolves.toEqual(
      [],
    )
    await expect(
      useCases.tasks.listBoard.execute(outsiderCtx, outsider, { forUserId: userId }),
    ).resolves.toEqual([])
    await expect(
      useCases.tasks.search.execute(outsiderCtx, outsider, { query: task.title }),
    ).resolves.toEqual([])
  })

  it('tarefa de outro time dá NOT_FOUND em leitura e escrita e fica intacta', async () => {
    const { useCases, unitOfWork, task } = setupWithTask()
    const taskId = task.id
    await expect(
      useCases.tasks.getDetail.execute(outsiderCtx, outsider, { taskId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.tasks.update.execute(outsiderCtx, outsider, {
        taskId,
        changes: { title: 'Invadida' },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.tasks.move.execute(outsiderCtx, outsider, { taskId, status: 'done' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.tasks.archive.execute(outsiderCtx, outsider, { taskId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.tasks.unarchive.execute(outsiderCtx, outsider, { taskId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCases.tasks.recordOpen.execute(outsiderCtx, outsider, { taskId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await unitOfWork.repositories.tasks.findById(organizationId, taskId)).toEqual(task)
  })

  it('criar tarefa em projeto de outro time dá NOT_FOUND e não grava nada', async () => {
    const { useCases, unitOfWork, task } = setupWithTask()
    const before = await unitOfWork.repositories.tasks.listBoard(organizationId, {})
    await expect(
      useCases.tasks.create.execute(outsiderCtx, outsider, {
        projectId: task.projectId,
        title: 'Intrusa',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await unitOfWork.repositories.tasks.listBoard(organizationId, {})).toEqual(before)
  })

  it('contexto de um time com ator de outro dá FORBIDDEN e não altera nada', async () => {
    const { useCases, unitOfWork, task } = setupWithTask()
    await expect(
      useCases.tasks.move.execute(createTenantContext(actor), outsider, {
        taskId: task.id,
        status: 'review',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.tasks.listTeamBoard.execute(createTenantContext(actor), outsider, {}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await unitOfWork.repositories.tasks.findById(organizationId, task.id)).toEqual(task)
  })
})
