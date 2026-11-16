import { describe, expect, it } from 'vitest'
import { createSprint } from '../entities/sprint'
import type { Sprint, SprintStatus } from '../entities/sprint'
import { createSprintTask, closeSprintTask } from '../entities/sprint-task'
import type { SprintTask } from '../entities/sprint-task'
import type { TaskStatus } from '../values/task-status'
import { ConflictError } from '../shared/errors'
import { toOrganizationId, toProjectId, toSprintId, toTaskId, toUserId } from '../shared/ids'
import type { TaskId } from '../shared/ids'
import type { Actor } from '../policies/actor'
import { planSprintClose, planSprintDiscard } from './sprint-close'
import type { SprintCloseTask } from './sprint-close'
import { startSprint } from './sprint-lifecycle'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(1))
const project = toProjectId(id(1))
const userId = toUserId(id(1))
const actor: Actor = { userId, organizationId: org, role: 'manager' }
const startedAt = '2026-03-02T09:00:00.000Z'
const at = '2026-03-13T18:00:00.000Z'

function aSprint(number: number, status: SprintStatus = 'active', projectId = project): Sprint {
  const draft = createSprint({
    id: toSprintId(id(10 + number)),
    organizationId: org,
    projectId,
    number,
    name: '',
    goal: null,
    plannedStart: '2026-03-02',
    plannedEnd: '2026-03-13',
    createdBy: userId,
    createdAt: '2026-03-01T10:00:00.000Z',
  })
  if (status === 'draft') return draft
  const active = startSprint(draft, startedAt, 0, 1)
  return status === 'closed' ? { ...active, status: 'closed' } : active
}

const taskId = (n: number): TaskId => toTaskId(id(100 + n))

/** Tarefa conforme a aplicação carregaria para o encerramento. */
function task(n: number, status: TaskStatus, archivedAt: string | null = null): SprintCloseTask {
  return { id: taskId(n), status, archivedAt }
}

/** Linha aberta da tarefa na sprint, com histórico de entrada. */
function openRow(sprint: Sprint, n: number, addedAt = '2026-03-03T09:00:00.000Z'): SprintTask {
  return createSprintTask({
    sprintId: sprint.id,
    organizationId: org,
    taskId: taskId(n),
    addedAt,
    addedBy: userId,
  })
}

const nextDraft = aSprint(5, 'draft')
const returnPolicy = { kind: 'return_to_backlog' as const }
const carryPolicy = { kind: 'carry_over' as const, nextSprintId: nextDraft.id }

describe('encerrar sprint: devolver ao backlog (padrão)', () => {
  it('concluído fica completed; aberto volta ao backlog; arquivado sai sem mudar de lugar', () => {
    const sprint = aSprint(4)
    const rows = [openRow(sprint, 1), openRow(sprint, 2), openRow(sprint, 3)]
    const plan = planSprintClose({
      sprint,
      rows,
      tasks: [task(1, 'done'), task(2, 'todo'), task(3, 'in_progress', at)],
      policy: returnPolicy,
      at,
      actor,
    })
    expect(plan.sprint).toMatchObject({ status: 'closed', closedAt: at, closePolicy: returnPolicy })
    expect(plan.completed).toEqual([taskId(1)])
    expect(plan.returnToBacklog).toEqual([taskId(2)])
    expect(plan.removed).toEqual([taskId(3)])
    expect(plan.carriedOver).toEqual([])
    expect(plan.newRows).toEqual([])
    const byTask = new Map(plan.rows.map((row) => [row.taskId, row]))
    expect(byTask.get(taskId(1))).toMatchObject({
      outcome: 'completed',
      removedAt: at,
      removedBy: userId,
    })
    expect(byTask.get(taskId(2))).toMatchObject({ outcome: 'returned_to_backlog', removedAt: at })
    expect(byTask.get(taskId(3))).toMatchObject({ outcome: 'removed', removedAt: at })
  })

  it('o histórico é preservado: linhas fechadas, nenhuma apagada, linhas já fechadas ficam como estavam', () => {
    const sprint = aSprint(4)
    const earlier = closeSprintTask(
      openRow(sprint, 9),
      'removed',
      '2026-03-04T09:00:00.000Z',
      userId,
    )
    const plan = planSprintClose({
      sprint,
      rows: [earlier, openRow(sprint, 1)],
      tasks: [task(1, 'todo')],
      policy: returnPolicy,
      at,
      actor,
    })
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0]?.taskId).toBe(taskId(1))
    expect(earlier.outcome).toBe('removed')
  })

  it('gera evento de saída para cada item aberto, com sprint e número', () => {
    const sprint = aSprint(4)
    const plan = planSprintClose({
      sprint,
      rows: [openRow(sprint, 1)],
      tasks: [task(1, 'todo')],
      policy: returnPolicy,
      at,
      actor,
    })
    expect(plan.timeline).toEqual([
      {
        taskId: taskId(1),
        draft: {
          type: 'task_removed_from_sprint',
          payload: { sprintId: sprint.id, sprintNumber: 4 },
        },
      },
    ])
  })

  it('sprint sem itens encerra sem linhas, sem tarefas a devolver e sem eventos', () => {
    const sprint = aSprint(4)
    const plan = planSprintClose({ sprint, rows: [], tasks: [], policy: returnPolicy, at, actor })
    expect(plan.sprint.status).toBe('closed')
    expect(plan).toMatchObject({
      rows: [],
      newRows: [],
      returnToBacklog: [],
      carriedOver: [],
      completed: [],
      removed: [],
      timeline: [],
    })
  })

  it('tarefa aberta sem registro carregado é erro (a aplicação precisa carregá-la)', () => {
    const sprint = aSprint(4)
    expect(() =>
      planSprintClose({
        sprint,
        rows: [openRow(sprint, 1)],
        tasks: [],
        policy: returnPolicy,
        at,
        actor,
      }),
    ).toThrow('Tarefa da sprint não foi carregada')
  })
})

describe('encerrar sprint: levar itens abertos para a sprint seguinte', () => {
  it('aberto vai para a sprint seguinte (linha nova), antiga marcada carried_over; concluído continua completed', () => {
    const sprint = aSprint(4)
    const rows = [openRow(sprint, 1), openRow(sprint, 2), openRow(sprint, 3)]
    const plan = planSprintClose({
      sprint,
      rows,
      tasks: [task(1, 'done'), task(2, 'in_progress'), task(3, 'todo', at)],
      policy: carryPolicy,
      nextSprint: nextDraft,
      at,
      actor,
    })
    expect(plan.completed).toEqual([taskId(1)])
    expect(plan.carriedOver).toEqual([taskId(2)])
    expect(plan.removed).toEqual([taskId(3)])
    expect(plan.returnToBacklog).toEqual([])
    expect(plan.newRows).toEqual([
      {
        sprintId: nextDraft.id,
        organizationId: org,
        taskId: taskId(2),
        addedAt: at,
        addedBy: userId,
        removedAt: null,
        removedBy: null,
        outcome: 'open',
      },
    ])
    expect(plan.rows.find((row) => row.taskId === taskId(2))?.outcome).toBe('carried_over')
    expect(plan.sprint.closePolicy).toEqual(carryPolicy)
  })

  it('gera saída da sprint antiga e entrada na nova para quem foi levado', () => {
    const sprint = aSprint(4)
    const plan = planSprintClose({
      sprint,
      rows: [openRow(sprint, 1)],
      tasks: [task(1, 'review')],
      policy: carryPolicy,
      nextSprint: nextDraft,
      at,
      actor,
    })
    expect(plan.timeline).toEqual([
      {
        taskId: taskId(1),
        draft: {
          type: 'task_removed_from_sprint',
          payload: { sprintId: sprint.id, sprintNumber: 4 },
        },
      },
      {
        taskId: taskId(1),
        draft: {
          type: 'task_added_to_sprint',
          payload: { sprintId: nextDraft.id, sprintNumber: 5 },
        },
      },
    ])
  })

  it('exige a sprint seguinte e que ela confira com a política', () => {
    const sprint = aSprint(4)
    const base = {
      sprint,
      rows: [openRow(sprint, 1)],
      tasks: [task(1, 'todo')],
      policy: carryPolicy,
      at,
      actor,
    }
    expect(() => planSprintClose(base)).toThrow(
      'Escolha a sprint seguinte para levar os itens abertos',
    )
    expect(() => planSprintClose({ ...base, nextSprint: aSprint(6, 'draft') })).toThrow(
      'A sprint seguinte não confere com a política de encerramento',
    )
  })

  it('a sprint seguinte precisa ser rascunho, do mesmo projeto e da mesma organização', () => {
    const sprint = aSprint(4)
    const base = {
      sprint,
      rows: [openRow(sprint, 1)],
      tasks: [task(1, 'todo')],
      policy: carryPolicy,
      at,
      actor,
    }
    expect(() => planSprintClose({ ...base, nextSprint: aSprint(5, 'active') })).toThrow(
      'A sprint seguinte precisa estar em rascunho',
    )
    expect(() =>
      planSprintClose({ ...base, nextSprint: aSprint(5, 'draft', toProjectId(id(2))) }),
    ).toThrow('A sprint seguinte é de outro projeto')
    expect(() =>
      planSprintClose({
        ...base,
        nextSprint: { ...nextDraft, organizationId: toOrganizationId(id(9)) },
      }),
    ).toThrow('A sprint seguinte é de outro projeto')
  })
})

describe('encerramento: regras de estado', () => {
  it('só sprint ativa encerra: rascunho e já encerrada são recusadas', () => {
    expect(() =>
      planSprintClose({
        sprint: aSprint(4, 'draft'),
        rows: [],
        tasks: [],
        policy: returnPolicy,
        at,
        actor,
      }),
    ).toThrow(ConflictError)
    expect(() =>
      planSprintClose({
        sprint: aSprint(4, 'closed'),
        rows: [],
        tasks: [],
        policy: returnPolicy,
        at,
        actor,
      }),
    ).toThrow(ConflictError)
  })

  it('encerrada é imutável: não se encerra duas vezes', () => {
    const closed = planSprintClose({
      sprint: aSprint(4),
      rows: [],
      tasks: [],
      policy: returnPolicy,
      at,
      actor,
    }).sprint
    expect(() =>
      planSprintClose({ sprint: closed, rows: [], tasks: [], policy: returnPolicy, at, actor }),
    ).toThrow('Sprint encerrada é só para leitura')
  })

  it('ignora linhas de outra sprint e linhas já fechadas', () => {
    const sprint = aSprint(4)
    const other = aSprint(5, 'active')
    const plan = planSprintClose({
      sprint,
      rows: [openRow(other, 2), closeSprintTask(openRow(sprint, 1), 'removed', at, userId)],
      tasks: [],
      policy: returnPolicy,
      at,
      actor,
    })
    expect(plan.rows).toEqual([])
    expect(plan.timeline).toEqual([])
  })
})

describe('descartar rascunho', () => {
  it('sem itens, descarta sem devolver nada', () => {
    const plan = planSprintDiscard({
      sprint: aSprint(4, 'draft'),
      rows: [],
      tasks: [],
      returnToBacklog: false,
      at,
      actor,
    })
    expect(plan).toMatchObject({ rows: [], returnToBacklog: [], removed: [], timeline: [] })
  })

  it('com itens abertos, recusa sem a confirmação de devolver ao backlog', () => {
    const sprint = aSprint(4, 'draft')
    expect(() =>
      planSprintDiscard({
        sprint,
        rows: [openRow(sprint, 1)],
        tasks: [task(1, 'todo')],
        returnToBacklog: false,
        at,
        actor,
      }),
    ).toThrow('A sprint tem itens: devolva-os ao backlog para descartá-la')
  })

  it('com a confirmação, devolve os abertos ao backlog e tira os arquivados sem mover; histórico fica', () => {
    const sprint = aSprint(4, 'draft')
    const plan = planSprintDiscard({
      sprint,
      rows: [openRow(sprint, 1), openRow(sprint, 2)],
      tasks: [task(1, 'todo'), task(2, 'todo', at)],
      returnToBacklog: true,
      at,
      actor,
    })
    expect(plan.returnToBacklog).toEqual([taskId(1)])
    expect(plan.removed).toEqual([taskId(2)])
    expect(plan.rows.map((row) => row.outcome)).toEqual(['returned_to_backlog', 'removed'])
    expect(plan.timeline).toHaveLength(2)
  })

  it('sprint ativa ou encerrada não é descartada', () => {
    expect(() =>
      planSprintDiscard({
        sprint: aSprint(4, 'active'),
        rows: [],
        tasks: [],
        returnToBacklog: false,
        at,
        actor,
      }),
    ).toThrow('Só sprint em rascunho pode ser descartada')
    expect(() =>
      planSprintDiscard({
        sprint: aSprint(4, 'closed'),
        rows: [],
        tasks: [],
        returnToBacklog: false,
        at,
        actor,
      }),
    ).toThrow(ConflictError)
  })
})

describe('encerrar sprint: itens já iniciados ficam no quadro (M4.2, decisão A)', () => {
  it('Desenvolvendo e Revisar saem da sprint sem voltar ao backlog; Planejamento e A fazer voltam', () => {
    const sprint = aSprint(4)
    const rows = [openRow(sprint, 1), openRow(sprint, 2), openRow(sprint, 3), openRow(sprint, 4)]
    const plan = planSprintClose({
      sprint,
      rows,
      tasks: [task(1, 'in_progress'), task(2, 'review'), task(3, 'todo'), task(4, 'planning')],
      policy: returnPolicy,
      at,
      actor,
    })
    expect(plan.leftOnBoard).toEqual([taskId(1), taskId(2)])
    expect(plan.returnToBacklog).toEqual([taskId(3), taskId(4)])
    expect(plan.rows.map((row) => row.outcome)).toEqual([
      'left_on_board',
      'left_on_board',
      'returned_to_backlog',
      'returned_to_backlog',
    ])
    expect(plan.rows.every((row) => row.removedAt === at && row.removedBy === userId)).toBe(true)
    expect(plan.timeline).toHaveLength(4)
  })

  it('com carry_over, iniciados também seguem para a sprint seguinte (a política não muda)', () => {
    const sprint = aSprint(4)
    const plan = planSprintClose({
      sprint,
      rows: [openRow(sprint, 1)],
      tasks: [task(1, 'in_progress')],
      policy: carryPolicy,
      nextSprint: nextDraft,
      at,
      actor,
    })
    expect(plan.carriedOver).toEqual([taskId(1)])
    expect(plan.leftOnBoard).toEqual([])
  })

  it('descarte: iniciado fica no quadro e não volta ao backlog', () => {
    const sprint = aSprint(4, 'draft')
    const plan = planSprintDiscard({
      sprint,
      rows: [openRow(sprint, 1), openRow(sprint, 2)],
      tasks: [task(1, 'review'), task(2, 'todo')],
      returnToBacklog: true,
      at,
      actor,
    })
    expect(plan.leftOnBoard).toEqual([taskId(1)])
    expect(plan.returnToBacklog).toEqual([taskId(2)])
    expect(plan.rows.map((row) => row.outcome)).toEqual(['left_on_board', 'returned_to_backlog'])
  })
})
