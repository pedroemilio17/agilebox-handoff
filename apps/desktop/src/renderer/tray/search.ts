export function normalizeSearch(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/**
 * Filtra por título e projeto, ignorando acentos e maiúsculas. Também aceita o ID da tarefa
 * ("AB-118", exato) ou só o número ("118").
 */
export function filterTasks<
  T extends { title: string; projectName: string; key: string; number: number },
>(tasks: readonly T[], query: string): T[] {
  const needle = normalizeSearch(query)
  if (!needle) return [...tasks]
  const key = query.trim().toUpperCase()
  const number = /^\d+$/u.test(key) ? Number(key) : null
  return tasks.filter(
    (task) =>
      task.key === key ||
      task.number === number ||
      normalizeSearch(`${task.title} ${task.projectName}`).includes(needle),
  )
}
