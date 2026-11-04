import { describe, expect, it, vi } from 'vitest'
import {
  createOrganization,
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
    checklist: unitOfWork.repositories.checklist,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
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
      useCases.tasks.create.execute(manager, {
        projectId: project.id,
        title: 'Inválida',
        responsibleId: otherUserId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    vi.spyOn(unitOfWork.repositories.timeline, 'saveMany').mockRejectedValue(
      new Error('Falha ao persistir histórico'),
    )
    await expect(
      useCases.tasks.create.execute(manager, {
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
        { ...actor, userId: otherUserId },
        { taskId: task.id, changes: { progressConfirmed: true } },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.tasks.update.execute(actor, {
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
      const created = await useCases.tasks.create.execute(manager, {
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

    const created = await useCases.tasks.create.execute(actor, {
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
      useCases.tasks.create.execute(actor, { projectId: project.id, title: 'Tarefa' }),
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
    const editable = await useCases.tasks.getDetail.execute(actor, { taskId: task.id })
    const readOnly = await useCases.tasks.getDetail.execute(
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
    const result = await useCases.tasks.update.execute(manager, {
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
      useCases.tasks.update.execute(actor, { taskId: task.id, changes: { title: 'Alterada' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('altera a prioridade como evento da linha do tempo, marcado como Gestor quando for o gestor', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask()
      .ownedBy(aUser().with({ id: userId }).build())
      .build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const updated = await useCases.tasks.update.execute(actor, {
      taskId: task.id,
      changes: { priority: 'high' },
    })
    expect(updated.priority).toBe('high')
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    await useCases.tasks.update.execute(manager, {
      taskId: task.id,
      changes: { priority: 'normal' },
    })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)
    expect(events).toHaveLength(2)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'priority_changed',
          asManager: false,
          payload: { before: 'normal', after: 'high' },
        }),
        expect.objectContaining({
          type: 'priority_changed',
          asManager: true,
          payload: { before: 'high', after: 'normal' },
        }),
      ]),
    )
    const stored = await unitOfWork.repositories.tasks.findById(organizationId, task.id)
    expect(stored?.priority).toBe('normal')
  })

  it('nega mudar a prioridade por colaborador que não participa, sem gravar evento', async () => {
    const { useCases, unitOfWork } = setup()
    const otherUser = aUser().with({ id: otherUserId, name: 'Bia Lima' }).build()
    const task = aTask().ownedBy(otherUser).build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.update.execute(actor, { taskId: task.id, changes: { priority: 'high' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)).toEqual([])
    const stored = await unitOfWork.repositories.tasks.findById(organizationId, task.id)
    expect(stored?.priority).toBe('normal')
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
      useCases.tasks.update.execute(actor, {
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
    const moved = await useCases.tasks.move.execute(actor, { taskId: task.id, status: 'review' })
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

  it('bloqueia com motivo como evento da linha do tempo, sem mudar o estado', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const blocked = await useCases.tasks.block.execute(actor, {
      taskId: task.id,
      reason: '  Aguardando credenciais  ',
    })
    expect(blocked).toMatchObject({
      status: 'planning',
      blockedReason: 'Aguardando credenciais',
      blockedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(
      await unitOfWork.repositories.timeline.listByTask(organizationId, task.id),
    ).toMatchObject([
      { type: 'blocked', payload: { reason: 'Aguardando credenciais' }, asManager: false },
    ])
  })

  it('bloqueia e desbloqueia pelo gestor com marca de Gestor', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask()
      .ownedBy(aUser().with({ id: userId }).build())
      .build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
    await useCases.tasks.block.execute(manager, { taskId: task.id, reason: 'Motivo' })
    const unblocked = await useCases.tasks.unblock.execute(manager, { taskId: task.id })
    expect(unblocked).toMatchObject({ blockedReason: null, blockedAt: null })
    const events = await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)
    expect(events).toHaveLength(2)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'blocked', asManager: true }),
        expect.objectContaining({ type: 'unblocked', asManager: true }),
      ]),
    )
  })

  it('nega bloquear ou desbloquear por colaborador que não participa, sem gravar evento', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask()
      .ownedBy(aUser().with({ id: otherUserId, name: 'Bia Lima' }).build())
      .build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.block.execute(actor, { taskId: task.id, reason: 'Motivo' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(useCases.tasks.unblock.execute(actor, { taskId: task.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)).toEqual([])
    expect(
      (await unitOfWork.repositories.tasks.findById(organizationId, task.id))?.blockedReason,
    ).toBeNull()
  })

  it('nega bloquear tarefa concluída e não grava nada', async () => {
    const { useCases, unitOfWork } = setup()
    const task = { ...aTask().build(), status: 'done' as const }
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await expect(
      useCases.tasks.block.execute(actor, { taskId: task.id, reason: 'Motivo' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)).toEqual([])
  })

  it('concluir tarefa bloqueada limpa o bloqueio e grava também o desbloqueio', async () => {
    const { useCases, unitOfWork } = setup()
    const task = aTask().build()
    await unitOfWork.repositories.tasks.save(organizationId, task)
    await useCases.tasks.block.execute(actor, { taskId: task.id, reason: 'Motivo' })
    const done = await useCases.tasks.move.execute(actor, { taskId: task.id, status: 'done' })
    expect(done).toMatchObject({ status: 'done', blockedReason: null, blockedAt: null })
    const types = (await unitOfWork.repositories.timeline.listByTask(organizationId, task.id)).map(
      (event) => event.type,
    )
    expect(types).toEqual(expect.arrayContaining(['blocked', 'status_changed', 'unblocked']))
    expect(types).toHaveLength(3)
  })

  it('valida entrada de atualização', async () => {
    const { useCases } = setup()
    await expect(
      useCases.tasks.update.execute(actor, { taskId: 'inválido', changes: { title: 'x' } }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('número e chave da tarefa', () => {
  it('numera em sequência dentro da organização e devolve a chave com o prefixo', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    const managerActor = { ...actor, role: 'manager' as const }

    const first = await useCases.tasks.create.execute(managerActor, {
      projectId: project.id,
      title: 'Primeira',
    })
    const second = await useCases.tasks.create.execute(managerActor, {
      projectId: project.id,
      title: 'Segunda',
    })

    expect([first.number, first.key, second.number, second.key]).toEqual([1, 'AB-1', 2, 'AB-2'])
    await expect(unitOfWork.repositories.tasks.nextNumber(organizationId)).resolves.toBe(3)
  })

  it('usa o prefixo atual da organização nas chaves das tarefas existentes', async () => {
    const { useCases, unitOfWork } = setup()
    const project = aProject().build()
    await unitOfWork.repositories.projects.save(organizationId, project)
    await unitOfWork.repositories.users.save(organizationId, aUser().build())
    await useCases.tasks.create.execute(
      { ...actor, role: 'manager' },
      { projectId: project.id, title: 'Tarefa antiga' },
    )
    await unitOfWork.repositories.organizations.save(
      createOrganization({
        id: organizationId,
        name: 'Organização de teste',
        taskPrefix: 'OPS',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )

    const { tasks: board } = await useCases.tasks.listBoard.execute(actor, {})

    expect(board.map((task) => [task.number, task.key])).toEqual([[1, 'OPS-1']])
  })
})
