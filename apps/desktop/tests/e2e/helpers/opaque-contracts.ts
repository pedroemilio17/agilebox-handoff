export const VIEWPORTS = {
  PANEL_DEFAULT: { width: 1280, height: 780 },
  PANEL_COMPACT: { width: 960, height: 720 },
  TRAY_COMPACT: { width: 340, height: 88 },
  TRAY_EXPANDED: { width: 430, height: 630 },
} as const

export const TASK_STATUSES_PT = [
  'Planejamento',
  'A fazer',
  'Desenvolvendo',
  'Revisar',
  'Concluído',
] as const

export const SEED_DATA = {
  organization: 'AgileBox Demo',
  collaborator: 'Pedro',
  manager: 'Gestor',
  users: ['Pedro', 'Colaborador 2', 'Colaborador 3', 'Colaborador 4', 'Gestor'] as const,
  projects: ['Projeto A', 'Projeto B', 'Projeto C'] as const,
  externalEntities: ['Cliente Alfa', 'Parceiro Beta'] as const,
  sampleTask: 'Atualizar documentação da API',
  blockedTask: 'Configurar ambiente de homologação',
} as const

export const FORBIDDEN_UI_MARKERS = {
  protoBarSelector: '.proto-bar',
  geminiOnText: 'GEMINI ON',
  keyAiText: 'Chave AI',
} as const

export const KAN_TABS = ['Chat IA', 'Esta tela', 'Passos', 'Dúvidas'] as const

export const TRAY_ROTATING_PHRASES = [
  'Vamos atualizar as atividades de hoje?',
  'Como estão as entregas de hoje?',
  'Algum avanço para registrar agora?',
  'Quer revisar suas tarefas em foco?',
  'Dois minutos para deixar o quadro em dia?',
] as const

export const NAV_LABELS = {
  navigation: 'Navegação principal',
  expandRail: 'Expandir barra lateral',
  collapseRail: 'Recolher barra lateral',
  searchOrCreate: 'Buscar ou criar',
  globalSection: 'Global',
  myTasks: 'Minhas tarefas',
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  projectsSection: 'Projetos',
  newProject: 'Novo projeto',
  allProjects: 'Todos os projetos',
  showArchived: 'Mostrar arquivados',
  showArchivedAria: 'Mostrar projetos arquivados',
  systemSection: 'Sistema',
  settings: 'Ajustes',
  plugins: 'Plug-ins',
  comingSoon: 'Em breve',
  openTray: 'Abrir Bandeja',
  account: 'Conta',
  back: 'Voltar',
  newTask: 'Nova tarefa',
  help: 'Ajuda',
  windowMinimize: 'Minimizar',
  windowMaximize: 'Maximizar',
  windowClose: 'Fechar',
  kanTabsAria: 'Abas do Kan',
  kanSend: 'Enviar',
  kanUndo: 'Desfazer',
  kanUndone: 'Desfeito',
  kanConfirm: 'Confirmar',
  kanCancel: 'Cancelar',
} as const

export const BOARD_LABELS = {
  controlsAria: 'Controles do quadro',
  taskScopeAria: 'Escopo das tarefas',
  mine: 'Minhas tarefas',
  team: 'Equipe',
  filterAria: 'Filtrar prioridade ou bloqueio',
  closePreview: 'Fechar prévia',
  columnPrefix: 'Coluna',
} as const

export const TASK_DETAIL_TOPICS = {
  topicsAria: 'Tópicos da tarefa',
  topics: [
    'Visão geral',
    'Checklist & Pronto',
    'Pessoas & Prazo',
    'Horas & Custo',
    'Bloqueios & Histórico',
  ] as const,
  completeTask: 'Concluir tarefa',
  managerBadge: 'Gestor',
} as const

export const NEW_PROJECT_LABELS = {
  title: 'Criar novo projeto',
  steps: ['1. Nome', '2. Perguntas', '3. Revisão'] as const,
} as const

export const AGILE_LABELS = {
  tabs: ['Backlog', 'Sprints'] as const,
  sprintTopicsAria: 'Tópicos de Sprints',
  sprintTopics: [
    'Sprint ativa',
    'Planejamento',
    'Ritmo (Burndown)',
    'Métricas de fluxo',
    'Bloqueios',
  ] as const,
  closeSprint: 'Encerrar Sprint',
} as const

export const PREDICTIVE_LABELS = {
  topicsAria: 'Tópicos do Fluxo Preditivo',
  tabs: ['Entregas', 'Cronograma'] as const,
  deliveryTopics: ['Estrutura (EAP)', 'Riscos (3×3)'] as const,
  scheduleTopics: ['Linha do tempo', 'Dependências', 'Marcos', 'Plano salvo'] as const,
} as const

export const DASHBOARD_LABELS = {
  title: 'Dashboard do Gestor',
  modeAria: 'Modo do dashboard',
  modes: ['Visão geral', 'Atualizações'] as const,
  daySummary: 'Resumo do dia',
  collaborators: 'Colaboradores',
} as const

export const AGENDA_LABELS = {
  title: 'Agenda',
  prevPeriod: 'Período anterior',
  today: 'Hoje',
  nextPeriod: 'Próximo período',
  viewModeAria: 'Modo de visualização do calendário',
  viewModes: ['Dia', 'Semana', 'Mês'] as const,
  next7Days: 'Próximos 7 dias',
  retroActions: 'Ações da Retrospectiva',
  turnIntoTask: 'Transformar em tarefa',
  newMeeting: 'Novo agendamento',
} as const

export const SETTINGS_LABELS = {
  topicsAria: 'Tópicos de Configurações',
  projectTab: 'Projeto',
  appTab: 'Aplicativo',
  projectTopics: ['Ferramentas', 'Membros', 'Checklist (DoD)', 'Geral'] as const,
  appTopics: ['Minhas preferências', 'Padrões da empresa', 'Atualizações'] as const,
  kanAiTitle: 'Assistente Kan',
  kanApiKeyLabel: 'Chave da API Google AI Studio',
  kanModelLabel: 'Modelo Gemini',
  testConnection: 'Testar conexão',
  removeKey: 'Remover chave',
} as const

export const TRAY_LABELS = {
  trayAria: 'Bandeja do AgileBox',
  screens: ['prompt', 'home', 'kan', 'new', 'update', 'daily'] as const,
  openFullPanel: 'Abrir sistema completo',
  openTaskInPanel: 'Abrir tarefa no sistema completo',
  collapseToPrompt: 'Recolher para aviso',
  openKan: 'Abrir chat com o Kan',
  newTask: 'Nova tarefa',
  updateTask: 'Atualizar tarefa',
  dailyTitle: 'Atualização do dia',
  dirtyGuardText: 'Alterações não salvas',
  back: 'Voltar',
} as const
