import type { TaskStatus } from '@agilebox/core'
import type { WbsRowDto, WbsViewDto } from '@agilebox/contract'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

/** Id de teste com 26 caracteres, no formato ULID aceito pelo contrato. */
export function wbsId(suffix: string): string {
  return `01J8Y4G2XK8Z1S6M3Q9W0${suffix.padStart(5, '0')}`
}

export function deliverableRow(
  id: string,
  options: {
    readonly parentId?: string | null
    readonly title?: string
    readonly code?: string
    readonly level?: number
    readonly hours?: number
    readonly cost?: number | null
    readonly progress?: number
    readonly tasks?: number
    readonly milestones?: { readonly id: string; readonly title: string; readonly dueOn: string }[]
  } = {},
): WbsRowDto {
  return {
    kind: 'deliverable',
    id,
    parentId: options.parentId ?? null,
    code: options.code ?? '1',
    title: options.title ?? `Entrega ${id}`,
    level: options.level ?? 1,
    totals: {
      hours: options.hours ?? 0,
      cost: options.cost === undefined ? 0 : options.cost,
      progress: options.progress ?? 0,
      tasks: options.tasks ?? 0,
      milestones: options.milestones ?? [],
    },
  }
}

export function taskRow(
  taskId: string,
  deliverableId: string,
  options: {
    readonly title?: string
    readonly status?: TaskStatus
    readonly responsibleName?: string | null
    readonly estimatedHours?: number | null
  } = {},
): WbsRowDto {
  const status = options.status ?? 'todo'
  return {
    kind: 'task',
    taskId,
    key: `AB-${taskId.slice(-3)}`,
    title: options.title ?? `Tarefa ${taskId}`,
    status,
    deliverableId,
    responsibleName: options.responsibleName ?? null,
    estimatedHours: options.estimatedHours ?? null,
    deadline: null,
    done: status === 'done',
  }
}

export function wbsView(
  deliverables: readonly WbsRowDto[],
  options: { readonly canEdit?: boolean; readonly summary?: Partial<WbsViewDto['summary']> } = {},
): WbsViewDto {
  const deliverableCount = deliverables.filter((row) => row.kind === 'deliverable').length
  const taskCount = deliverables.filter((row) => row.kind === 'task').length
  return {
    projectId: PROJECT_ID,
    canEdit: options.canEdit ?? true,
    deliverables: [...deliverables],
    summary: {
      deliverables: deliverableCount,
      tasks: taskCount,
      hours: 0,
      cost: 0,
      progress: 0,
      ...options.summary,
    },
    milestones: [],
    tasksWithoutDeliverable: 0,
  }
}

export const WBS_PROJECT_ID = PROJECT_ID
