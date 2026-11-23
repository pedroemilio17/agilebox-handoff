import {
  ApiError,
  type AgileBoxApi,
  type AiContextSnapshot,
  type AiProposedAction,
  type DefinitionOfDoneItemDto,
  type TaskDto,
} from '@agilebox/contract'
import { TASK_STATUS_LABELS, type DateOnly } from '@agilebox/core'
import { isDefinitionOfDoneNotConfirmed } from '../../shared/definition-of-done/definition-of-done'
import type { ConcludeRequest } from '../../shared/definition-of-done/use-definition-of-done-gate'

export interface KanActionReceipt {
  readonly id: string
  readonly summary: string
  readonly detail: string
  readonly undone: boolean
  readonly undo?: () => Promise<void>
}

export interface ExecuteKanActionsResult {
  readonly receipts: KanActionReceipt[]
  readonly errors: string[]
}

export type PromptDefinitionOfDone = (
  request: Omit<ConcludeRequest, 'complete' | 'onCancel'>,
  onConfirm: (confirmedIds: readonly string[]) => Promise<KanActionReceipt>,
) => Promise<{ confirmed: boolean; receipt?: KanActionReceipt; error?: string }>

let receiptSeq = 0
function nextReceiptId(): string {
  receiptSeq += 1
  return `kan-receipt-${receiptSeq}`
}

export function describeKanError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') return 'Você não tem permissão para esta alteração.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir a ação.'
}

function formatHoursShort(hours: number): string {
  const rounded = Math.round(hours * 100) / 100
  return `${String(rounded).replace('.', ',')}h`
}

async function resolveTargetTask(
  api: AgileBoxApi,
  context: AiContextSnapshot,
  taskId?: string,
  taskKey?: string,
): Promise<{ id: string; key: string; title: string } | null> {
  if (taskId) {
    const match = context.tasks.find((t) => t.id === taskId)
    return match
      ? { id: match.id, key: match.key, title: match.title }
      : { id: taskId, key: taskKey ?? taskId, title: '' }
  }
  if (taskKey) {
    const upper = taskKey.toUpperCase()
    const match = context.tasks.find((t) => t.key.toUpperCase() === upper)
    if (match) return { id: match.id, key: match.key, title: match.title }
    const searched: TaskDto[] = await api.tasks.search({ query: upper }).catch(() => [])
    const exact = searched.find((t) => t.key.toUpperCase() === upper) ?? searched[0]
    if (exact) return { id: exact.id, key: exact.key, title: exact.title }
  }
  return null
}

async function runMoveTask(
  api: AgileBoxApi,
  context: AiContextSnapshot,
  action: Extract<AiProposedAction, { kind: 'move_task' }>,
  promptDoD: PromptDefinitionOfDone,
): Promise<{ receipt?: KanActionReceipt; error?: string }> {
  const target = await resolveTargetTask(api, context, action.taskId, action.taskKey)
  if (!target) {
    return { error: `Tarefa ${action.taskKey ?? ''} não encontrada.`.trim() }
  }
  const detail = await api.tasks.get({ taskId: target.id })
  const previousStatus = detail.status
  if (previousStatus === action.status) {
    return {
      receipt: {
        id: nextReceiptId(),
        summary: `${detail.key} mantida em ${TASK_STATUS_LABELS[action.status]}`,
        detail: detail.title,
        undone: false,
      },
    }
  }

  const executeMove = async (confirmedIds: readonly string[]): Promise<KanActionReceipt> => {
    await api.tasks.move({
      taskId: detail.id,
      status: action.status,
      ...(confirmedIds.length > 0 ? { confirmedDefinitionItemIds: [...confirmedIds] } : {}),
    })
    return {
      id: nextReceiptId(),
      summary: `${detail.key} → ${TASK_STATUS_LABELS[action.status]}`,
      detail: detail.title,
      undone: false,
      undo: async () => {
        await api.tasks.move({ taskId: detail.id, status: previousStatus })
      },
    }
  }

  if (action.status === 'done') {
    const confirmation = await promptDoD(
      {
        projectId: detail.projectId,
        taskLabel: `${detail.key} · ${detail.title}`,
        returnTo: TASK_STATUS_LABELS[previousStatus],
        items: detail.projectDefinitionOfDone,
        definitionOfDoneCount: detail.projectDefinitionOfDone.length,
      },
      executeMove,
    )
    if (!confirmation.confirmed) {
      return { error: `Conclusão de ${detail.key} cancelada.` }
    }
    if (confirmation.error) return { error: confirmation.error }
    return confirmation.receipt ? { receipt: confirmation.receipt } : {}
  }

  return { receipt: await executeMove([]) }
}

async function runCreateTask(
  api: AgileBoxApi,
  context: AiContextSnapshot,
  action: Extract<AiProposedAction, { kind: 'create_task' }>,
  promptDoD: PromptDefinitionOfDone,
): Promise<{ receipt?: KanActionReceipt; error?: string }> {
  const projectId = action.projectId ?? context.projects[0]?.id
  if (!projectId) {
    return { error: 'Nenhum projeto disponível para criar a tarefa.' }
  }
  const desiredStatus = action.status ?? 'todo'

  const validDeadline =
    action.deadline === null ||
    (typeof action.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(action.deadline))
      ? action.deadline
      : undefined

  const executeCreate = async (confirmedIds: readonly string[]): Promise<KanActionReceipt> => {
    const created = await api.tasks.create({
      projectId,
      title: action.title,
      status: desiredStatus,
      ...(action.responsibleId ? { responsibleId: action.responsibleId } : {}),
      ...(validDeadline !== undefined ? { deadline: validDeadline } : {}),
      ...(confirmedIds.length > 0 ? { confirmedDefinitionItemIds: [...confirmedIds] } : {}),
    })
    return {
      id: nextReceiptId(),
      summary: `${created.key} criada`,
      detail: `${created.title} · ${TASK_STATUS_LABELS[created.status]}`,
      undone: false,
      undo: async () => {
        await api.tasks.archive({ taskId: created.id })
      },
    }
  }

  if (desiredStatus === 'done') {
    const items: DefinitionOfDoneItemDto[] = await api.projects.definitionOfDone
      .list({ projectId })
      .catch(() => [])
    if (items.length > 0) {
      const confirmation = await promptDoD(
        {
          projectId,
          taskLabel: action.title,
          returnTo: 'criação',
          items,
          definitionOfDoneCount: items.length,
        },
        executeCreate,
      )
      if (!confirmation.confirmed) {
        return { error: 'Criação da tarefa cancelada.' }
      }
      if (confirmation.error) return { error: confirmation.error }
      return confirmation.receipt ? { receipt: confirmation.receipt } : {}
    }
  }

  return { receipt: await executeCreate([]) }
}

export async function executeKanActions(params: {
  readonly api: AgileBoxApi
  readonly actorUserId: string
  readonly today: DateOnly
  readonly context: AiContextSnapshot
  readonly actions: readonly AiProposedAction[]
  readonly promptDoD: PromptDefinitionOfDone
}): Promise<ExecuteKanActionsResult> {
  const { api, actorUserId, today, context, actions, promptDoD } = params
  const receipts: KanActionReceipt[] = []
  const errors: string[] = []

  for (const action of actions) {
    try {
      switch (action.kind) {
        case 'create_task': {
          const outcome = await runCreateTask(api, context, action, promptDoD)
          if (outcome.receipt) receipts.push(outcome.receipt)
          if (outcome.error) errors.push(outcome.error)
          break
        }
        case 'move_task': {
          const outcome = await runMoveTask(api, context, action, promptDoD)
          if (outcome.receipt) receipts.push(outcome.receipt)
          if (outcome.error) errors.push(outcome.error)
          break
        }
        case 'log_hours': {
          const target = await resolveTargetTask(api, context, action.taskId, action.taskKey)
          if (!target) {
            errors.push(`Tarefa ${action.taskKey ?? ''} não encontrada.`.trim())
            break
          }
          const detail = await api.tasks.get({ taskId: target.id })
          let participation = detail.participations.find(
            (p) => p.participant.kind === 'user' && p.participant.userId === actorUserId,
          )
          if (!participation) {
            participation = await api.participations.add({
              taskId: detail.id,
              participant: { kind: 'user', userId: actorUserId },
              role: 'support',
            })
          }
          const previousHours = participation.hours
          const nextHours = Math.round((previousHours + action.hours) * 100) / 100
          const participationId = participation.id
          await api.participations.setHours({
            taskId: detail.id,
            participationId,
            hours: String(nextHours),
          })
          receipts.push({
            id: nextReceiptId(),
            summary: `+${formatHoursShort(action.hours)} em ${detail.key}`,
            detail: `Total: ${formatHoursShort(nextHours)} · ${detail.title}`,
            undone: false,
            undo: async () => {
              await api.participations.setHours({
                taskId: detail.id,
                participationId,
                hours: String(previousHours),
              })
            },
          })
          break
        }
        case 'block_task': {
          if (!context.capabilities.impediments) {
            errors.push('Impedimentos não estão ativos neste projeto.')
            break
          }
          const target = await resolveTargetTask(api, context, action.taskId, action.taskKey)
          if (!target) {
            errors.push(`Tarefa ${action.taskKey ?? ''} não encontrada.`.trim())
            break
          }
          await api.tasks.block({ taskId: target.id, reason: action.reason })
          receipts.push({
            id: nextReceiptId(),
            summary: `Bloqueio registrado em ${target.key}`,
            detail: action.reason,
            undone: false,
            undo: async () => {
              await api.tasks.unblock({ taskId: target.id })
            },
          })
          break
        }
        case 'unblock_task': {
          if (!context.capabilities.impediments) {
            errors.push('Impedimentos não estão ativos neste projeto.')
            break
          }
          const target = await resolveTargetTask(api, context, action.taskId, action.taskKey)
          if (!target) {
            errors.push(`Tarefa ${action.taskKey ?? ''} não encontrada.`.trim())
            break
          }
          await api.tasks.unblock({
            taskId: target.id,
            ...(action.resolution ? { resolution: action.resolution } : {}),
          })
          receipts.push({
            id: nextReceiptId(),
            summary: `Bloqueio removido de ${target.key}`,
            detail: action.resolution ?? target.title,
            undone: false,
          })
          break
        }
        case 'add_comment': {
          const target = await resolveTargetTask(api, context, action.taskId, action.taskKey)
          if (!target) {
            errors.push(`Tarefa ${action.taskKey ?? ''} não encontrada.`.trim())
            break
          }
          const comment = await api.tasks.comments.add({
            taskId: target.id,
            body: action.body,
          })
          receipts.push({
            id: nextReceiptId(),
            summary: `Comentário em ${target.key}`,
            detail: action.body,
            undone: false,
            undo: async () => {
              await api.tasks.comments.remove({ taskId: target.id, commentId: comment.id })
            },
          })
          break
        }
        case 'record_daily': {
          if (!context.capabilities.checkins) {
            errors.push('Check-ins não estão ativos neste projeto.')
            break
          }
          await api.daily.save({
            date: today,
            answers: {
              progress: action.progress,
              nextStep: action.nextStep ?? '',
              blocker: action.blocker ?? '',
            },
            noNews: false,
            taskRefs: [],
          })
          receipts.push({
            id: nextReceiptId(),
            summary: 'Atualização do dia salva',
            detail: action.progress,
            undone: false,
          })
          break
        }
      }
    } catch (error) {
      if (isDefinitionOfDoneNotConfirmed(error)) {
        errors.push('É necessário confirmar a definição de pronto para concluir.')
      } else {
        errors.push(describeKanError(error))
      }
    }
  }

  return { receipts, errors }
}
