const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Texto do indicador de atualização do quadro, como em "atualizado há 4 min". */
export function formatUpdatedAgo(updatedAt: number, now: number): string {
  const elapsed = Math.max(0, now - updatedAt)
  if (elapsed < MINUTE) return 'atualizado agora'
  if (elapsed < HOUR) return `atualizado há ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < 24 * HOUR) return `atualizado há ${Math.floor(elapsed / HOUR)} h`
  const days = Math.floor(elapsed / (24 * HOUR))
  return `atualizado há ${days} ${days === 1 ? 'dia' : 'dias'}`
}

/** Contagem de tarefas com plural em pt-BR. */
export function formatTaskCount(count: number): string {
  return `${count} ${count === 1 ? 'tarefa' : 'tarefas'}`
}
