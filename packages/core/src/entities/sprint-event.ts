import type { EventId, OrganizationId, SprintId, UserId } from '../shared/ids'
import type { SprintClosePolicy } from './sprint'

/**
 * Eventos da própria sprint (iniciada, encerrada). Estrutura pura para o M4.2 gravar onde fizer
 * sentido: a tabela não existe ainda. Eventos de tarefa (entrar e sair da sprint) estão em
 * `TimelineEvent`.
 */
interface SprintEventBase {
  readonly id: EventId
  readonly organizationId: OrganizationId
  readonly sprintId: SprintId
  readonly sprintNumber: number
  readonly at: string
  readonly actorUserId: UserId
  readonly asManager: boolean
}

export type SprintEvent = SprintEventBase &
  (
    | { readonly type: 'sprint_started'; readonly payload: Record<string, never> }
    | {
        readonly type: 'sprint_closed'
        readonly payload: {
          readonly closePolicy: SprintClosePolicy['kind']
          /** Quantos itens abertos seguiram para o backlog ou para a sprint seguinte. */
          readonly movedCount: number
        }
      }
  )
