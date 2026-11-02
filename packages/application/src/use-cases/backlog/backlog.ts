import {
  canEditTask,
  canReorderBacklog,
  createTimelineEvent,
  diffTask,
  isManagerEdit,
  moveInBacklog,
  nextBacklogRank,
  NotFoundError,
  participates,
  PermissionDeniedError,
  sendToBacklog,
  takeToBoard,
  toEventId,
  toProjectId,
  toTaskId,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  BacklogPlacement,
  BacklogRankChange,
  Task,
  TenantContext,
  TimelineEventDraft,
} from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { toAcceptanceSummaryDto, toTaskDto } from '../../mappers'
import type { AcceptanceSummaryDto, TaskEstimateDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { BACKLOG_MODULE, requireModuleAccess } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'

/** Linha do backlog: a tarefa, a estimativa conforme o ator e o resumo n/m dos critérios (M3.6). */
export type BacklogTaskDto = TaskDto &
  TaskEstimateDto & { readonly acceptance: AcceptanceSummaryDto }

/*
 * Backlog do time (M3.5). Regras:
 * - Ordem única por time (B2 A). Só o gestor reordena (B3 A); reordenar não gera linha do tempo (Q1).
 * - Levar ao quadro: quem edita a tarefa, gestor incluso (Q3, recomendação do PROGRESS_2 ausente;
 *   adotado `canEditTask`). Entra em Planejamento; a mudança de estado sai na linha do tempo.
 * - Devolver ao backlog: quem edita a tarefa (mesma regra). O estado não muda (Q-a).
 * - Listar: colaborador vê só as tarefas de que participa, como `ListTeamBoard`.
 * - Todos exigem o módulo Backlog ativo ou encerrando (`existing`); desligado, recusam com ValidationError.
 * - Id de outro time (ou inexistente): NotFoundError. Tarefa arquivada: ValidationError, em todos.
 * - Levar ao quadro e devolver ao backlog geram `moved_to_board` e `sent_to_backlog` na linha do
 *   tempo, além da mudança de estado (se houver). Reordenar não gera evento (Q1).
 */

const ARCHIVED_BACKLOG_MESSAGE = 'Tarefa arquivada: desarquive a tarefa antes de mudar o backlog'

/** Tarefa arquivada não muda de lugar no backlog: mesma mensagem em todas as movimentações. */
function assertNotArchived(task: Task): void {
  if (task.archivedAt !== null) throw new ValidationError(ARCHIVED_BACKLOG_MESSAGE)
}

export interface ListBacklogInput {
  readonly projectId?: string
}

export interface ReorderBacklogInput {
  readonly taskId: string
  readonly placement: BacklogPlacement
}

export interface BacklogTaskInput {
  readonly taskId: string
}

export interface SendToBacklogInput extends BacklogTaskInput {
  readonly placement?: BacklogPlacement
}

export class ListBacklog {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: ListBacklogInput = {},
  ): Promise<readonly BacklogTaskDto[]> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, BACKLOG_MODULE, 'existing')
    const projectId = input.projectId === undefined ? undefined : toProjectId(input.projectId)
    const backlog = await this.deps.tasks.listBacklog(organizationId)
    const visible = backlog
      .filter((task) => projectId === undefined || task.projectId === projectId)
      .filter((task) => actor.role === 'manager' || participates(actor, task))
    if (visible.length === 0) return []
    // Resumo n/m dos critérios, lido na mesma transação para todas as linhas (M3.6).
    return this.deps.unitOfWork.run(organizationId, async ({ taskCriteria }) => {
      const rows: BacklogTaskDto[] = []
      for (const task of visible) {
        rows.push({
          ...toTaskDto(task, actor),
          acceptance: toAcceptanceSummaryDto(
            await taskCriteria.listByTask(organizationId, task.id),
          ),
        })
      }
      return rows
    })
  }
}

export class ReorderBacklog {
  constructor(private readonly deps: AppDeps) {}

  async execute(ctx: TenantContext, actor: Actor, input: ReorderBacklogInput): Promise<void> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, BACKLOG_MODULE, 'existing')
    if (!canReorderBacklog(actor, organizationId))
      throw new PermissionDeniedError('Só o gestor reordena o backlog')
    const taskId = toTaskId(input.taskId)
    // Lê e grava na mesma transação: só as posições que mudaram entram, em lote (tudo ou nada).
    const changedIds = await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const task = await repositories.tasks.findById(organizationId, taskId)
      if (!task) throw new NotFoundError('Tarefa não encontrada')
      assertNotArchived(task)
      const backlog = await repositories.tasks.listBacklog(organizationId)
      const changes = moveInBacklog(backlog, taskId, input.placement)
      await repositories.tasks.saveBacklogRanks(organizationId, changes)
      return changes.map((change) => change.id)
    })
    if (changedIds.length > 0)
      await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: changedIds })
  }
}

interface BacklogMove {
  /** A tarefa depois da movimentação. O fluxo define `updatedAt`. */
  readonly task: Task
  /** Posições das outras tarefas do backlog que mudam por causa da movimentação. */
  readonly others: readonly BacklogRankChange[]
  /** Eventos próprios da movimentação, além dos que `diffTask` deduz (ida ao quadro, devolução). */
  readonly events: readonly TimelineEventDraft[]
}

/** Fluxo comum de levar ao quadro e devolver ao backlog: tarefa e posições na mesma transação. */
abstract class BacklogMoveUseCase {
  constructor(protected readonly deps: AppDeps) {}

  protected async move(
    ctx: TenantContext,
    actor: Actor,
    rawTaskId: string,
    plan: (task: Task, backlog: readonly Task[]) => BacklogMove,
  ): Promise<TaskDto> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, BACKLOG_MODULE, 'existing')
    const taskId = toTaskId(rawTaskId)
    const now = await this.deps.clock.now(organizationId)
    const { updated, changedIds } = await this.deps.unitOfWork.run(
      organizationId,
      async (repositories) => {
        const task = await repositories.tasks.findById(organizationId, taskId)
        if (!task) throw new NotFoundError('Tarefa não encontrada')
        if (!canEditTask(actor, task))
          throw new PermissionDeniedError('Sem permissão para editar esta tarefa')
        assertNotArchived(task)
        const backlog = await repositories.tasks.listBacklog(organizationId)
        const move = plan(task, backlog)
        const next: Task = { ...move.task, updatedAt: now }
        const events = await Promise.all(
          [...diffTask(task, next), ...move.events].map(async (draft) =>
            createTimelineEvent({
              ...draft,
              id: toEventId(await this.deps.idGenerator.generate(organizationId)),
              taskId: task.id,
              at: now,
              actorUserId: actor.userId,
              asManager: isManagerEdit(actor),
            }),
          ),
        )
        await repositories.tasks.save(organizationId, next)
        if (move.others.length > 0)
          await repositories.tasks.saveBacklogRanks(organizationId, move.others)
        if (events.length > 0) await repositories.timeline.saveMany(organizationId, events)
        return {
          updated: next,
          changedIds: [task.id, ...move.others.map((change) => change.id)],
        }
      },
    )
    await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: changedIds })
    return toTaskDto(updated, actor)
  }
}

export class TakeToBoard extends BacklogMoveUseCase {
  async execute(ctx: TenantContext, actor: Actor, input: BacklogTaskInput): Promise<TaskDto> {
    return this.move(ctx, actor, input.taskId, (task, backlog) => {
      // Recusa tarefa que não está no backlog (takeToBoard) antes de qualquer cálculo de posição.
      const onBoard = takeToBoard(task)
      // Sem a tarefa, o restante volta a 1..n: a tarefa vai ao fim e só as outras entram na lista.
      const others = moveInBacklog(backlog, task.id, 'end').filter(
        (change) => change.id !== task.id,
      )
      return { task: onBoard, others, events: [{ type: 'moved_to_board', payload: {} }] }
    })
  }
}

export class SendToBacklog extends BacklogMoveUseCase {
  async execute(ctx: TenantContext, actor: Actor, input: SendToBacklogInput): Promise<TaskDto> {
    return this.move(ctx, actor, input.taskId, (task, backlog) => {
      if (task.backlogRank !== null) throw new ValidationError('Tarefa já está no backlog')
      // Entra no fim e depois vai à posição pedida; moveInBacklog renumera o conjunto inteiro.
      const endRank = nextBacklogRank(backlog)
      const placed = sendToBacklog(task, endRank)
      const changes = moveInBacklog([...backlog, placed], task.id, input.placement ?? 'end')
      // Sem alteração para a própria tarefa, ela já está na posição final: é `endRank`, que coincide
      // com o índice dela quando o backlog é contíguo e a tarefa vai ao fim.
      const backlogRank = changes.find((change) => change.id === task.id)?.backlogRank ?? endRank
      // O estado (status) não muda ao devolver ao backlog (Q-a).
      return {
        task: sendToBacklog(task, backlogRank),
        others: changes.filter((change) => change.id !== task.id),
        events: [{ type: 'sent_to_backlog', payload: {} }],
      }
    })
  }
}
