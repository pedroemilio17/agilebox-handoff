import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  toAcceptanceCriterionId,
  ValidationError,
} from '@agilebox/core'
import type { TimelineEvent } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import {
  ana,
  bia,
  carla,
  createTaskHarness,
  ctx,
  manager,
  orgA,
  orgB,
  otherManager,
  seedTaskHarness,
  setModules,
  taskId,
} from '../../testing/task-harness'

async function events(
  unitOfWork: Parameters<typeof seedTaskHarness>[0],
): Promise<readonly TimelineEvent[]> {
  return unitOfWork.repositories.timeline.listByTask(orgA, taskId)
}

async function criteriaOf(useCases: ReturnType<typeof createTaskHarness>['useCases'], actor = ana) {
  const detail = await useCases.tasks.getDetail.execute(ctx(actor), { taskId })
  return detail.criteria ?? []
}

describe('critérios de aceitação: quem edita', () => {
  it('participante adiciona e o evento sai sem marca Gestor', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    const dto: TaskDto = await useCases.tasks.criteria.add.execute(ctx(ana), {
      taskId,
      text: '  Abre sem erro  ',
    })
    expect(dto.id).toBe(taskId)
    expect(await criteriaOf(useCases)).toEqual([
      expect.objectContaining({ text: 'Abre sem erro', done: false, position: 0 }),
    ])
    const added = (await events(unitOfWork)).filter((e) => e.type === 'acceptance_criterion_added')
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({
      asManager: false,
      actorUserId: ana.userId,
      payload: { text: 'Abre sem erro' },
    })
  })

  it('apoio (bia) que participa também edita, e a ação aparece com o nome dela', async () => {
    const { useCases, unitOfWork } = createTaskHarness(bia)
    await seedTaskHarness(unitOfWork)
    await useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Critério de ana' })
    const [criterion] = await criteriaOf(useCases, bia)
    await useCases.tasks.criteria.toggle.execute(ctx(bia), {
      taskId,
      criterionId: criterion!.id,
      done: true,
    })
    expect((await criteriaOf(useCases, bia))[0]).toMatchObject({ done: true })
    const done = (await events(unitOfWork)).find((e) => e.type === 'acceptance_criterion_done')
    expect(done).toMatchObject({ actorUserId: bia.userId, asManager: false })
  })

  it('gestor edita critério de tarefa de que não participa e a marca fica como Gestor', async () => {
    const { useCases, unitOfWork } = createTaskHarness(manager)
    await seedTaskHarness(unitOfWork)
    await useCases.tasks.criteria.add.execute(ctx(manager), { taskId, text: 'Pelo gestor' })
    const added = (await events(unitOfWork)).find((e) => e.type === 'acceptance_criterion_added')
    expect(added).toMatchObject({ asManager: true, actorUserId: manager.userId })
  })

  it('colaborador de fora não edita nem vê o detalhe', async () => {
    const { useCases, unitOfWork } = createTaskHarness(carla)
    await seedTaskHarness(unitOfWork)
    await expect(
      useCases.tasks.criteria.add.execute(ctx(carla), { taskId, text: 'Invasão' }),
    ).rejects.toThrow(PermissionDeniedError)
    await expect(useCases.tasks.getDetail.execute(ctx(carla), { taskId })).rejects.toThrow(
      'Sem acesso a esta tarefa',
    )
  })

  it('gestor de outra organização não encontra a tarefa (isolamento)', async () => {
    const { useCases, unitOfWork } = createTaskHarness(otherManager)
    await seedTaskHarness(unitOfWork)
    await expect(
      useCases.tasks.criteria.add.execute(ctx(otherManager), { taskId, text: 'Outro time' }),
    ).rejects.toThrow(NotFoundError)
    await expect(useCases.tasks.getDetail.execute(ctx(otherManager), { taskId })).rejects.toThrow(
      'Tarefa não encontrada',
    )
    expect(await unitOfWork.repositories.acceptance.listByTask(orgB, taskId)).toEqual([])
  })
})

describe('critérios de aceitação: regras', () => {
  it('marcar, renomear, mover e remover geram evento e mantêm a ordem de 0 a n-1', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    for (const text of ['Um', 'Dois', 'Três']) {
      await useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text })
    }
    const [one, two, three] = await criteriaOf(useCases)
    await useCases.tasks.criteria.toggle.execute(ctx(ana), {
      taskId,
      criterionId: one!.id,
      done: true,
    })
    await useCases.tasks.criteria.toggle.execute(ctx(ana), {
      taskId,
      criterionId: one!.id,
      done: false,
    })
    await useCases.tasks.criteria.rename.execute(ctx(ana), {
      taskId,
      criterionId: two!.id,
      text: 'Dois, renomeado',
    })
    await useCases.tasks.criteria.move.execute(ctx(ana), {
      taskId,
      criterionId: three!.id,
      position: 0,
    })
    await useCases.tasks.criteria.remove.execute(ctx(ana), { taskId, criterionId: two!.id })

    expect((await criteriaOf(useCases)).map((c) => [c.text, c.position])).toEqual([
      ['Três', 0],
      ['Um', 1],
    ])
    const types = (await events(unitOfWork)).map((e) => e.type)
    expect(types).toEqual(
      expect.arrayContaining([
        'acceptance_criterion_done',
        'acceptance_criterion_reopened',
        'acceptance_criterion_renamed',
        'acceptance_criterion_moved',
        'acceptance_criterion_removed',
      ]),
    )
    const renamed = (await events(unitOfWork)).find(
      (e) => e.type === 'acceptance_criterion_renamed',
    )
    expect(renamed).toMatchObject({ payload: { before: 'Dois', after: 'Dois, renomeado' } })
  })

  it('mesmo valor (marcar igual, renomear igual, mover para o mesmo lugar) não gera evento', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Um' })
    const [one] = await criteriaOf(useCases)
    const before = (await events(unitOfWork)).length
    await useCases.tasks.criteria.toggle.execute(ctx(ana), {
      taskId,
      criterionId: one!.id,
      done: false,
    })
    await useCases.tasks.criteria.rename.execute(ctx(ana), {
      taskId,
      criterionId: one!.id,
      text: 'Um',
    })
    await useCases.tasks.criteria.move.execute(ctx(ana), {
      taskId,
      criterionId: one!.id,
      position: 0,
    })
    expect((await events(unitOfWork)).length).toBe(before)
  })

  it('até 20 critérios; o 21º é recusado', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    for (let index = 1; index <= 20; index += 1) {
      await useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: `Critério ${index}` })
    }
    await expect(
      useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Vigésimo primeiro' }),
    ).rejects.toThrow('Limite de 20 critérios por tarefa')
    expect(await criteriaOf(useCases)).toHaveLength(20)
  })

  it('texto acima de 200 caracteres é recusado', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await expect(
      useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'x'.repeat(201) }),
    ).rejects.toThrow(ValidationError)
  })

  it('critério inexistente é recusado, e o id de outra tarefa não serve', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await expect(
      useCases.tasks.criteria.toggle.execute(ctx(ana), {
        taskId,
        criterionId: toAcceptanceCriterionId('00000000000000000000000000'),
        done: true,
      }),
    ).rejects.toThrow('Critério não encontrado')
  })

  it('a conclusão da tarefa não depende dos critérios (não bloqueia)', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Ainda aberto' })
    const done = await useCases.tasks.move.execute(ctx(ana), { taskId, status: 'done' })
    expect(done.status).toBe('done')
  })
})

describe('critérios de aceitação: tarefa arquivada e guard de módulo', () => {
  it('tarefa arquivada não edita critérios: conflito para quem participa', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork, { archived: true })
    await expect(
      useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Nada' }),
    ).rejects.toThrow(ConflictError)
  })

  it('módulo `acceptance` desligado recusa com a mensagem de ferramenta desativada', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await setModules(unitOfWork, orgA, manager.userId, { acceptance: 'disabled' })
    await expect(
      useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Nada' }),
    ).rejects.toThrow('Esta ferramenta está desativada para a equipe.')
  })

  it('encerrando: não aceita critério novo, mas deixa marcar os existentes', async () => {
    const { useCases, unitOfWork } = createTaskHarness(ana)
    await seedTaskHarness(unitOfWork)
    await useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Existente' })
    await setModules(unitOfWork, orgA, manager.userId, { acceptance: 'winding_down' })
    await expect(
      useCases.tasks.criteria.add.execute(ctx(ana), { taskId, text: 'Novo' }),
    ).rejects.toThrow('Esta ferramenta está sendo encerrada: não aceita itens novos.')
    const [existing] = await criteriaOf(useCases)
    await useCases.tasks.criteria.toggle.execute(ctx(ana), {
      taskId,
      criterionId: existing!.id,
      done: true,
    })
    expect((await criteriaOf(useCases))[0]).toMatchObject({ done: true })
  })
})
