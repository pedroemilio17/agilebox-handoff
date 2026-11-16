import type { Sprint, SprintClosePolicy } from '../entities/sprint'
import { endSprint } from './sprint-lifecycle'
import { closeSprintTask, createSprintTask, isOpenSprintTask } from '../entities/sprint-task'
import type { SprintTask } from '../entities/sprint-task'
import type { TaskStatus } from '../values/task-status'
import type { Actor } from '../policies/actor'
import { ConflictError, ValidationError } from '../shared/errors'
import type { TaskId } from '../shared/ids'
import type { TaskTimelineDraft } from './sprint-scope'

/** Só o que o encerramento lê da tarefa: estado e arquivamento. */
export interface SprintCloseTask {
  readonly id: TaskId
  readonly status: TaskStatus
  readonly archivedAt: string | null
}

/** Sprint seguinte da política `carry_over`: precisa ser rascunho do mesmo projeto. */
export type SprintCarryTarget = Pick<
  Sprint,
  'id' | 'number' | 'status' | 'projectId' | 'organizationId'
>

/**
 * Plano de encerramento (puro). A aplicação grava: a sprint (já encerrada), as linhas fechadas
 * (`rows`, substituem as abertas), as linhas novas na sprint seguinte (`newRows`) e a lista de
 * tarefas a devolver ao backlog (`returnToBacklog`). Os eventos de linha do tempo saem em `timeline`.
 */
export interface SprintClosePlan {
  readonly sprint: Sprint
  readonly rows: SprintTask[]
  readonly newRows: SprintTask[]
  readonly returnToBacklog: TaskId[]
  readonly carriedOver: TaskId[]
  readonly completed: TaskId[]
  /** Arquivadas e abertas: saem da sprint sem mudar de lugar. */
  readonly removed: TaskId[]
  readonly timeline: TaskTimelineDraft[]
}

export interface CloseSprintInput {
  /** Sprint ativa, a ser encerrada. */
  readonly sprint: Sprint
  /** Todas as linhas da sprint (abertas e fechadas). */
  readonly rows: readonly SprintTask[]
  /** Tarefas das linhas abertas. Tarefa ausente é erro: o caso de uso precisa carregá-las. */
  readonly tasks: readonly SprintCloseTask[]
  readonly policy: SprintClosePolicy
  /** Obrigatória em `carry_over`; ignorada em `return_to_backlog`. */
  readonly nextSprint?: SprintCarryTarget
  readonly at: string
  readonly actor: Pick<Actor, 'userId'>
}

/**
 * Encerra a sprint e decide o destino de cada item aberto:
 * - concluído (estado Concluído) → `completed`;
 * - arquivado (não concluído) → `removed`, sem mudar de lugar;
 * - demais → `returnToBacklog` (padrão) ou `carried_over` para a sprint seguinte.
 * Toda linha aberta fecha; nada é apagado.
 */
export function planSprintClose(input: CloseSprintInput): SprintClosePlan {
  const { sprint, policy, at, actor } = input
  const closed = endSprint(sprint, at, policy)
  const target = policy.kind === 'carry_over' ? input.nextSprint : undefined
  if (policy.kind === 'carry_over') {
    if (!target) throw new ValidationError('Escolha a sprint seguinte para levar os itens abertos')
    if (target.id !== policy.nextSprintId)
      throw new ValidationError('A sprint seguinte não confere com a política de encerramento')
    if (target.id === sprint.id) throw new ValidationError('A sprint seguinte é a própria sprint')
    if (target.projectId !== sprint.projectId || target.organizationId !== sprint.organizationId)
      throw new ValidationError('A sprint seguinte é de outro projeto')
    if (target.status !== 'draft')
      throw new ConflictError('A sprint seguinte precisa estar em rascunho')
  }

  const rows: SprintTask[] = []
  const newRows: SprintTask[] = []
  const returnToBacklog: TaskId[] = []
  const carriedOver: TaskId[] = []
  const completed: TaskId[] = []
  const removed: TaskId[] = []
  const timeline: TaskTimelineDraft[] = []
  const leftEvent = {
    type: 'task_removed_from_sprint' as const,
    payload: { sprintId: sprint.id, sprintNumber: sprint.number },
  }

  for (const row of input.rows) {
    if (row.sprintId !== sprint.id || !isOpenSprintTask(row)) continue
    const task = input.tasks.find((candidate) => candidate.id === row.taskId)
    if (!task) throw new ValidationError('Tarefa da sprint não foi carregada')
    let outcome: 'completed' | 'removed' | 'returned_to_backlog' | 'carried_over'
    if (task.status === 'done') {
      outcome = 'completed'
      completed.push(task.id)
    } else if (task.archivedAt !== null) {
      outcome = 'removed'
      removed.push(task.id)
    } else if (policy.kind === 'carry_over' && target) {
      outcome = 'carried_over'
      carriedOver.push(task.id)
    } else {
      outcome = 'returned_to_backlog'
      returnToBacklog.push(task.id)
    }
    rows.push(closeSprintTask(row, outcome, at, actor.userId))
    timeline.push({ taskId: task.id, draft: leftEvent })
    if (outcome === 'carried_over' && target) {
      newRows.push(
        createSprintTask({
          sprintId: target.id,
          organizationId: target.organizationId,
          taskId: task.id,
          addedAt: at,
          addedBy: actor.userId,
        }),
      )
      timeline.push({
        taskId: task.id,
        draft: {
          type: 'task_added_to_sprint',
          payload: { sprintId: target.id, sprintNumber: target.number },
        },
      })
    }
  }

  return {
    sprint: closed,
    rows,
    newRows,
    returnToBacklog,
    carriedOver,
    completed,
    removed,
    timeline,
  }
}

export interface DiscardSprintInput {
  /** Sprint em rascunho, a ser descartada. */
  readonly sprint: Sprint
  readonly rows: readonly SprintTask[]
  readonly tasks: readonly SprintCloseTask[]
  /** Com itens abertos, o descarte só acontece devolvendo-os ao backlog (`true`). */
  readonly returnToBacklog: boolean
  readonly at: string
  readonly actor: Pick<Actor, 'userId'>
}

export interface DiscardSprintPlan {
  readonly rows: SprintTask[]
  readonly returnToBacklog: TaskId[]
  readonly removed: TaskId[]
  readonly timeline: TaskTimelineDraft[]
}

/**
 * Descarta uma sprint em rascunho. Itens abertos só saem se forem devolvidos ao backlog (ou, se
 * arquivados, saem sem mudar de lugar). Só fecha as linhas; a aplicação decide o que fazer com a
 * linha da sprint (ver relatório: histórico impede apagá-la sem decisão).
 */
export function planSprintDiscard(input: DiscardSprintInput): DiscardSprintPlan {
  const { sprint, at, actor } = input
  if (sprint.status !== 'draft')
    throw new ConflictError('Só sprint em rascunho pode ser descartada')
  const open = input.rows.filter((row) => row.sprintId === sprint.id && isOpenSprintTask(row))
  if (open.length > 0 && !input.returnToBacklog)
    throw new ConflictError('A sprint tem itens: devolva-os ao backlog para descartá-la')

  const rows: SprintTask[] = []
  const returnToBacklog: TaskId[] = []
  const removed: TaskId[] = []
  const timeline: TaskTimelineDraft[] = []
  for (const row of open) {
    const task = input.tasks.find((candidate) => candidate.id === row.taskId)
    if (!task) throw new ValidationError('Tarefa da sprint não foi carregada')
    if (task.archivedAt !== null) {
      removed.push(task.id)
      rows.push(closeSprintTask(row, 'removed', at, actor.userId))
    } else {
      returnToBacklog.push(task.id)
      rows.push(closeSprintTask(row, 'returned_to_backlog', at, actor.userId))
    }
    timeline.push({
      taskId: task.id,
      draft: {
        type: 'task_removed_from_sprint',
        payload: { sprintId: sprint.id, sprintNumber: sprint.number },
      },
    })
  }
  return { rows, returnToBacklog, removed, timeline }
}
