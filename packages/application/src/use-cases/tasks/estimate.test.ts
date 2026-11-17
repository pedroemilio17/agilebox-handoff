import { describe, expect, it } from 'vitest'
import { ConflictError, PermissionDeniedError, ValidationError } from '@agilebox/core'
import type { TimelineEvent } from '@agilebox/core'
import {
  ana,
  bia,
  carla,
  createTaskHarness,
  ctx,
  manager,
  orgA,
  projectId,
  seedTaskHarness,
  setProjectModules,
  taskId,
} from '../../testing/task-harness'

async function setEstimate(
  useCases: ReturnType<typeof createTaskHarness>['useCases'],
  estimatedHours: number | null,
  actor = ana,
) {
  return useCases.tasks.setEstimate.execute(ctx(actor), { taskId, estimatedHours })
}

async function estimateEvents(unitOfWork: Parameters<typeof seedTaskHarness>[0]) {
  const events: readonly TimelineEvent[] = await unitOfWork.repositories.timeline.listByTask(
    orgA,
    taskId,
  )
  return events.filter((e) => e.type === 'estimate_changed')
}

describe('estimativa em horas: quem edita e o que volta', () => {
  it('quem edita a tarefa define a estimativa, e a linha do tempo registra de → para', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    const dto = await setEstimate(useCases, 2.5)
    expect(dto.estimatedHours).toBe(2.5)
    const [event] = await estimateEvents(unitOfWork)
    expect(event).toMatchObject({
      asManager: false,
      actorUserId: ana.userId,
      payload: { before: null, after: 250 },
    })
  })

  it('gestor define e a marca fica como Gestor', async () => {
    const { useCases, unitOfWork } = createTaskHarness(manager)
    await seedTaskHarness(unitOfWork)
    await setEstimate(useCases, 1, manager)
    const [event] = await estimateEvents(unitOfWork)
    expect(event).toMatchObject({ asManager: true })
  })

  it('valor igual não gera evento; limpar gera de → sem estimativa', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await setEstimate(useCases, 2)
    await setEstimate(useCases, 2)
    await setEstimate(useCases, null)
    const events = await estimateEvents(unitOfWork)
    // A linha do tempo vem do mais recente para o mais antigo.
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.payload)).toEqual(
      expect.arrayContaining([
        { before: null, after: 200 },
        { before: 200, after: null },
      ]),
    )
    expect((await setEstimate(useCases, null)).estimatedHours).toBeNull()
  })

  it('a estimativa é a mesma no detalhe e na lista, com as horas realizadas', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork, { estimatedHoursHundredths: 250 })
    const detail = await useCases.tasks.getDetail.execute(ctx(ana), { taskId })
    expect(detail).toMatchObject({ estimatedHours: 2.5, actualHours: 2 })
    const board = await useCases.tasks.listBoard.execute(ctx(ana), {})
    expect(board.tasks.find((t) => t.id === taskId)).toMatchObject({
      estimatedHours: 2.5,
      actualHours: 2,
    })
  })

  it('recusa estimativa negativa, acima de 9999 e com mais de 2 casas', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await expect(setEstimate(useCases, -1)).rejects.toThrow(ValidationError)
    await expect(setEstimate(useCases, 10000)).rejects.toThrow(ValidationError)
    await expect(setEstimate(useCases, 1.005)).rejects.toThrow(ValidationError)
  })
})

describe('estimativa: visibilidade do custo estimado', () => {
  // Responsável ana (4500 centavos/hora) e estimativa de 2,5 h: custo estimado de R$ 112,50.
  it('o Responsável vê o custo estimado da própria tarefa', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork, { estimatedHoursHundredths: 250 })
    expect((await useCases.tasks.getDetail.execute(ctx(ana), { taskId })).estimatedCost).toBe(112.5)
  })

  it('o gestor vê o custo estimado', async () => {
    const { useCases, unitOfWork } = createTaskHarness(manager)
    await seedTaskHarness(unitOfWork, { estimatedHoursHundredths: 250 })
    expect((await useCases.tasks.getDetail.execute(ctx(manager), { taskId })).estimatedCost).toBe(
      112.5,
    )
  })

  it('apoio (bia) vê as horas, mas o custo estimado vem nulo: só vê o próprio valor/hora', async () => {
    const { useCases, unitOfWork } = createTaskHarness(bia)
    await seedTaskHarness(unitOfWork, { estimatedHoursHundredths: 250 })
    const detail = await useCases.tasks.getDetail.execute(ctx(bia), { taskId })
    expect(detail).toMatchObject({ estimatedHours: 2.5, actualHours: 2, estimatedCost: null })
    expect(detail.participations.find((p) => p.participantName === 'Ana')?.rate).toBeNull()
  })

  it('usa o padrão do Responsável quando o envolvimento dele está sem valor/hora', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork, {
      estimatedHoursHundredths: 250,
      responsibleRateCents: 0,
      anaDefaultRateCents: 6000,
    })
    expect((await useCases.tasks.getDetail.execute(ctx(ana), { taskId })).estimatedCost).toBe(150)
  })

  it('sem valor/hora em lugar nenhum, o custo estimado é nulo', async () => {
    const { useCases, unitOfWork } = createTaskHarness(manager)
    await seedTaskHarness(unitOfWork, {
      estimatedHoursHundredths: 250,
      responsibleRateCents: 0,
      anaDefaultRateCents: 0,
    })
    expect(
      (await useCases.tasks.getDetail.execute(ctx(manager), { taskId })).estimatedCost,
    ).toBeNull()
  })

  it('sem estimativa, o custo estimado é nulo mesmo para o gestor', async () => {
    const { useCases, unitOfWork } = createTaskHarness(manager)
    await seedTaskHarness(unitOfWork)
    expect(
      (await useCases.tasks.getDetail.execute(ctx(manager), { taskId })).estimatedCost,
    ).toBeNull()
  })

  it('colaborador de fora não lê a tarefa, então não vê custo algum', async () => {
    const { useCases, unitOfWork } = createTaskHarness(carla)
    await seedTaskHarness(unitOfWork, { estimatedHoursHundredths: 250 })
    await expect(useCases.tasks.getDetail.execute(ctx(carla), { taskId })).rejects.toThrow(
      PermissionDeniedError,
    )
  })
})

describe('estimativa: regras do guard e do arquivamento', () => {
  it('módulo `estimates.hours` desligado recusa a alteração', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    // `burndown` exige horas ou pontos: desligá-la junto, como faria a prévia de impacto.
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, {
      burndown: 'disabled',
      'estimates.hours': 'disabled',
    })
    await expect(setEstimate(useCases, 2)).rejects.toThrow(
      'Esta ferramenta está desativada para a equipe.',
    )
  })

  it('encerrando, a estimativa continua editável (não é item novo)', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await setProjectModules(unitOfWork, orgA, projectId, manager.userId, {
      'estimates.hours': 'winding_down',
    })
    expect((await setEstimate(useCases, 3)).estimatedHours).toBe(3)
  })

  it('tarefa arquivada não muda a estimativa', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork, { archived: true })
    await expect(setEstimate(useCases, 3)).rejects.toThrow(ConflictError)
  })

  it('colaborador de fora não altera a estimativa', async () => {
    const { useCases, unitOfWork } = createTaskHarness(carla)
    await seedTaskHarness(unitOfWork)
    await expect(setEstimate(useCases, 3, carla)).rejects.toThrow(PermissionDeniedError)
  })
})
