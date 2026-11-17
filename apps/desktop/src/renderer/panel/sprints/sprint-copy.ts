/** Textos da tela de Sprints (pt-BR). Identificadores em inglês, textos da interface em português. */
export const sprintCopy = {
  title: 'Sprints',
  project: 'Projeto',
  loading: 'Carregando sprints…',
  backlogLoading: 'Carregando backlog…',
  error: 'Não foi possível carregar as sprints.',
  retry: 'Tentar de novo',
  noProjects: 'Nenhum projeto disponível.',
  tabsLabel: 'Situação das sprints',
  tabDraft: 'Planejamento',
  tabActive: 'Ativa',
  tabClosed: 'Encerradas',

  // Planejamento (rascunhos)
  draftsTitle: 'Rascunhos',
  draftsEmpty: 'Nenhum rascunho neste projeto.',
  draftsEmptyHint: 'Crie uma sprint para planejar os itens do backlog.',
  newSprint: 'Nova sprint',
  newSprintHelp:
    'Nome vazio vira “Sprint N”. Meta e datas são opcionais, exceto as datas planejadas.',
  draftSelect: (label: string) => `Abrir ${label}`,
  start: 'Iniciar sprint',
  startError: 'Não foi possível iniciar a sprint.',
  startDone: 'Sprint iniciada. Os itens do backlog foram para A fazer.',
  discard: 'Descartar rascunho',
  discardTitle: 'Descartar rascunho?',
  discardBody: 'O rascunho sai da lista. Nada é apagado de forma definitiva.',
  discardWithItems: 'Os itens dele voltam ao backlog.',
  discardConfirm: 'Descartar',
  discardError: 'Não foi possível descartar o rascunho.',
  edit: 'Editar',
  cancel: 'Cancelar',
  save: 'Salvar',
  saving: 'Salvando…',
  saveError: 'Não foi possível salvar a sprint.',
  saved: 'Sprint salva.',

  // Formulário
  nameLabel: 'Nome (opcional)',
  nameHint: 'Vazio vira “Sprint N”.',
  goalLabel: 'Meta (opcional)',
  goalCounter: (count: number, max: number) => `${count} de ${max} caracteres`,
  plannedStartLabel: 'Início planejado',
  plannedEndLabel: 'Fim planejado',
  dateRequired: 'Informe a data.',
  formCreate: 'Criar rascunho',

  // Itens
  items: 'Itens da sprint',
  noItems: 'Nenhum item nesta sprint.',
  noItemsDraftHint: 'Adicione itens do backlog abaixo.',
  removeItem: (title: string) => `Remover ${title} da sprint`,
  removeItemError: 'Não foi possível remover o item.',
  openItem: (title: string) => `Abrir ${title}`,
  estimatedTotal: (hours: string) => `Estimado: ${hours}`,
  backlogPick: 'Adicionar do backlog',
  backlogPickEmpty: 'Nenhum item no backlog deste projeto.',
  backlogAdd: (title: string) => `Adicionar ${title} à sprint`,
  backlogAddButton: 'Adicionar',
  backlogBusy: (label: string) => `Já está na ${label}`,
  addItemError: 'Não foi possível adicionar o item.',
  addedMidSprint: 'adicionado no meio da sprint',
  addedMidSprintNotice: (title: string) => `${title} adicionado no meio da sprint.`,

  // Ativa
  activeTitle: 'Sprints ativas',
  activeEmpty: 'Nenhuma sprint ativa neste projeto.',
  activeEmptyHint: 'Inicie uma sprint em Planejamento para vê-la aqui.',
  progress: (done: number, total: number) => `${done} de ${total} concluídos`,
  hoursEstimatedActual: (estimated: string, actual: string) =>
    `Estimado ${estimated} × realizado ${actual}`,
  startedOn: (date: string) => `Iniciada em ${date}`,
  close: 'Encerrar sprint',
  columnCount: (count: number) => `${count} ${count === 1 ? 'item' : 'itens'}`,
  noColumnItems: 'Nada aqui.',

  // Encerrar
  closeTitle: 'Encerrar sprint',
  closeSummary: (done: number, open: number, started: number) =>
    `Concluídos: ${done}. Abertos: ${open}. Já iniciados: ${started}.`,
  closePolicyLegend: 'O que fazer com os itens abertos',
  policyReturn: 'Devolver ao backlog',
  policyReturnHelp:
    'Itens ainda não iniciados voltam ao backlog. Os já iniciados ficam no quadro, sem sprint.',
  policyCarry: 'Levar para a próxima sprint',
  policyCarryHelp: 'Todos os itens abertos, inclusive os já iniciados, vão para a sprint seguinte.',
  nextSprintLabel: 'Sprint seguinte',
  noDraftForCarry: 'Não há rascunho neste projeto. Crie um em Planejamento para usar esta opção.',
  closeConfirm: 'Encerrar sprint',
  closeError: 'Não foi possível encerrar a sprint.',
  closed: 'Sprint encerrada.',

  // Encerradas
  closedTitle: 'Sprints encerradas',
  closedEmpty: 'Nenhuma sprint encerrada neste projeto.',
  closedHistory: 'Histórico de itens',
  historyEmpty: 'Nenhum item passou por esta sprint.',
  historyAdded: (date: string) => `entrou em ${date}`,
  historyRemoved: (date: string) => `saiu em ${date}`,
  replan: 'Replanejar',
  replanHelp: 'Cria um rascunho com a mesma duração, começando hoje.',
  replanError: 'Não foi possível criar o rascunho.',
  replanned: 'Rascunho criado para replanejar.',
  readOnly: 'Somente leitura',

  // Estados e desfechos
  outcome: {
    open: 'Em aberto',
    completed: 'Concluída',
    returned_to_backlog: 'Voltou ao backlog',
    carried_over: 'Levada para a próxima',
    left_on_board: 'Ficou no quadro',
    removed: 'Removida',
  },

  // Efeito passivo no detalhe
  sprintProperty: 'Sprint',

  // Encerrando (módulo)
  windingDownNotice:
    'Sprints em encerramento: não há criação nem novos itens. O que existe segue editável.',
  windingDownNoCreate: 'Criar e iniciar sprints está desligado enquanto o módulo encerra.',
  forbidden: 'Você não tem permissão para fazer isso.',
} as const
