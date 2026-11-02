import { createTimelineEvent, isManagerEdit, toEventId } from '@agilebox/core'
import type {
  Actor,
  OrganizationId,
  TaskId,
  TimelineEvent,
  TimelineEventDraft,
} from '@agilebox/core'
import type { AppDeps } from '../../deps'

/**
 * Transforma os rascunhos de uma edição nos eventos gravados na linha do tempo (M3.6b, M3.7b).
 * Mesmo padrão do backlog: id gerado, tarefa, data/hora da edição, autor e marcação Gestor.
 * Deve ser chamado dentro da transação da alteração, para gravar tudo ou nada.
 */
export async function timelineEventsFor(
  deps: AppDeps,
  organizationId: OrganizationId,
  taskId: TaskId,
  actor: Actor,
  at: string,
  drafts: readonly TimelineEventDraft[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = []
  for (const draft of drafts) {
    events.push(
      createTimelineEvent({
        ...draft,
        id: toEventId(await deps.idGenerator.generate(organizationId)),
        taskId,
        at,
        actorUserId: actor.userId,
        asManager: isManagerEdit(actor),
      }),
    )
  }
  return events
}
