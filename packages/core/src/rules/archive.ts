/**
 * Visões padrão (quadro, equipe, recentes, frequentes, busca, dashboard, agenda e WIP) escondem
 * a tarefa arquivada e a tarefa de projeto arquivado. Arquivar nunca altera a tarefa em si:
 * desarquivar o projeto a devolve como estava.
 */
export function isHiddenByArchive(
  task: { readonly archivedAt: string | null },
  projectArchived: boolean,
): boolean {
  return task.archivedAt !== null || projectArchived
}
