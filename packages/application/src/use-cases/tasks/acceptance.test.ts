import { describe, expect, it, vi } from 'vitest'
import {
  addParticipant,
  createTenantContext,
  NotFoundError,
  PermissionDeniedError,
  sendToBacklog,
  setArchivedAt,
  toAcceptanceCriterionId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type {
  AcceptanceCriterion,
  Actor,
  ModuleState,
  OrganizationId,
  Task,
  TaskId,
} from '@agilebox/core'
import { aParticipation, aProject, aTask } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { UnitOfWorkRepositories } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const otherOrganizationId = toOrganizationId('00000000000000000000000009')
const projectId = toProjectId('00000000000000000000000010')
const taskId = toTaskId('00000000000000000000000020')
const otherOrgTaskId = toTaskId('00000000000000000000000021')
const now = '2026-01-20T12:00:00.000Z'
const timestamp = '2026-01-01T00:00:00.000Z'

const managerId = toUserId('00000000000000000000000003')
/** Criou a tarefa: participante. */
const creatorId = toUserId('00000000000000000000000002')
/** Apoio na tarefa: participante. */
const supportId = toUserId('00000000000000000000000004')
/** Membro do projeto, mas sem envolvimento na tarefa: vê, não edita. */
const memberId = toUserId('00000000000000000000000005')
/** Sem nenhum vínculo com o projeto nem com a tarefa. */
const outsiderId = toUserId('00000000000000000000000006')
const otherManagerId = toUserId('00000000000000000000000008')

const manager: Actor = { userId: managerId, organizationId, role: 'manager' }
const creator: Actor = { userId: creatorId, organizationId, role: 'collaborator' }
const support: Actor = { userId: supportId, organizationId, role: 'collaborator' }
const member: Actor = { userId: memberId, organizationId, role: 'collaborator' }
const outsider: Actor = { userId: outsiderId, organizationId, role: 'collaborator' }
const otherManager: Actor = {
  userId: otherManagerId,
  organizationId: otherOrganizationId,
  role: 'manager',
}

/** Par (contexto, ator) para chamar os casos de uso com o ator dado. */
const call = (actor: Actor) => [createTenantContext(actor), actor] as const

/** Id de critério previsível (ULID válido, só dígitos). `n` começa em 500 para não colidir com o gerador. */
const criterionId = (n: number): AcceptanceCriterion['id'] =>
  toAcceptanceCriterionId(String(n).padStart(26, '0'))

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const notifier = new RecordingNotifier()
  const useCases = createUseCases({
    actorSession: { get: () => creator, set: () => undefined },
    changeNotifier: notifier,
    clock: new FixedClock(now),
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
  return { useCases, unitOfWork, notifier, repos: unitOfWork.repositories }
}

async function setModuleState(
  repos: UnitOfWorkRepositories,
  org: OrganizationId,
  moduleId: 'acceptance' | 'backlog',
  state: ModuleState,
): Promise<void> {
  await repos.teamModules.save(org, {
    moduleId,
    state,
    config: {},
    changedBy: managerId,
    changedAt: timestamp,
  })
}

/** Tarefa do time criada por `creatorId`, com apoio e um membro do projeto que não participa. */
async function seedTask(
  repos: UnitOfWorkRepositories,
  options: { archived?: boolean; id?: TaskId; org?: OrganizationId } = {},
): Promise<Task> {
  const org = options.org ?? organizationId
  await repos.projects.save(org, aProject().with({ id: projectId, organizationId: org }).build())
  await repos.projects.addMember(org, {
    projectId,
    userId: memberId,
    addedBy: managerId,
    addedAt: timestamp,
  })
  let task = aTask()
    .with({
      id: options.id ?? taskId,
      organizationId: org,
      projectId,
      projectName: 'Projeto AgileBox',
      createdBy: creatorId,
      responsibleParticipationId: toParticipationId('00000000000000000000000030'),
    })
    .build()
  task = addParticipant(
    task,
    aParticipation(task)
      .with({
        id: toParticipationId('00000000000000000000000031'),
        participant: { kind: 'user', userId: supportId },
        role: 'support',
      })
      .build(),
  )
  if (options.archived) task = setArchivedAt(task, timestamp)
  await repos.tasks.save(org, task)
  return task
}

async function seedCriteria(
  repos: UnitOfWorkRepositories,
  list: readonly AcceptanceCriterion[],
  id: TaskId = taskId,
): Promise<void> {
  await repos.taskCriteria.replaceForTask(organizationId, id, list)
}

const criterion = (n: number, text: string, done = false): AcceptanceCriterion => ({
  id: criterionId(n),
  text,
  done,
})

describe('critérios de aceite: listar', () => {
  it('participante vê a lista na ordem da tarefa e o resumo n/m', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [
      criterion(501, 'Login funciona', true),
      criterion(502, 'Erro claro'),
    ])

    const view = await useCases.acceptance.list.execute(...call(creator), { taskId })

    expect(view.criteria.map((item) => item.text)).toEqual(['Login funciona', 'Erro claro'])
    expect(view.criteria[0]?.done).toBe(true)
    expect(view.summary).toEqual({ done: 1, total: 2 })
  })

  it('lista vazia devolve resumo zerado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    const view = await useCases.acceptance.list.execute(...call(creator), { taskId })

    expect(view).toEqual({ criteria: [], summary: { done: 0, total: 0 } })
  })

  it('membro do projeto que não participa vê a lista (mesma regra de leitura da tarefa)', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Algo')])

    const view = await useCases.acceptance.list.execute(...call(member), { taskId })

    expect(view.summary.total).toBe(1)
  })

  it('colaborador sem vínculo com a tarefa é recusado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    await expect(
      useCases.acceptance.list.execute(...call(outsider), { taskId }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('módulo desligado recusa citando o nome Aceite', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'disabled')
    await seedTask(repos)

    await expect(useCases.acceptance.list.execute(...call(creator), { taskId })).rejects.toThrow(
      /Aceite/,
    )
  })

  it('tarefa de outra organização não aparece: não encontrada', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos, { id: otherOrgTaskId, org: otherOrganizationId })

    await expect(
      useCases.acceptance.list.execute(...call(creator), { taskId: otherOrgTaskId }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('contexto de outro time é recusado antes de qualquer leitura', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    await expect(
      useCases.acceptance.list.execute(createTenantContext(otherManager), creator, { taskId }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })
})

describe('critérios de aceite: acrescentar', () => {
  it('participante acrescenta no fim, não conferido, com id gerado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Primeiro')])

    const view = await useCases.acceptance.add.execute(...call(creator), {
      taskId,
      text: '  Segundo  ',
    })

    expect(view.criteria.map((item) => item.text)).toEqual(['Primeiro', 'Segundo'])
    expect(view.criteria[1]?.done).toBe(false)
    expect(view.summary).toEqual({ done: 0, total: 2 })
    expect(await repos.taskCriteria.listByTask(organizationId, taskId)).toHaveLength(2)
  })

  it('apoio (participante) também acrescenta', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    const view = await useCases.acceptance.add.execute(...call(support), {
      taskId,
      text: 'Feito pelo apoio',
    })

    expect(view.summary.total).toBe(1)
  })

  it('gestor acrescenta em tarefa de qualquer colaborador', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    const view = await useCases.acceptance.add.execute(...call(manager), {
      taskId,
      text: 'Pedido do gestor',
    })

    expect(view.criteria[0]?.text).toBe('Pedido do gestor')
  })

  it('membro do projeto sem envolvimento é recusado e a lista não muda', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    await expect(
      useCases.acceptance.add.execute(...call(member), { taskId, text: 'Não deveria entrar' }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    expect(await repos.taskCriteria.listByTask(organizationId, taskId)).toEqual([])
  })

  it('texto vazio ou só invisível é recusado e a lista não muda', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Existente')])

    for (const text of ['', '   ', '​​']) {
      await expect(
        useCases.acceptance.add.execute(...call(creator), { taskId, text }),
      ).rejects.toBeInstanceOf(ValidationError)
    }
    expect(await repos.taskCriteria.listByTask(organizationId, taskId)).toHaveLength(1)
  })

  it('texto com mais de 200 caracteres é recusado; 200 passa', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    await expect(
      useCases.acceptance.add.execute(...call(creator), { taskId, text: 'a'.repeat(201) }),
    ).rejects.toBeInstanceOf(ValidationError)

    const view = await useCases.acceptance.add.execute(...call(creator), {
      taskId,
      text: 'a'.repeat(200),
    })
    expect(view.summary.total).toBe(1)
  })

  it('tarefa arquivada não aceita critério novo', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos, { archived: true })

    await expect(
      useCases.acceptance.add.execute(...call(creator), { taskId, text: 'Tarde demais' }),
    ).rejects.toThrow(/arquivada/i)
    expect(await repos.taskCriteria.listByTask(organizationId, taskId)).toEqual([])
  })

  it('módulo desligado recusa; módulo encerrando aceita (ler e editar o que existe)', async () => {
    const { useCases, repos } = setup()
    await seedTask(repos)

    await setModuleState(repos, organizationId, 'acceptance', 'disabled')
    await expect(
      useCases.acceptance.add.execute(...call(creator), { taskId, text: 'X' }),
    ).rejects.toThrow(/Aceite/)

    await setModuleState(repos, organizationId, 'acceptance', 'winding_down')
    const view = await useCases.acceptance.add.execute(...call(creator), { taskId, text: 'X' })
    expect(view.summary.total).toBe(1)
  })

  it('falha no meio da gravação não deixa lista parcial (tudo ou nada)', async () => {
    const { useCases, repos, unitOfWork } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Antes')])
    const real = repos.taskCriteria.replaceForTask.bind(repos.taskCriteria)
    vi.spyOn(unitOfWork.repositories.taskCriteria, 'replaceForTask').mockImplementation(
      async (org, id, list) => {
        await real(org, id, list)
        throw new Error('falha simulada')
      },
    )

    await expect(
      useCases.acceptance.add.execute(...call(creator), { taskId, text: 'Depois' }),
    ).rejects.toThrow('falha simulada')
    const stored = await repos.taskCriteria.listByTask(organizationId, taskId)
    expect(stored.map((item) => item.text)).toEqual(['Antes'])
  })
})

describe('critérios de aceite: editar texto', () => {
  it('participante troca o texto e mantém a situação feito/não feito', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Texto antigo', true)])

    const view = await useCases.acceptance.edit.execute(...call(creator), {
      taskId,
      criterionId: criterionId(501),
      text: 'Texto novo',
    })

    expect(view.criteria).toEqual([{ id: criterionId(501), text: 'Texto novo', done: true }])
  })

  it('texto inválido é recusado e o critério fica como estava', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Original')])

    await expect(
      useCases.acceptance.edit.execute(...call(creator), {
        taskId,
        criterionId: criterionId(501),
        text: '   ',
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect((await repos.taskCriteria.listByTask(organizationId, taskId))[0]?.text).toBe('Original')
  })

  it('critério inexistente é não encontrado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    await expect(
      useCases.acceptance.edit.execute(...call(creator), {
        taskId,
        criterionId: criterionId(599),
        text: 'X',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('não participante é recusado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Original')])

    await expect(
      useCases.acceptance.edit.execute(...call(outsider), {
        taskId,
        criterionId: criterionId(501),
        text: 'Invadido',
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('tarefa arquivada não aceita edição de texto', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos, { archived: true })
    await seedCriteria(repos, [criterion(501, 'Original')])

    await expect(
      useCases.acceptance.edit.execute(...call(creator), {
        taskId,
        criterionId: criterionId(501),
        text: 'Novo',
      }),
    ).rejects.toThrow(/arquivada/i)
  })
})

describe('critérios de aceite: marcar feito', () => {
  it('participante marca e desmarca; o valor é explícito (repetir é idempotente)', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A'), criterion(502, 'B')])

    const marked = await useCases.acceptance.setDone.execute(...call(creator), {
      taskId,
      criterionId: criterionId(502),
      done: true,
    })
    expect(marked.summary).toEqual({ done: 1, total: 2 })

    const again = await useCases.acceptance.setDone.execute(...call(creator), {
      taskId,
      criterionId: criterionId(502),
      done: true,
    })
    expect(again.summary).toEqual({ done: 1, total: 2 })

    const unmarked = await useCases.acceptance.setDone.execute(...call(creator), {
      taskId,
      criterionId: criterionId(502),
      done: false,
    })
    expect(unmarked.summary).toEqual({ done: 0, total: 2 })
  })

  it('valor que não é verdadeiro/falso é recusado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A')])

    await expect(
      useCases.acceptance.setDone.execute(...call(creator), {
        taskId,
        criterionId: criterionId(501),
        done: 'sim' as unknown as boolean,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect((await repos.taskCriteria.listByTask(organizationId, taskId))[0]?.done).toBe(false)
  })

  it('gestor marca critério de tarefa de colaborador', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A')])

    const view = await useCases.acceptance.setDone.execute(...call(manager), {
      taskId,
      criterionId: criterionId(501),
      done: true,
    })

    expect(view.criteria[0]?.done).toBe(true)
  })

  it('não participante é recusado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A')])

    await expect(
      useCases.acceptance.setDone.execute(...call(member), {
        taskId,
        criterionId: criterionId(501),
        done: true,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('Q5: concluir a tarefa com critérios pendentes continua permitido', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'Pendente')])

    const moved = await useCases.tasks.move.execute(...call(creator), {
      taskId,
      status: 'done',
    })

    expect(moved.status).toBe('done')
  })
})

describe('critérios de aceite: remover e reordenar', () => {
  it('remove e mantém a ordem relativa dos demais', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A'), criterion(502, 'B'), criterion(503, 'C')])

    const view = await useCases.acceptance.remove.execute(...call(creator), {
      taskId,
      criterionId: criterionId(502),
    })

    expect(view.criteria.map((item) => item.text)).toEqual(['A', 'C'])
    expect(view.summary.total).toBe(2)
  })

  it('remover critério inexistente é não encontrado', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    await expect(
      useCases.acceptance.remove.execute(...call(creator), {
        taskId,
        criterionId: criterionId(599),
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('não participante não remove', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A')])

    await expect(
      useCases.acceptance.remove.execute(...call(outsider), {
        taskId,
        criterionId: criterionId(501),
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    expect(await repos.taskCriteria.listByTask(organizationId, taskId)).toHaveLength(1)
  })

  it('tarefa arquivada não remove critério', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos, { archived: true })
    await seedCriteria(repos, [criterion(501, 'A')])

    await expect(
      useCases.acceptance.remove.execute(...call(creator), {
        taskId,
        criterionId: criterionId(501),
      }),
    ).rejects.toThrow(/arquivada/i)
  })

  it('reordena para o início e para o fim', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A'), criterion(502, 'B'), criterion(503, 'C')])

    const toStart = await useCases.acceptance.reorder.execute(...call(creator), {
      taskId,
      criterionId: criterionId(503),
      toIndex: 0,
    })
    expect(toStart.criteria.map((item) => item.text)).toEqual(['C', 'A', 'B'])

    const toEnd = await useCases.acceptance.reorder.execute(...call(creator), {
      taskId,
      criterionId: criterionId(503),
      toIndex: 2,
    })
    expect(toEnd.criteria.map((item) => item.text)).toEqual(['A', 'B', 'C'])
  })

  it('posição fora da lista é recusada e a ordem fica como estava', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A'), criterion(502, 'B')])

    for (const toIndex of [-1, 2, 0.5]) {
      await expect(
        useCases.acceptance.reorder.execute(...call(creator), {
          taskId,
          criterionId: criterionId(502),
          toIndex,
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    }
    const stored = await repos.taskCriteria.listByTask(organizationId, taskId)
    expect(stored.map((item) => item.text)).toEqual(['A', 'B'])
  })

  it('não participante não reordena', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A'), criterion(502, 'B')])

    await expect(
      useCases.acceptance.reorder.execute(...call(member), {
        taskId,
        criterionId: criterionId(502),
        toIndex: 0,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })
})

describe('critérios de aceite: isolamento entre organizações', () => {
  it('gestor de outro time não encontra a tarefa daqui e não muda os critérios', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await setModuleState(repos, otherOrganizationId, 'acceptance', 'active')
    await seedTask(repos)
    await seedCriteria(repos, [criterion(501, 'A')])

    // Contexto e ator são do outro time (coerentes entre si, módulo ativo lá): a tarefa daqui não existe para ele.
    await expect(
      useCases.acceptance.setDone.execute(createTenantContext(otherManager), otherManager, {
        taskId,
        criterionId: criterionId(501),
        done: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect((await repos.taskCriteria.listByTask(organizationId, taskId))[0]?.done).toBe(false)
  })

  it('tarefa de outro time, com contexto e ator do time certo, é não encontrada', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos, { id: otherOrgTaskId, org: otherOrganizationId })
    await repos.taskCriteria.replaceForTask(otherOrganizationId, otherOrgTaskId, [
      criterion(501, 'Do outro time'),
    ])

    await expect(
      useCases.acceptance.add.execute(...call(manager), { taskId: otherOrgTaskId, text: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await repos.taskCriteria.listByTask(otherOrganizationId, otherOrgTaskId)).toHaveLength(1)
  })
})

describe('critérios de aceite: resumo nas telas da tarefa', () => {
  it('linha do backlog traz o resumo n/m e o detalhe da tarefa também', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await setModuleState(repos, organizationId, 'backlog', 'active')
    const task = await seedTask(repos)
    await repos.tasks.save(organizationId, sendToBacklog(task, 1))
    await seedCriteria(repos, [criterion(501, 'A', true), criterion(502, 'B'), criterion(503, 'C')])

    const [row] = await useCases.backlog.list.execute(...call(creator), {})
    expect(row?.acceptance).toEqual({ done: 1, total: 3 })

    const detail = await useCases.tasks.getDetail.execute(...call(creator), { taskId })
    expect(detail.acceptance).toEqual({ done: 1, total: 3 })
  })

  it('tarefa sem critérios aparece com 0/0 (não é nulo)', async () => {
    const { useCases, repos } = setup()
    await setModuleState(repos, organizationId, 'acceptance', 'active')
    await seedTask(repos)

    const detail = await useCases.tasks.getDetail.execute(...call(creator), { taskId })
    expect(detail.acceptance).toEqual({ done: 0, total: 0 })
  })
})
