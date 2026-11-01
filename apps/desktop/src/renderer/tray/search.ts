export function normalizeSearch(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/** Filtra por título e projeto, ignorando acentos e maiúsculas. */
export function filterTasks<T extends { title: string; projectName: string }>(
  tasks: readonly T[],
  query: string,
): T[] {
  const needle = normalizeSearch(query)
  if (!needle) return [...tasks]
  return tasks.filter((task) =>
    normalizeSearch(`${task.title} ${task.projectName}`).includes(needle),
  )
}
