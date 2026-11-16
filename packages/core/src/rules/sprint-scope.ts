import type { Sprint } from '../entities/sprint'
import { sprintLabel } from '../entities/sprint'
import type { Task } from '../entities/task'
import { closeSprintTask, createSprintTask } from '../entities/sprint-task'
import type { SprintTask } from '../entities/sprint-task'
import type { Actor } from '../policies/actor'
import { ConflictError, ValidationError } from '../shared/errors'
import type { TaskId } from '../shared/ids'
import type { TaskSprintEventDraft } from './timeline'

/** Uma linha de histórico com o estado da sprint a que ela pertence. */
export interface SprintMembership {
  readonly sprint: Pick<Sprint, 'id' | 'number' | 'status'>
  readonly row: SprintTask
}

/** Só o que a regra de escopo lê da tarefa. */
export type TaskForSprint = Pick<Task, 'id' | 'organizationId' | 'projectId' | 'archivedAt'>

/** Evento de linha do tempo de uma tarefa, pronto para a aplicação gravar com o id da tarefa. */
export interface TaskTimelineDraft {
  readonly taskId: TaskId
  readonly draft: TaskSprintEventDraft
}

/**
 * Sprint atual da tarefa, derivada das linhas abertas (sem coluna duplicada na tarefa). Linha
 * aberta em sprint encerrada não conta: encerrar já fechou o vínculo.
 */
export function currentSprintMembership(
  memberships: readonly SprintMembership[],
): SprintMembership | null {
  return (
    memberships.find(
      (membership) => membership.row.removedAt === null && membership.sprint.status !== 'closed',
    ) ?? null
  )
}

/**
 * Escopo adicionado no meio da sprint: a linha entrou depois de a sprint começar. Serve para
 * sinalizar na interface, sem bloquear a adição.
 */
export function isAddedMidSprint(
  row: Pick<SprintTask, 'addedAt'>,
  sprint: Pick<Sprint, 'startedAt'>,
): boolean {
  if (sprint.startedAt === null) return false
  return Date.parse(row.addedAt) > Date.parse(sprint.startedAt)
}

export interface AddToSprintInput {
  readonly sprint: Sprint
  readonly task: TaskForSprint
  /** Todas as linhas de histórico da tarefa, em qualquer sprint do projeto. */
  readonly memberships: readonly SprintMembership[]
  readonly at: string
  readonly actor: Pick<Actor, 'userId'>
}

export interface AddToSprintPlan {
  readonly row: SprintTask
  readonly timeline: TaskTimelineDraft[]
}

/**
 * Adiciona a tarefa à sprint em rascunho ou ativa. Uma tarefa está em no máximo uma sprint aberta
 * por vez; tarefa arquivada e tarefa de outro projeto não entram. Tarefa no backlog e tarefa no
 * quadro sem sprint são elegíveis (estar no backlog ou no quadro não é critério de escopo).
 * Não grava nada: devolve a linha nova e o evento.
 */
export function addTaskToSprint(input: AddToSprintInput): AddToSprintPlan {
  const { sprint, task } = input
  if (sprint.status === 'closed') throw new ConflictError('Sprint encerrada não recebe tarefas')
  if (task.organizationId !== sprint.organizationId)
    throw new ValidationError('Tarefa e sprint são de organizações diferentes')
  if (task.projectId !== sprint.projectId) throw new ValidationError('A tarefa é de outro projeto')
  if (task.archivedAt !== null) throw new ConflictError('Tarefa arquivada não entra em sprint')
  const current = currentSprintMembership(input.memberships)
  if (current?.sprint.id === sprint.id) throw new ConflictError('Tarefa já está nesta sprint')
  if (current)
    throw new ConflictError(
      `Tarefa já está na ${sprintLabel(current.sprint.number)}: remova-a de lá antes`,
    )
  const row = createSprintTask({
    sprintId: sprint.id,
    organizationId: sprint.organizationId,
    taskId: task.id,
    addedAt: input.at,
    addedBy: input.actor.userId,
  })
  return {
    row,
    timeline: [
      {
        taskId: task.id,
        draft: {
          type: 'task_added_to_sprint',
          payload: { sprintId: sprint.id, sprintNumber: sprint.number },
        },
      },
    ],
  }
}

export interface RemoveFromSprintPlan {
  readonly row: SprintTask
  readonly timeline: TaskTimelineDraft[]
}

/**
 * Remove a tarefa de sprint em rascunho ou ativa. A linha fica no histórico com desfecho
 * `removed`; nada é apagado.
 */
export function removeTaskFromSprint(input: {
  readonly sprint: Pick<Sprint, 'id' | 'number' | 'status'>
  readonly row: SprintTask
  readonly at: string
  readonly actor: Pick<Actor, 'userId'>
}): RemoveFromSprintPlan {
  const { sprint, row } = input
  if (row.sprintId !== sprint.id) throw new ValidationError('A linha não pertence a esta sprint')
  if (sprint.status === 'closed') throw new ConflictError('Sprint encerrada é só para leitura')
  const closed = closeSprintTask(row, 'removed', input.at, input.actor.userId)
  return {
    row: closed,
    timeline: [
      {
        taskId: row.taskId,
        draft: {
          type: 'task_removed_from_sprint',
          payload: { sprintId: sprint.id, sprintNumber: sprint.number },
        },
      },
    ],
  }
}
