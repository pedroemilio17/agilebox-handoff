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
} from '@agilebox/core'
import { toCriteriaViewDto } from '../../mappers'
import type { CriteriaViewDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { ACCEPTANCE_MODULE, requireModuleAccess } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'

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
 * - Pendente: a linha do tempo por edição de critério (criou, editou, marcou, removeu, com marcação
 *   Gestor). Exige tipos novos de evento no core (`TimelineEvent`), que não existem ainda.
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

/**
 * Base das edições. Confere contexto, módulo, existência, permissão e arquivada, lê a lista, aplica
 * a transformação pura do core e grava a lista inteira, tudo na mesma transação.
 */
abstract class AcceptanceChange {
  constructor(protected readonly deps: AppDeps) {}

  protected async change(
    ctx: TenantContext,
    actor: Actor,
    rawTaskId: string,
    transform: (criteria: readonly AcceptanceCriterion[]) => AcceptanceCriterion[],
  ): Promise<CriteriaViewDto> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, ACCEPTANCE_MODULE, 'existing')
    const taskId = toTaskId(rawTaskId)
    const criteria = await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const task = await repositories.tasks.findById(organizationId, taskId)
      if (!task) throw new NotFoundError('Tarefa não encontrada')
      assertCanEdit(actor, task)
      const next = transform(await repositories.taskCriteria.listByTask(organizationId, taskId))
      await repositories.taskCriteria.replaceForTask(organizationId, taskId, next)
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

export class AddCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: AddCriterionInput) {
    const organizationId = assertTenant(ctx, actor)
    // O id é gerado antes da transação; só entra na lista se a edição for permitida.
    const id = toAcceptanceCriterionId(await this.deps.idGenerator.generate(organizationId))
    return this.change(ctx, actor, input.taskId, (criteria) =>
      addCriterion(criteria, { id, text: input.text }),
    )
  }
}

export class EditCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: EditCriterionInput) {
    return this.change(ctx, actor, input.taskId, (criteria) =>
      editCriterionText(criteria, parseCriterionId(input.criterionId), input.text),
    )
  }
}

export class SetCriterionDone extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: SetCriterionDoneInput) {
    return this.change(ctx, actor, input.taskId, (criteria) =>
      setCriterionDone(criteria, parseCriterionId(input.criterionId), input.done),
    )
  }
}

export class RemoveCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: RemoveCriterionInput) {
    return this.change(ctx, actor, input.taskId, (criteria) =>
      removeCriterion(criteria, parseCriterionId(input.criterionId)),
    )
  }
}

export class ReorderCriterion extends AcceptanceChange {
  async execute(ctx: TenantContext, actor: Actor, input: ReorderCriterionInput) {
    return this.change(ctx, actor, input.taskId, (criteria) =>
      reorderCriterion(criteria, parseCriterionId(input.criterionId), input.toIndex),
    )
  }
}

function parseCriterionId(value: string): AcceptanceCriterionId {
  return toAcceptanceCriterionId(value)
}
