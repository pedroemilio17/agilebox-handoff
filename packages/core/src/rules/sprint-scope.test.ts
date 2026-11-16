import { describe, expect, it } from 'vitest'
import { createSprint, sprintLabel } from '../entities/sprint'
import type { Sprint, SprintStatus } from '../entities/sprint'
import { createSprintTask, closeSprintTask } from '../entities/sprint-task'
import type { SprintTask } from '../entities/sprint-task'
import { ConflictError, ValidationError } from '../shared/errors'
import { toOrganizationId, toProjectId, toSprintId, toTaskId, toUserId } from '../shared/ids'
import type { Actor } from '../policies/actor'
import {
  addTaskToSprint,
  currentSprintMembership,
  isAddedMidSprint,
  removeTaskFromSprint,
} from './sprint-scope'
import type { SprintMembership, TaskForSprint } from './sprint-scope'
import { startSprint } from './sprint-lifecycle'

const id = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(id(1))
const project = toProjectId(id(1))
const userId = toUserId(id(1))
const actor: Actor = { userId, organizationId: org, role: 'collaborator' }
const at = '2026-03-03T09:00:00.000Z'

function aSprint(number: number, status: SprintStatus = 'draft', projectId = project): Sprint {
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
  return status === 'active' ? startSprint(draft, '2026-03-02T09:00:00.000Z', 0, 1) : draft
}

function aTask(n: number, overrides: Partial<TaskForSprint> = {}): TaskForSprint {
  return {
    id: toTaskId(id(100 + n)),
    organizationId: org,
    projectId: project,
    archivedAt: null,
    ...overrides,
  }
}

/** Histórico da tarefa com a sprint de cada linha, como a aplicação montaria. */
function membership(sprint: Sprint, row: SprintTask): SprintMembership {
  return { sprint: { id: sprint.id, number: sprint.number, status: sprint.status }, row }
}

describe('adicionar tarefa à sprint', () => {
  it('entra em sprint em rascunho e em sprint ativa, com linha aberta e evento', () => {
    for (const status of ['draft', 'active'] as const) {
      const sprint = aSprint(4, status)
      const plan = addTaskToSprint({ sprint, task: aTask(1), memberships: [], at, actor })
      expect(plan.row).toMatchObject({
        sprintId: sprint.id,
        taskId: aTask(1).id,
        addedAt: at,
        addedBy: userId,
        removedAt: null,
        outcome: 'open',
      })
      expect(plan.timeline).toEqual([
        {
          taskId: aTask(1).id,
          draft: {
            type: 'task_added_to_sprint',
            payload: { sprintId: sprint.id, sprintNumber: 4 },
          },
        },
      ])
    }
  })

  it('recusa sprint encerrada', () => {
    const closed = { ...aSprint(4, 'active'), status: 'closed' as const }
    expect(() =>
      addTaskToSprint({ sprint: closed, task: aTask(1), memberships: [], at, actor }),
    ).toThrow('Sprint encerrada não recebe tarefas')
  })

  it('recusa tarefa arquivada', () => {
    expect(() =>
      addTaskToSprint({
        sprint: aSprint(4),
        task: aTask(1, { archivedAt: at }),
        memberships: [],
        at,
        actor,
      }),
    ).toThrow(ConflictError)
  })

  it('recusa tarefa de outro projeto e de outra organização', () => {
    expect(() =>
      addTaskToSprint({
        sprint: aSprint(4),
        task: aTask(1, { projectId: toProjectId(id(2)) }),
        memberships: [],
        at,
        actor,
      }),
    ).toThrow('A tarefa é de outro projeto')
    expect(() =>
      addTaskToSprint({
        sprint: aSprint(4),
        task: aTask(1, { organizationId: toOrganizationId(id(9)) }),
        memberships: [],
        at,
        actor,
      }),
    ).toThrow(ValidationError)
  })

  it('uma tarefa está em no máximo uma sprint aberta: recusa com o número da que já a tem', () => {
    const first = aSprint(4, 'active')
    const second = aSprint(5, 'draft')
    const held = membership(
      first,
      createSprintTask({
        sprintId: first.id,
        organizationId: org,
        taskId: aTask(1).id,
        addedAt: at,
        addedBy: userId,
      }),
    )
    expect(() =>
      addTaskToSprint({ sprint: second, task: aTask(1), memberships: [held], at, actor }),
    ).toThrow(`Tarefa já está na ${sprintLabel(4)}: remova-a de lá antes`)
  })

  it('recusa repetir na mesma sprint', () => {
    const sprint = aSprint(4)
    const held = membership(
      sprint,
      createSprintTask({
        sprintId: sprint.id,
        organizationId: org,
        taskId: aTask(1).id,
        addedAt: at,
        addedBy: userId,
      }),
    )
    expect(() =>
      addTaskToSprint({ sprint, task: aTask(1), memberships: [held], at, actor }),
    ).toThrow('Tarefa já está nesta sprint')
  })

  it('tarefa cuja sprint antiga está encerrada pode entrar na nova (vínculo fechado no encerramento)', () => {
    const old = aSprint(3, 'active')
    const oldClosed = { ...old, status: 'closed' as const }
    const held = membership(
      oldClosed,
      createSprintTask({
        sprintId: old.id,
        organizationId: org,
        taskId: aTask(1).id,
        addedAt: at,
        addedBy: userId,
      }),
    )
    expect(currentSprintMembership([held])).toBeNull()
    const plan = addTaskToSprint({
      sprint: aSprint(4),
      task: aTask(1),
      memberships: [held],
      at,
      actor,
    })
    expect(plan.row.outcome).toBe('open')
  })

  it('tarefa no backlog ou no quadro sem sprint é elegível (nenhum critério de posição)', () => {
    const backlog = aTask(1)
    const board = aTask(2)
    expect(() =>
      addTaskToSprint({ sprint: aSprint(4), task: backlog, memberships: [], at, actor }),
    ).not.toThrow()
    expect(() =>
      addTaskToSprint({ sprint: aSprint(4), task: board, memberships: [], at, actor }),
    ).not.toThrow()
  })
})

describe('remover tarefa da sprint (histórico preservado)', () => {
  it('fecha a linha como removida, com quem e quando, sem apagar', () => {
    const sprint = aSprint(4, 'active')
    const row = addTaskToSprint({ sprint, task: aTask(1), memberships: [], at, actor }).row
    const later = '2026-03-04T09:00:00.000Z'
    const plan = removeTaskFromSprint({ sprint, row, at: later, actor })
    expect(plan.row).toMatchObject({
      sprintId: sprint.id,
      addedAt: at,
      removedAt: later,
      removedBy: userId,
      outcome: 'removed',
    })
    expect(plan.timeline[0]).toEqual({
      taskId: aTask(1).id,
      draft: {
        type: 'task_removed_from_sprint',
        payload: { sprintId: sprint.id, sprintNumber: 4 },
      },
    })
  })

  it('remover de rascunho também vale; remover duas vezes é recusado', () => {
    const sprint = aSprint(4)
    const row = addTaskToSprint({ sprint, task: aTask(1), memberships: [], at, actor }).row
    const removed = removeTaskFromSprint({ sprint, row, at, actor }).row
    expect(() => removeTaskFromSprint({ sprint, row: removed, at, actor })).toThrow(
      'Tarefa já saiu desta sprint',
    )
  })

  it('recusa remover de sprint encerrada e linha de outra sprint', () => {
    const sprint = aSprint(4, 'active')
    const row = addTaskToSprint({ sprint, task: aTask(1), memberships: [], at, actor }).row
    const closed = { ...sprint, status: 'closed' as const }
    expect(() => removeTaskFromSprint({ sprint: closed, row, at, actor })).toThrow(
      'Sprint encerrada é só para leitura',
    )
    expect(() => removeTaskFromSprint({ sprint: aSprint(5), row, at, actor })).toThrow(
      'A linha não pertence a esta sprint',
    )
  })

  it('após remover, a tarefa pode entrar de novo, e a linha antiga continua no histórico', () => {
    const sprint = aSprint(4)
    const first = addTaskToSprint({ sprint, task: aTask(1), memberships: [], at, actor }).row
    const gone = removeTaskFromSprint({ sprint, row: first, at, actor }).row
    const again = addTaskToSprint({
      sprint,
      task: aTask(1),
      memberships: [membership(sprint, gone)],
      at: '2026-03-05T09:00:00.000Z',
      actor,
    }).row
    expect(again.outcome).toBe('open')
    expect(gone.outcome).toBe('removed')
    expect(
      currentSprintMembership([membership(sprint, gone), membership(sprint, again)])?.row,
    ).toBe(again)
  })
})

describe('escopo adicionado no meio da sprint', () => {
  it('sinaliza linha criada depois do início; sprint em rascunho não sinaliza', () => {
    const active = aSprint(4, 'active')
    const midRow = createSprintTask({
      sprintId: active.id,
      organizationId: org,
      taskId: aTask(1).id,
      addedAt: '2026-03-10T09:00:00.000Z',
      addedBy: userId,
    })
    const startRow = createSprintTask({
      sprintId: active.id,
      organizationId: org,
      taskId: aTask(2).id,
      addedAt: '2026-03-02T09:00:00.000Z',
      addedBy: userId,
    })
    expect(isAddedMidSprint(midRow, active)).toBe(true)
    expect(isAddedMidSprint(startRow, active)).toBe(false)
    expect(isAddedMidSprint(midRow, aSprint(5))).toBe(false)
  })

  it('closeSprintTask é a única forma de fechar uma linha, e não fecha duas vezes', () => {
    const row = createSprintTask({
      sprintId: toSprintId(id(1)),
      organizationId: org,
      taskId: aTask(1).id,
      addedAt: at,
      addedBy: userId,
    })
    const closed = closeSprintTask(row, 'completed', at, userId)
    expect(closed.outcome).toBe('completed')
    expect(() => closeSprintTask(closed, 'removed', at, userId)).toThrow(ConflictError)
  })
})
