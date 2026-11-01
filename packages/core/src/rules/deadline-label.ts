import { diffInDays } from '../values/date-only'
import type { DateOnly } from '../values/date-only'
import type { TaskStatus } from '../values/task-status'

export function deadlineLabel(
  status: TaskStatus,
  deadline: DateOnly | null,
  today: DateOnly,
): string {
  if (status === 'done') return 'Concluída'
  if (deadline === null) return 'Sem prazo definido'
  const days = diffInDays(today, deadline)
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  if (days > 1) return `Em ${days} dias`
  const overdue = -days
  return `Venceu há ${overdue} ${overdue === 1 ? 'dia' : 'dias'}`
}
