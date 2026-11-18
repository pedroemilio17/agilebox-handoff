/** Textos da conferência da definição de pronto (painel e bandeja). */
export const definitionCopy = {
  dialogTitle: 'Definição de pronto',
  eyebrow: 'Antes de concluir',
  checklistLabel: 'Itens da definição de pronto',
  criterionLegend: 'Critério de pronto do projeto',
  confirm: 'Concluir',
  cancel: 'Cancelar',
  returnTo: (status: string) => `Voltar para ${status}`,
  missing: (count: number) =>
    count === 1 ? 'Falta 1 item para concluir.' : `Faltam ${count} itens para concluir.`,
  reopened: 'A definição de pronto mudou desde a última conferência. Confirme os itens atuais.',
  loadError: 'Não foi possível carregar a definição de pronto. Tente de novo.',
}
