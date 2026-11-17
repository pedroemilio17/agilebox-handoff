import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  createTask,
  NotFoundError,
  PermissionDeniedError,
  toParticipationId,
  toTaskId,
  ValidationError,
} from '@agilebox/core'
import {
  ana,
  anaId,
  bia,
  biaId,
  carla,
  carlaId,
  createTaskHarness,
  ctx,
  manager,
  managerId,
  orgA,
  otherManager,
  projectId,
  seedTaskHarness,
  setProjectModules,
  taskId,
} from '../../testing/task-harness'

const ulid = (n: number) => String(n).padStart(26, '0')
const secondTaskId = toTaskId(ulid(90))

/** Tarefa de Carla (sem Ana), para testar o escopo da lista. */
async function seedCarlaTask(unitOfWork: ReturnType<typeof createTaskHarness>['unitOfWork']) {
  const task = createTask({
    id: secondTaskId,
    organizationId: orgA,
    number: 90,
    projectId,
    projectName: 'Projeto',
    createdBy: carlaId,
    title: 'Da Carla',
    createdAt: '2026-01-01T00:00:00.000Z',
    responsibleParticipationId: toParticipationId(ulid(91)),
    responsibleRateCents: 0,
  })
  await unitOfWork.repositories.tasks.save(orgA, task)
  return task
}

async function setup() {
  const harness = createTaskHarness(ana)
  await seedTaskHarness(harness.unitOfWork)
  return harness
}

describe('impedimentos: ciclo completo', () => {
  it('bloquear com responsável, trocar, resolver com nota e bloquear de novo gera um segundo registro', async () => {
    const { useCases, unitOfWork } = await setup()
    const blocked = await useCases.tasks.block.execute(ctx(ana), {
      taskId,
      reason: 'Aguardando credenciais',
      ownerId: biaId,
    })
    expect(blocked).toMatchObject({
      blockedReason: 'Aguardando credenciais',
      impediment: { status: 'open', ownerId: biaId, ownerName: 'Bia' },
    })
    const [first] = await useCases.impediments.list.execute(ctx(ana), {})
    expect(first).toMatchObject({ ownerId: biaId, status: 'open' })
    expect(first?.taskKey).toMatch(/^[A-Z]+-\d+$/u)

    const reassigned = await useCases.impediments.assign.execute(ctx(ana), {
      impedimentId: first!.id,
      ownerId: anaId,
    })
    expect(reassigned).toMatchObject({ ownerId: anaId, ownerName: 'Ana' })

    const resolved = await useCases.impediments.resolve.execute(ctx(ana), {
      impedimentId: first!.id,
      resolution: '  Acesso liberado  ',
    })
    expect(resolved).toMatchObject({ status: 'resolved', resolution: 'Acesso liberado' })
    const afterResolve = await unitOfWork.repositories.tasks.findById(orgA, taskId)
    expect(afterResolve?.blockedReason).toBeNull()

    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Nova dependência' })
    const detail = await useCases.tasks.getDetail.execute(ctx(ana), { taskId })
    const history = detail.impedimentHistory ?? []
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ id: first!.id, status: 'resolved' })
    expect(history[1]).toMatchObject({
      status: 'open',
      reason: 'Nova dependência',
    })
    expect(detail.impediment).toMatchObject({ reason: 'Nova dependência', ownerId: null })
  })

  it('resolvido sai da lista padrão e aparece com includeResolved', async () => {
    const { useCases } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await useCases.impediments.resolve.execute(ctx(ana), { impedimentId: open!.id })

    expect(await useCases.impediments.list.execute(ctx(ana), {})).toEqual([])
    const all = await useCases.impediments.list.execute(ctx(ana), { includeResolved: true })
    expect(all).toMatchObject([{ id: open!.id, status: 'resolved' }])
  })

  it('bloquear de novo com outro motivo atualiza o aberto e não cria segundo registro', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Primeiro' })
    const again = await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Segundo' })
    expect(again).toMatchObject({ blockedReason: 'Segundo', impediment: { reason: 'Segundo' } })
    expect(await unitOfWork.repositories.impediments.listByTask(orgA, taskId)).toHaveLength(1)
  })

  it('a tarefa concluída resolve o impedimento aberto, sem nota', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    await useCases.tasks.move.execute(ctx(ana), { taskId, status: 'done' })
    const [row] = await unitOfWork.repositories.impediments.listByTask(orgA, taskId)
    expect(row).toMatchObject({ status: 'resolved', resolution: null, resolvedBy: anaId })
  })
})

describe('impedimentos: responsável e notas', () => {
  it('o responsável precisa participar da tarefa ou ser o gestor', async () => {
    const { useCases } = await setup()
    await expect(
      useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo', ownerId: carlaId }),
    ).rejects.toThrow(ValidationError)

    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await expect(
      useCases.impediments.assign.execute(ctx(ana), { impedimentId: open!.id, ownerId: carlaId }),
    ).rejects.toThrow(ValidationError)
    // O gestor pode ser responsável mesmo sem participar.
    const byManager = await useCases.impediments.assign.execute(ctx(manager), {
      impedimentId: open!.id,
      ownerId: managerId,
    })
    expect(byManager.ownerId).toBe(managerId)
  })

  it('a nota de resolução vazia vira nula e a longa é recusada', async () => {
    const { useCases } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await expect(
      useCases.impediments.resolve.execute(ctx(ana), {
        impedimentId: open!.id,
        resolution: 'x'.repeat(281),
      }),
    ).rejects.toThrow(ValidationError)
    const resolved = await useCases.impediments.resolve.execute(ctx(ana), {
      impedimentId: open!.id,
      resolution: '   ',
    })
    expect(resolved.resolution).toBeNull()
  })

  it('impedimento resolvido não troca de responsável nem resolve de novo', async () => {
    const { useCases } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await useCases.impediments.resolve.execute(ctx(ana), { impedimentId: open!.id })
    await expect(
      useCases.impediments.assign.execute(ctx(ana), { impedimentId: open!.id, ownerId: biaId }),
    ).rejects.toThrow(ConflictError)
    await expect(
      useCases.impediments.resolve.execute(ctx(ana), { impedimentId: open!.id }),
    ).rejects.toThrow(ConflictError)
  })
})

describe('impedimentos: acesso e escopo', () => {
  it('quem edita atribui; quem só é de fora não; o responsável resolve mesmo sem participar', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo', ownerId: biaId })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})

    await expect(
      useCases.impediments.assign.execute(ctx(carla), { impedimentId: open!.id, ownerId: null }),
    ).rejects.toThrow(PermissionDeniedError)
    // Bia participa: edita a tarefa e atribui.
    await expect(
      useCases.impediments.assign.execute(ctx(bia), { impedimentId: open!.id, ownerId: anaId }),
    ).resolves.toMatchObject({ ownerId: anaId })

    // Bia sai da tarefa; como responsável por resolver, ainda pode resolver.
    const current = await unitOfWork.repositories.tasks.findById(orgA, taskId)
    const biaParticipation = current!.participations.find(
      (p) => p.participant.kind === 'user' && p.participant.userId === biaId,
    )
    expect(biaParticipation).toBeDefined()
    await useCases.impediments.assign.execute(ctx(ana), { impedimentId: open!.id, ownerId: biaId })
    await unitOfWork.repositories.tasks.save(orgA, {
      ...current!,
      participations: current!.participations.filter((p) => p !== biaParticipation),
    })
    await expect(
      useCases.impediments.resolve.execute(ctx(bia), { impedimentId: open!.id }),
    ).resolves.toMatchObject({ status: 'resolved' })
  })

  it('o escopo: gestor vê todos da organização; colaborador só os das tarefas de que participa', async () => {
    const { useCases, unitOfWork } = await setup()
    await seedCarlaTask(unitOfWork)
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Da Ana' })
    await useCases.tasks.block.execute(ctx(carla), { taskId: secondTaskId, reason: 'Da Carla' })

    const anaList = await useCases.impediments.list.execute(ctx(ana), {})
    expect(anaList.map((item) => item.reason)).toEqual(['Da Ana'])
    const managerList = await useCases.impediments.list.execute(ctx(manager), {})
    expect(managerList.map((item) => item.reason).sort()).toEqual(['Da Ana', 'Da Carla'])
    // Outra organização não enxerga nada desta.
    expect(await useCases.impediments.list.execute(ctx(otherManager), {})).toEqual([])
  })

  it('arquivada e backlog ficam fora da lista; arquivada não resolve', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    await useCases.tasks.archive.execute(ctx(ana), { taskId })
    expect(await useCases.impediments.list.execute(ctx(manager), {})).toEqual([])
    const [open] = await unitOfWork.repositories.impediments.listByTask(orgA, taskId)
    await expect(
      useCases.impediments.resolve.execute(ctx(ana), { impedimentId: open!.id }),
    ).rejects.toThrow(ConflictError)
    await expect(
      useCases.impediments.assign.execute(ctx(ana), { impedimentId: open!.id, ownerId: biaId }),
    ).rejects.toThrow(ConflictError)
  })

  it('item de backlog fica fora da lista e o filtro por projeto separa', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const current = await unitOfWork.repositories.tasks.findById(orgA, taskId)
    await unitOfWork.repositories.tasks.save(orgA, { ...current!, backlogRank: 1024 })
    expect(await useCases.impediments.list.execute(ctx(ana), {})).toEqual([])

    await unitOfWork.repositories.tasks.save(orgA, { ...current!, backlogRank: null })
    expect(
      await useCases.impediments.list.execute(ctx(ana), { projectId: projectId }),
    ).toHaveLength(1)
    expect(await useCases.impediments.list.execute(ctx(ana), { ownerId: carlaId })).toEqual([])
  })
})

describe('impedimentos: módulo, linha do tempo e atomicidade', () => {
  it('módulo desligado recusa tudo; encerrando recusa só abrir', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})

    await setProjectModules(unitOfWork, orgA, projectId, managerId, { impediments: 'winding_down' })
    await expect(
      useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Outro' }),
    ).rejects.toThrow(ConflictError)
    await expect(
      useCases.impediments.assign.execute(ctx(ana), { impedimentId: open!.id, ownerId: biaId }),
    ).resolves.toMatchObject({ ownerId: biaId })
    expect(await useCases.impediments.list.execute(ctx(ana), {})).toHaveLength(1)

    await setProjectModules(unitOfWork, orgA, projectId, managerId, { impediments: 'disabled' })
    await expect(useCases.impediments.list.execute(ctx(ana), {})).rejects.toThrow(
      PermissionDeniedError,
    )
    await expect(
      useCases.impediments.resolve.execute(ctx(ana), { impedimentId: open!.id }),
    ).rejects.toThrow(PermissionDeniedError)
    // Desligado esconde na tarefa: sem impedimento no DTO e sem histórico.
    const detail = await useCases.tasks.getDetail.execute(ctx(ana), { taskId })
    expect(detail.impediment).toBeNull()
    expect(detail.impedimentHistory).toEqual([])
  })

  it('a troca de responsável por gestor vai à linha do tempo marcada como Gestor', async () => {
    const { useCases, unitOfWork } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await useCases.impediments.assign.execute(ctx(manager), {
      impedimentId: open!.id,
      ownerId: biaId,
    })
    const events = await unitOfWork.repositories.timeline.listByTask(orgA, taskId)
    const assigned = events.filter((event) => event.type === 'impediment_assigned')
    expect(assigned).toEqual([
      expect.objectContaining({
        asManager: true,
        payload: { impedimentId: open!.id, before: null, after: biaId },
      }),
    ])
  })

  it('bloquear é atômico: se a linha do tempo falha, nem tarefa nem impedimento são gravados', async () => {
    const { useCases, unitOfWork } = await setup()
    unitOfWork.repositories.timeline.saveMany = () => Promise.reject(new Error('falha simulada'))
    await expect(
      useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo', ownerId: biaId }),
    ).rejects.toThrow('falha simulada')
    expect((await unitOfWork.repositories.tasks.findById(orgA, taskId))?.blockedReason).toBeNull()
    expect(await unitOfWork.repositories.impediments.listByTask(orgA, taskId)).toEqual([])
  })

  it('o impedimento de outra organização não aparece: resolver lá dá não encontrado', async () => {
    const { useCases } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await expect(
      useCases.impediments.resolve.execute(ctx(otherManager), { impedimentId: open!.id }),
    ).rejects.toThrow(NotFoundError)
  })
})

describe('impedimentos: sincronia com o resto do sistema', () => {
  it('a contagem de bloqueadas do dashboard segue a marca da tarefa, e o impedimento acompanha', async () => {
    const { useCases } = await setup()
    const countBlocked = async () =>
      (await useCases.dashboard.get.execute(ctx(manager))).insights?.blockedCount ?? 0

    expect(await countBlocked()).toBe(0)
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo' })
    expect(await countBlocked()).toBe(1)
    const [open] = await useCases.impediments.list.execute(ctx(ana), {})
    await useCases.impediments.resolve.execute(ctx(ana), { impedimentId: open!.id })
    expect(await countBlocked()).toBe(0)
  })

  it('a tarefa segue com o motivo e o impedimento do cartão, sem cair no filtro de bloqueadas', async () => {
    const { useCases } = await setup()
    await useCases.tasks.block.execute(ctx(ana), { taskId, reason: 'Motivo', ownerId: biaId })
    const board = await useCases.tasks.listBoard.execute(ctx(ana), {})
    const card = board.tasks.find((task) => task.id === taskId)
    expect(card).toMatchObject({
      blockedReason: 'Motivo',
      impediment: { reason: 'Motivo', ownerId: biaId, ownerName: 'Bia' },
    })
  })
})
