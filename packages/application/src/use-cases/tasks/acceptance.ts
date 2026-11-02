import {
  addCriterion,
  canEditAcceptance,
  canViewTask,
  editCriterionText,
  NotFoundError,
  PermissionDeniedError,
  removeCriterion,
  reorderCriterion,
  setCriterionDone,
  toAcceptanceCriterionId,
  toTaskId,
  ValidationError,
} from '@agilebox/core'
import type {
  AcceptanceCriterion,
  AcceptanceCriterionId,
  Actor,
  Task,
  TenantContext,
  TimelineEventDraft,
} from '@agilebox/core'
import { toCriteriaViewDto } from '../../mappers'
import type { CriteriaViewDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { ACCEPTANCE_MODULE, requireModuleAccess } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'
import { timelineEventsFor } from './timeline-events'

/*
 * Critérios de aceite da tarefa (M3.6). Regras:
 * - Ler: quem vê a tarefa (criou, é Responsável, Apoio ou membro do projeto; gestor vê tudo).
 * - Editar (acrescentar, trocar texto, marcar, remover, reordenar): `canEditAcceptance`, ou seja, quem
 *   edita a tarefa (B3 A). O gestor também edita.
 * - Módulo `acceptance` ativo ou encerrando (`existing`); desativado recusa citando "Aceite".
 * - Tarefa arquivada não aceita edição de critérios. Leitura continua permitida.
 * - Id de outro time ou inexistente: NotFoundError. Contexto de outro time: PermissionDeniedError.
 * - Cada edição lê e grava a lista inteira na mesma transação (`replaceForTask`): tudo ou nada.
 * - Concluir a tarefa não depende de critérios conferidos (Q5): o resumo só informa.
 * - Linha do tempo (M3.6b), gravada na mesma transação: acrescentar (`criterion_added`), trocar o
 *   texto (`criterion_edited`, só se mudou), marcar ou desmarcar (`criterion_done_changed`, só se
 *   mudou), remover (`criterion_removed`). Reordenar não gera evento (como o backlog). Os eventos
 *   levam autor, data/hora e marcação Gestor, e não trazem valor monetário.
 */

const ARCHIVED_CRITERIA_MESSAGE =
  'Tarefa arquivada: desarquive a tarefa antes de editar os critérios de aceite'

export interface TaskCriteriaInput {
  readonly taskId: string
}

export interface AddCriterionInput extends TaskCriteriaInput {
  readonly text: string
}

export interface EditCriterionInput extends TaskCriteriaInput {
  readonly criterionId: string
  readonly text: string
}

export interface SetCriterionDoneInput extends TaskCriteriaInput {
  readonly criterionId: string
  readonly done: boolean
}

export interface RemoveCriterionInput extends TaskCriteriaInput {
  readonly criterionId: string
}

export interface ReorderCriterionInput extends TaskCriteriaInput {
  readonly criterionId: string
  /** Posição de destino, 0-based, dentro de 0..n-1. */
  readonly toIndex: number
}

/** Leitura da lista de critérios: quem vê a tarefa recebe a lista e o resumo. */
export class ListTaskCriteria {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: TaskCriteriaInput,
  ): Promise<CriteriaViewDto> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, ACCEPTANCE_MODULE, 'existing')
    const taskId = toTaskId(input.taskId)
    const task = await this.deps.tasks.findById(organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    const members = await this.deps.projects.listMembers(organizationId, task.projectId)
    const isMember = members.some((member) => member.userId === actor.userId)
    if (!canViewTask(actor, task, isMember))
      throw new PermissionDeniedError('Sem acesso a esta tarefa')
    const criteria = await this.deps.unitOfWork.run(organizationId, (repositories) =>
      repositories.taskCriteria.listByTask(organizationId, taskId),
    )
    return toCriteriaViewDto(criteria)
  }
}

/** Rascunhos da linha do tempo de uma edição, a partir da lista antes e depois. */
type CriteriaDrafts = (
  before: readonly AcceptanceCriterion[],
  after: readonly AcceptanceCriterion[],
) => TimelineEventDraft[]

/**
 * Base das edições. Confere contexto, módulo, existência, permissão e arquivada, lê a lista, aplica
 * a transformação pura do core, grava a lista e os eventos da linha do tempo, tudo na mesma transação.
 */
abstract class AcceptanceChange {
  constructor(protected readonly deps: AppDeps) {}

  protected async change(
    ctx: TenantContext,
    actor: Actor,
    rawTaskId: string,
    transform: (criteria: readonly AcceptanceCriterion[]) => AcceptanceCriterion[],
    drafts: CriteriaDrafts,
  ): Promise<CriteriaViewDto> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, ACCEPTANCE_MODULE, 'existing')
    const taskId = toTaskId(rawTaskId)
    const now = await this.deps.clock.now(organizationId)
    const criteria = await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const task = await repositories.tasks.findById(organizationId, taskId)
      if (!task) throw new NotFoundError('Tarefa não encontrada')
      assertCanEdit(actor, task)
      const before = await repositories.taskCriteria.listByTask(organizationId, taskId)
      const next = transform(before)
      const events = await timelineEventsFor(
        this.deps,
        organizationId,
        taskId,
        actor,
        now,
        drafts(before, next),
      )
      await repositories.taskCriteria.replaceForTask(organizationId, taskId, next)
      if (events.length > 0) await repositories.timeline.saveMany(organizationId, events)
      return next
    })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: [taskId] })
    return toCriteriaViewDto(criteria)
  }
}

function assertCanEdit(actor: Actor, task: Task): void {
  if (!canEditAcceptance(actor, task))
    throw new PermissionDeniedError('Sem permissão para editar os critérios desta tarefa')
  if (task.archivedAt !== null) throw new ValidationError(ARCHIVED_CRITERIA_MESSAGE)
}

/** Critério de uma lista já validada pelo core; ausente só se o id não pertence à tarefa. */
function criterionIn(
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
): AcceptanceCriterion {
  const found = criteria.find((criterion) => criterion.id === id)
  if (!found) throw new NotFoundError('Critério não encontrado')
  return found
}

export class AddCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: AddCriterionInput) {
    const organizationId = assertTenant(ctx, actor)
    // O id é gerado antes da transação; só entra na lista se a edição for permitida.
    const id = toAcceptanceCriterionId(await this.deps.idGenerator.generate(organizationId))
    return this.change(
      ctx,
      actor,
      input.taskId,
      (criteria) => addCriterion(criteria, { id, text: input.text }),
      (_before, after) => [
        { type: 'criterion_added', payload: { text: criterionIn(after, id).text } },
      ],
    )
  }
}

export class EditCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: EditCriterionInput) {
    return this.change(
      ctx,
      actor,
      input.taskId,
      (criteria) => editCriterionText(criteria, parseCriterionId(input.criterionId), input.text),
      (before, after) => {
        const id = parseCriterionId(input.criterionId)
        const text = criterionIn(after, id).text
        // Mesmo texto não é edição: sem evento.
        return criterionIn(before, id).text === text
          ? []
          : [{ type: 'criterion_edited', payload: { text } }]
      },
    )
  }
}

export class SetCriterionDone extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: SetCriterionDoneInput) {
    return this.change(
      ctx,
      actor,
      input.taskId,
      (criteria) => setCriterionDone(criteria, parseCriterionId(input.criterionId), input.done),
      (before, after) => {
        const id = parseCriterionId(input.criterionId)
        const previous = criterionIn(before, id)
        const current = criterionIn(after, id)
        // Repetir a mesma marcação é idempotente: sem evento.
        return previous.done === current.done
          ? []
          : [
              {
                type: 'criterion_done_changed',
                payload: { text: current.text, done: current.done },
              },
            ]
      },
    )
  }
}

export class RemoveCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: RemoveCriterionInput) {
    return this.change(
      ctx,
      actor,
      input.taskId,
      (criteria) => removeCriterion(criteria, parseCriterionId(input.criterionId)),
      (before) => [
        {
          type: 'criterion_removed',
          payload: { text: criterionIn(before, parseCriterionId(input.criterionId)).text },
        },
      ],
    )
  }
}

export class ReorderCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: ReorderCriterionInput) {
    // Reordenar não gera linha do tempo (como o backlog).
    return this.change(
      ctx,
      actor,
      input.taskId,
      (criteria) => reorderCriterion(criteria, parseCriterionId(input.criterionId), input.toIndex),
      () => [],
    )
  }
}

function parseCriterionId(value: string): AcceptanceCriterionId {
  return toAcceptanceCriterionId(value)
}
