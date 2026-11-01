import type { TaskStatus } from '@agilebox/core'

export const STATUS_COLOR_VAR: Readonly<Record<TaskStatus, string>> = {
  planning: 'var(--color-status-planejamento)',
  todo: 'var(--color-status-afazer)',
  in_progress: 'var(--color-status-desenvolvendo)',
  review: 'var(--color-status-revisar)',
  done: 'var(--color-status-concluido)',
}
