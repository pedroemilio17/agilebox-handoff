import { ValidationError } from '../shared/errors'

export const TASK_PRIORITIES = ['normal', 'high'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = {
  normal: 'Normal',
  high: 'Alta',
}

export function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.some((priority) => priority === value)
}

export function parseTaskPriority(value: string): TaskPriority {
  if (!isTaskPriority(value)) {
    throw new ValidationError('Prioridade da tarefa inválida')
  }
  return value
}
