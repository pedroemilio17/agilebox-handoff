import { participates } from '../policies/access-policy'
import type { Actor } from '../policies/actor'
import type { Task } from '../entities/task'
import type { TimelineEvent } from '../entities/timeline-event'
import type { Participant } from '../entities/participation'
import type { TaskId } from '../shared/ids'
import { toDateOnly } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import { formatHours } from '../values/hours'
import { formatTaskKey } from '../values/task-key'
import { TASK_STATUS_LABELS } from '../values/task-status'
import type { TaskStatus } from '../values/task-status'
import { showsOnBoard } from './backlog'

/**
 * Sugestão do check-in, montada a partir da linha do tempo do dia. Cada item é um texto pt-BR curto,
 * com a chave e o título da tarefa (ex.: "AB-12 Título: foi para Revisar").
 */
export interface DailySuggestion {
  /** Tarefas movidas de estado no dia e horas lançadas pela própria pessoa, uma linha por tarefa. */
  readonly advanced: string[]
  /** Tarefas abertas em que a própria pessoa comentou no dia e que não entraram nas listas acima. */
  readonly nextCandidates: string[]
  /** Tarefas bloqueadas ou desbloqueadas no dia. */
  readonly blockers: string[]
}

export interface DailySuggestionInput {
  /** Quem faz o check-in. A sugestão é sempre sobre as tarefas dele. */
  readonly actor: Actor
  /** Tarefas candidatas. A regra descarta as que o ator não participa, arquivadas e de backlog. */
  readonly tasks: readonly Task[]
  /** Eventos da linha do tempo dessas tarefas. Eventos de outras tarefas são ignorados. */
  readonly events: readonly TimelineEvent[]
  /** Dia de calendário escolhido pelo cliente (fuso do cliente). */
  readonly date: DateOnly
  /** Fuso IANA do cliente, usado para dizer em que dia cai cada evento (ex.: "America/Sao_Paulo"). */
  readonly timeZone: string
  /** Prefixo de chave da organização (ex.: "AB"). */
  readonly prefix: string
}

function isActorParticipant(participant: Participant, userId: Actor['userId']): boolean {
  return participant.kind === 'user' && participant.userId === userId
}

/**
 * Monta a sugestão do check-in. Pura: não lê banco nem relógio. Sem eventos no dia, as três listas
 * saem vazias. A ordem é a do número da tarefa, então é estável entre chamadas.
 *
 * Regras de origem (decisão registrada em docs/laco):
 * - `advanced`: movimentos de estado de qualquer pessoa nas tarefas do ator, e horas lançadas
 *   pelo próprio ator. Movimento que volta ao estado inicial no mesmo dia não conta.
 * - `blockers`: bloqueio e desbloqueio de qualquer pessoa; vale o último evento do dia.
 * - `nextCandidates`: comentário do próprio ator em tarefa aberta e não bloqueada, fora das listas acima.
 */
export function suggestDailySummary(input: DailySuggestionInput): DailySuggestion {
  const { actor, date, timeZone, prefix } = input
  // Valida o fuso antes de olhar os eventos (fuso inválido vira ValidationError mesmo sem eventos).
  toDateOnly(new Date(0), timeZone)

  const eligible = input.tasks
    .filter((task) => task.archivedAt === null && showsOnBoard(task) && participates(actor, task))
    .sort((a, b) => a.number - b.number)
  const eligibleIds = new Set<TaskId>(eligible.map((task) => task.id))

  const dayEvents = input.events
    .filter(
      (event) => eligibleIds.has(event.taskId) && toDateOnly(new Date(event.at), timeZone) === date,
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))

  const moves = new Map<TaskId, { first: TaskStatus; last: TaskStatus }>()
  const hours = new Map<TaskId, number>()
  const lastBlockEvent = new Map<TaskId, TimelineEvent>()
  const commentedByActor = new Set<TaskId>()

  for (const event of dayEvents) {
    switch (event.type) {
      case 'status_changed': {
        const previous = moves.get(event.taskId)
        moves.set(event.taskId, {
          first: previous?.first ?? event.payload.before,
          last: event.payload.after,
        })
        break
      }
      case 'hours_changed':
        if (isActorParticipant(event.payload.participant, actor.userId)) {
          const delta = event.payload.after - event.payload.before
          hours.set(event.taskId, (hours.get(event.taskId) ?? 0) + delta)
        }
        break
      case 'blocked':
      case 'unblocked':
        lastBlockEvent.set(event.taskId, event)
        break
      case 'comment_added':
        if (event.actorUserId === actor.userId) commentedByActor.add(event.taskId)
        break
      default:
        break
    }
  }

  const label = (task: Task) => `${formatTaskKey(prefix, task.number)} ${task.title}`

  const advanced: string[] = []
  const advancedIds = new Set<TaskId>()
  for (const task of eligible) {
    const parts: string[] = []
    const move = moves.get(task.id)
    if (move && move.first !== move.last) parts.push(`foi para ${TASK_STATUS_LABELS[move.last]}`)
    const spent = hours.get(task.id) ?? 0
    if (spent > 0) parts.push(`lançou ${formatHours(spent)}`)
    if (parts.length === 0) continue
    advanced.push(`${label(task)}: ${parts.join(' · ')}`)
    advancedIds.add(task.id)
  }

  const blockers: string[] = []
  const blockerIds = new Set<TaskId>()
  for (const task of eligible) {
    const event = lastBlockEvent.get(task.id)
    if (!event) continue
    const text = event.type === 'blocked' ? `bloqueada (${event.payload.reason})` : 'desbloqueada'
    blockers.push(`${label(task)}: ${text}`)
    blockerIds.add(task.id)
  }

  const nextCandidates: string[] = []
  for (const task of eligible) {
    if (!commentedByActor.has(task.id)) continue
    if (advancedIds.has(task.id) || blockerIds.has(task.id)) continue
    if (task.status === 'done' || task.blockedReason !== null) continue
    nextCandidates.push(`${label(task)}: em ${TASK_STATUS_LABELS[task.status]}`)
  }

  return { advanced, nextCandidates, blockers }
}
