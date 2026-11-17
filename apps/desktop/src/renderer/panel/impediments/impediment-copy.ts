/** Textos dos impedimentos (pt-BR). Usados pela tela, pelo detalhe da tarefa e pela bandeja. */
export const impedimentCopy = {
  title: 'Impedimentos',
  project: 'Projeto',
  allProjects: 'Todos os projetos',
  owner: 'Responsável',
  ownerAll: 'Todos',
  ownerMine: 'Meus',
  showResolved: 'Mostrar resolvidos',
  loading: 'Carregando impedimentos…',
  error: 'Não foi possível carregar os impedimentos.',
  retry: 'Tentar de novo',
  empty: 'Nenhum impedimento aberto.',
  emptyFiltered: 'Nenhum impedimento neste filtro.',
  noProjects: 'Nenhum projeto disponível.',
  list: 'Impedimentos abertos',
  listResolved: 'Impedimentos',

  open: 'Aberto',
  resolved: 'Resolvido',
  noOwner: 'Sem responsável',
  openedAgo: (relative: string) => `Aberto ${relative}`,
  resolvedOn: (date: string) => `Resolvido em ${date}`,
  resolutionNote: (note: string) => `Nota: ${note}`,
  ownerLine: (name: string) => `Responsável: ${name}`,
  openTask: (key: string) => `Abrir ${key}`,

  assign: 'Atribuir',
  assignTitle: 'Atribuir responsável',
  assignSelect: 'Responsável por resolver',
  assignSave: 'Salvar',
  assignCancel: 'Cancelar',
  assignError: 'Não foi possível atribuir o responsável.',
  assignDone: 'Responsável atualizado.',

  resolve: 'Resolver',
  resolveImpediment: 'Resolver impedimento',
  resolveTitle: 'Resolver impedimento',
  resolveBody: 'A tarefa sai do estado bloqueado. O impedimento sai da lista de abertos.',
  resolutionLabel: 'Nota de resolução (opcional)',
  resolutionTooLong: 'A nota deve ter até 280 caracteres.',
  resolveConfirm: 'Resolver',
  resolveError: 'Não foi possível resolver o impedimento.',
  resolveDone: 'Impedimento resolvido. A tarefa saiu do bloqueio.',

  ownerCandidatesLoading: 'Carregando quem pode resolver…',
  ownerCandidatesError: 'Não foi possível carregar quem pode resolver.',

  /** Formulário de bloqueio. */
  whoResolves: 'Quem resolve',
  whoResolvesHelp: 'Opcional. Escolha entre os participantes da tarefa e o gestor.',

  /** Detalhe da tarefa. */
  detailOpen: 'Aberto',
  detailAssigned: (name: string) => `Responsável: ${name}`,
  detailOpenedAgo: (relative: string) => `Aberto ${relative}`,
  historyTitle: 'Histórico de impedimentos',
  historyEmpty: 'Nenhum impedimento registrado nesta tarefa.',
  historyOpened: (date: string) => `Aberto em ${date}`,
  historyResolved: (date: string) => `Resolvido em ${date}`,

  /** Bandeja (check-in, passo do impedimento). */
  trayTitle: 'Seus impedimentos abertos',
  trayLoading: 'Carregando seus impedimentos…',
  trayError: 'Não foi possível carregar seus impedimentos.',
  trayEmpty: 'Nenhum impedimento aberto.',
  trayUse: 'Usar',
  trayHint: 'Usar coloca o texto no campo, para você editar. Nada é gravado até concluir.',
} as const

/** Título acessível do marcador "Bloqueada" com o responsável, quando existir. */
export function blockedMarkerLabel(reason: string | null, ownerName: string | null): string {
  const base = `Bloqueada: ${reason ?? ''}`
  return ownerName ? `${base} · ${impedimentCopy.ownerLine(ownerName)}` : base
}
