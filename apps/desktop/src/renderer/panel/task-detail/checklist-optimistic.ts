import type { GetTaskDto } from '@agilebox/contract'

/** Reflete a marcação na tarefa em cache antes da resposta do servidor (o progresso é recalculado). */
export function applyChecklistToggle(task: GetTaskDto, itemId: string, done: boolean): GetTaskDto {
  const checklist = task.checklist.map((item) =>
    item.id === itemId
      ? { ...item, done, doneAt: done ? (item.doneAt ?? new Date().toISOString()) : null }
      : item,
  )
  const doneCount = checklist.filter((item) => item.done).length
  const total = checklist.length
  return {
    ...task,
    checklist,
    checklistProgress: {
      done: doneCount,
      total,
      percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    },
  }
}
