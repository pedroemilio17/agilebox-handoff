import {
  canEditEstimate,
  NotFoundError,
  PermissionDeniedError,
  setEstimatedHours,
  toTaskId,
  ValidationError,
} from '@agilebox/core'
import type { Actor, Task, TenantContext, TimelineEventDraft } from '@agilebox/core'
import { toTaskDto } from '../../mappers'
import type { TaskViewDto } from '../../mappers'
import type { AppDeps } from '../../deps'
import { ESTIMATES_HOURS_MODULE, requireModuleAccess } from '../../modules/guard'
import { assertTenant } from '../tenant-scope'
import { timelineEventsFor } from './timeline-events'

/*
 * Estimativa em horas da tarefa (M3.7, ADR-07). Regras:
 * - Definir ou limpar: `canEditEstimate` (quem edita a tarefa; o gestor também, B4 A).
 * - Módulo `estimates.hours` ativo ou encerrando (`existing`); desativado recusa citando o nome.
 * - Valor em centésimos de hora, validado pelo core (não negativo, inteiro, até 1000 h). Nulo limpa.
 * - Não toca nas horas realizadas: cada participação mantém as suas.
 * - Tarefa arquivada não recebe estimativa nova (mesma regra do backlog e dos critérios).
 * - Linha do tempo (M3.7b), na mesma transação: `estimate_changed` com antes e depois em centésimos,
 *   só se o valor mudou. Leva autor, data/hora e marcação Gestor. Não traz valor monetário.
 */

const ARCHIVED_ESTIMATE_MESSAGE =
  'Tarefa arquivada: desarquive a tarefa antes de alterar a estimativa'

export interface SetTaskEstimateInput {
  readonly taskId: string
  /** Estimativa em centésimos de hora (0,01 h), ou nulo para limpar. */
  readonly estimatedHoursHundredths: number | null
}

export class SetTaskEstimate {
  constructor(private readonly deps: AppDeps) {}

  async execute(
    ctx: TenantContext,
    actor: Actor,
    input: SetTaskEstimateInput,
  ): Promise<TaskViewDto> {
    const organizationId = assertTenant(ctx, actor)
    await requireModuleAccess(this.deps, organizationId, ESTIMATES_HOURS_MODULE, 'existing')
    const taskId = toTaskId(input.taskId)
    const now = await this.deps.clock.now(organizationId)
    const updated = await this.deps.unitOfWork.run(organizationId, async (repositories) => {
      const task = await repositories.tasks.findById(organizationId, taskId)
      if (!task) throw new NotFoundError('Tarefa não encontrada')
      assertCanEstimate(actor, task)
      const next: Task = {
        ...setEstimatedHours(task, input.estimatedHoursHundredths),
        updatedAt: now,
      }
      const events = await timelineEventsFor(
        this.deps,
        organizationId,
        taskId,
        actor,
        now,
        estimateDrafts(task, next),
      )
      await repositories.tasks.save(organizationId, next)
      if (events.length > 0) await repositories.timeline.saveMany(organizationId, events)
      return next
    })
    await this.deps.changeNotifier.publish(organizationId, { kind: 'task', ids: [taskId] })
    return toTaskDto(updated, actor)
  }
}

/** Evento só quando a estimativa muda de fato; repetir o mesmo valor não gera linha do tempo. */
function estimateDrafts(before: Task, after: Task): TimelineEventDraft[] {
  if (before.estimatedHours === after.estimatedHours) return []
  return [
    {
      type: 'estimate_changed',
      payload: { before: before.estimatedHours, after: after.estimatedHours },
    },
  ]
}

function assertCanEstimate(actor: Actor, task: Task): void {
  if (!canEditEstimate(actor, task))
    throw new PermissionDeniedError('Sem permissão para alterar a estimativa desta tarefa')
  if (task.archivedAt !== null) throw new ValidationError(ARCHIVED_ESTIMATE_MESSAGE)
}
