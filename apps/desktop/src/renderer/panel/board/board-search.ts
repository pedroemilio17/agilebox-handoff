/** Texto sem acento e em minúsculas, para comparar "autenticação" com "autenticacao". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Busca do quadro: o texto casa com o ID, o título ou o responsável da tarefa.
 * Texto vazio mostra tudo. Só usa dados já carregados no quadro.
 */
export function matchesBoardSearch(
  task: { readonly key: string; readonly title: string },
  responsibleName: string | undefined,
  query: string,
): boolean {
  const needle = normalize(query)
  if (needle === '') return true
  const haystack = [task.key, task.title, responsibleName ?? ''].map(normalize).join(' ')
  return haystack.includes(needle)
}
