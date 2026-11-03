/** Chaves de consulta do backlog. O detalhe da tarefa usa `queryKeys.tasks.detail`, o mesmo do quadro. */
export const backlogKeys = {
  all: ['agilebox', 'backlog'] as const,
  list: ['agilebox', 'backlog', 'list'] as const,
}
