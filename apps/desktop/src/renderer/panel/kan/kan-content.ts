import type { PanelView } from '../layout/PanelShell'

export interface KanScreenGuide {
  readonly title: string
  readonly summary: string
  readonly steps: readonly string[]
  readonly actions: readonly { readonly label: string; readonly faqKey: string }[]
}

export interface KanChecklistStep {
  readonly id: string
  readonly title: string
  readonly desc: string
}

export interface KanFaqItem {
  readonly id: string
  readonly cat: string
  readonly q: string
  readonly a: string
}

const GUIDE_HOME: KanScreenGuide = {
  title: 'Início do projeto (Home)',
  summary:
    'Visão rápida de tudo que acontece neste projeto: objetivo, ritmo por estado, bloqueios ativos, próximos encontros e pessoas envolvidas.',
  steps: [
    'Confira a faixa superior para ver andamento geral e próximo marco.',
    'Clique em qualquer bloqueio ou tarefa em destaque para agir imediatamente.',
    'Use os links rápidos para ir ao Quadro, Backlog ou Agenda do projeto.',
  ],
  actions: [
    { label: 'Para que servem os 5 estados?', faqKey: 'estados' },
    { label: 'O que é Pessoa externa (Entidade)?', faqKey: 'entidade' },
  ],
}

const GUIDE_BOARD: KanScreenGuide = {
  title: 'Quadro Kanban (5 estados)',
  summary:
    'Acompanhe o trabalho do começo ao fim em cinco colunas fixas: Planejamento, A fazer, Desenvolvendo, Revisar e Concluído.',
  steps: [
    'Crie uma tarefa rápida pelo botão + Nova tarefa ou pelo + no topo da coluna.',
    'Arraste ou altere o estado do cartão conforme o trabalho avança.',
    'Clique em qualquer tarefa para abrir detalhes, registrar bloqueio ou lançar horas.',
  ],
  actions: [
    { label: 'O que significa "1/3 simult."?', faqKey: 'wip' },
    { label: 'Diferença entre Minhas e Equipe', faqKey: 'escopo' },
    { label: 'Por que pediu Checklist ao concluir?', faqKey: 'dod' },
  ],
}

const GUIDE_DASHBOARD: KanScreenGuide = {
  title: 'Dashboard do Gestor',
  summary:
    'Visão executiva para detectar atrasos, bloqueios e carga do time sem burocracia. Ao abrir a tarefa de um colega, suas edições ficam marcadas como Gestor.',
  steps: [
    'Comece pela faixa "Precisa de você" para destravar bloqueios e prazos vencidos.',
    'Clique em um cartão de projeto para abrir o Quadro ou Cronograma dele.',
    'Clique em uma pessoa na tabela de Equipe para revisar e editar tarefas como Gestor.',
  ],
  actions: [
    { label: 'O que significa a marca "Gestor"?', faqKey: 'gestor' },
    { label: 'Quem vê os valores em R$?', faqKey: 'custo' },
    { label: 'Diferença entre Bloqueada e Sem atualização', faqKey: 'parada' },
  ],
}

const GUIDE_AGENDA: KanScreenGuide = {
  title: 'Agenda da Equipe',
  summary:
    'Reuniões de alinhamento, entregas e retrospectivas em uma grade semanal completa (segunda a domingo) com acesso rápido para criar novos encontros.',
  steps: [
    'Use o botão "+ Novo agendamento" no topo (disponível para Gestores).',
    'Alterne entre Semana, Dia e Mês sem cortar o domingo.',
    'Colaboradores consultam horários e combinados em modo leitura.',
  ],
  actions: [
    { label: 'Quem pode criar ou editar reuniões?', faqKey: 'agenda' },
    { label: 'Como funciona a atualização do dia (Daily)?', faqKey: 'daily' },
  ],
}

const GUIDE_BACKLOG: KanScreenGuide = {
  title: 'Backlog',
  summary:
    'Lista priorizada das próximas tarefas antes de irem para execução no quadro ou em uma sprint.',
  steps: [
    'Ordene os itens por prioridade de entrega do cliente ou time.',
    'Use "Enviar ao quadro" para mover um item direto para a coluna A fazer.',
    'Ou aloque os itens selecionados na próxima Sprint.',
  ],
  actions: [
    { label: 'O que é Backlog e diferença para Planejamento?', faqKey: 'backlog' },
    { label: 'O que é uma Sprint?', faqKey: 'sprint' },
  ],
}

const GUIDE_SPRINTS: KanScreenGuide = {
  title: 'Sprints & Ritmo',
  summary:
    'Organize ciclos curtos de entrega (1 a 2 semanas). Quando existe uma sprint em curso, acompanhe o andamento e o ritmo sem sair da tela.',
  steps: [
    'Mova cartões dentro da sprint ativa normalmente.',
    'Confira o ritmo da sprint (Burndown): abaixo da linha tracejada indica prazo em dia.',
    'Ao encerrar a sprint, decida o destino das tarefas pendentes.',
  ],
  actions: [
    { label: 'Como ler o gráfico de Ritmo (Burndown)?', faqKey: 'burndown' },
    { label: 'O que significam Tempo do pedido e Vazão?', faqKey: 'fluxo' },
  ],
}

const GUIDE_DELIVERABLES: KanScreenGuide = {
  title: 'Entregas do Projeto & Riscos',
  summary:
    'Divida o resultado final em grandes entregas (EAP) e crie tarefas diretamente dentro de cada entrega, mantendo riscos visíveis na matriz.',
  steps: [
    'Cadastre uma entrega principal (ex.: "Módulo de Pagamentos").',
    'Vincule tarefas diretamente a cada entrega para acompanhar progresso.',
    'Em Riscos, acompanhe probabilidade e impacto sem jargões.',
  ],
  actions: [
    { label: 'O que é EAP / Entregas?', faqKey: 'eap' },
    { label: 'Por que Entregas e Cronograma juntos?', faqKey: 'preditivo' },
  ],
}

const GUIDE_SCHEDULE: KanScreenGuide = {
  title: 'Cronograma, Marcos e Plano Salvo',
  summary:
    'Distribua datas na linha do tempo, defina o que depende de quê em linguagem simples, acompanhe marcos e congele o plano salvo (linha de base).',
  steps: [
    'Ajuste início e prazo das tarefas para visualizar o sequenciamento.',
    'Use "Esta tarefa só pode começar depois de..." para criar dependências claras.',
    'Em Linha de base, congele uma referência para comparar desvios sem surpresas.',
  ],
  actions: [
    { label: 'O que é Marco e Plano salvo (Linha de base)?', faqKey: 'baseline' },
    { label: 'Como funcionam dependências sem jargão?', faqKey: 'dependencia' },
  ],
}

const GUIDE_IMPEDIMENTS: KanScreenGuide = {
  title: 'Bloqueios e Impedimentos',
  summary:
    'Centralize o que está travando o time no projeto ativo e resolva impedimentos sem precisar procurar tarefa por tarefa.',
  steps: [
    'Veja motivo, responsável pela solução e há quantos dias a tarefa está bloqueada.',
    'Atribua quem vai destravar o impedimento para dar visibilidade ao time.',
    'Resolva o bloqueio em 1 clique para devolver a tarefa ao fluxo normal.',
  ],
  actions: [
    { label: 'Diferença entre Bloqueada e Sem atualização', faqKey: 'parada' },
    { label: 'O que significa a marca "Gestor"?', faqKey: 'gestor' },
  ],
}

const GUIDE_PROJECT_CONFIG: KanScreenGuide = {
  title: 'Configurações e Ferramentas do Projeto',
  summary:
    'Tudo que organiza este projeto em um único lugar: ferramentas ligadas, membros, checklist de conclusão e dados gerais.',
  steps: [
    'Ligue ou desligue ferramentas (Sprints, Limite simultâneo, Entregas) sem apagar dados.',
    'Gerencie membros com confirmação antes de remover alguém.',
    'Defina o Checklist de conclusão exigido ao mover tarefas para Concluído.',
  ],
  actions: [
    { label: 'Como adiciono membros ou mudo módulos?', faqKey: 'config' },
    { label: 'O que é Pessoa externa (Entidade)?', faqKey: 'entidade' },
  ],
}

const GUIDE_SETTINGS: KanScreenGuide = {
  title: 'Ajustes do Aplicativo',
  summary:
    'Suas preferências pessoais vêm primeiro: aparência (Vidro ou Sólido), seu valor/hora padrão e versão do app.',
  steps: [
    'Escolha entre janela em vidro fosco ou sólida (ideal no Linux/Windows conforme preferência).',
    'Defina seu próprio valor/hora padrão — só você e o gestor veem este valor.',
    'Gestores também acessam os padrões iniciais da organização nesta tela.',
  ],
  actions: [
    { label: 'Quem vê meu valor/hora em R$?', faqKey: 'custo' },
    { label: 'Qual a diferença entre Bandeja e Painel?', faqKey: 'bandeja' },
  ],
}

export function getKanScreenGuide(view: PanelView): KanScreenGuide {
  switch (view) {
    case 'home':
      return GUIDE_HOME
    case 'dashboard':
    case 'updates':
      return GUIDE_DASHBOARD
    case 'agenda':
      return GUIDE_AGENDA
    case 'backlog':
      return GUIDE_BACKLOG
    case 'sprints':
    case 'planSprint':
    case 'burndown':
    case 'flowMetrics':
      return GUIDE_SPRINTS
    case 'wbs':
    case 'plan':
    case 'risks':
      return GUIDE_DELIVERABLES
    case 'schedule':
    case 'tracking':
    case 'milestones':
    case 'baseline':
      return GUIDE_SCHEDULE
    case 'impediments':
      return GUIDE_IMPEDIMENTS
    case 'modules':
      return GUIDE_PROJECT_CONFIG
    case 'settings':
      return GUIDE_SETTINGS
    case 'projects':
    case 'plugins':
    default:
      return GUIDE_BOARD
  }
}

export const KAN_CHECKLISTS: Readonly<
  Record<'collaborator' | 'manager', readonly KanChecklistStep[]>
> = {
  collaborator: [
    {
      id: 'c1',
      title: 'Criar sua 1ª tarefa',
      desc: 'Use "+ Nova tarefa", Ctrl+K, a Bandeja ou peça direto ao Kan no chat.',
    },
    {
      id: 'c2',
      title: 'Mover uma tarefa para Desenvolvendo',
      desc: 'Arraste um cartão ou mude o estado no detalhe para sinalizar que começou.',
    },
    {
      id: 'c3',
      title: 'Registrar bloqueio ou horas trabalhadas',
      desc: 'Abra o detalhe da tarefa, informe um travamento ou lance suas horas (seu R$/h é privado).',
    },
    {
      id: 'c4',
      title: 'Fazer check-in rápido na Bandeja',
      desc: 'Abra a Bandeja no rodapé esquerdo e atualize o foco do dia em segundos.',
    },
  ],
  manager: [
    {
      id: 'm1',
      title: 'Revisar "Precisa de você" no Dashboard',
      desc: 'Confira tarefas vencidas, bloqueadas ou paradas há mais de 4 dias.',
    },
    {
      id: 'm2',
      title: 'Abrir o quadro de um colaborador',
      desc: 'Clique em uma pessoa na tabela Equipe; suas edições ficam marcadas como Gestor.',
    },
    {
      id: 'm3',
      title: 'Organizar o projeto em Configurações',
      desc: 'Ajuste membros, checklist de conclusão e módulos ativos no projeto.',
    },
    {
      id: 'm4',
      title: 'Agendar alinhamento ou revisar custos',
      desc: 'Crie uma reunião na Agenda e confira o custo total em R$ nas tarefas.',
    },
  ],
}

export const KAN_FAQ_ITEMS: readonly KanFaqItem[] = [
  {
    id: 'bandeja',
    cat: 'Dia 1',
    q: 'Qual a diferença entre a Bandeja e o Painel?',
    a: 'A Bandeja (360×560) é a mini-janela para criar ou atualizar tarefas em segundos sem cobrir seu trabalho. O Painel principal abre o quadro completo, cronograma, dashboard e configurações.',
  },
  {
    id: 'estados',
    cat: 'Dia 1',
    q: 'Para que servem os 5 estados do quadro?',
    a: 'Toda tarefa segue sempre esta ordem: Planejamento → A fazer → Desenvolvendo → Revisar → Concluído.',
  },
  {
    id: 'escopo',
    cat: 'Dia 1',
    q: 'Quais tarefas aparecem em "Minhas tarefas" vs. "Equipe"?',
    a: '"Minhas tarefas" mostra apenas tarefas que você criou ou participa como Responsável/Apoio. "Equipe" mostra todas as tarefas do projeto em modo leitura para transparência.',
  },
  {
    id: 'parada',
    cat: 'Dia 1',
    q: 'Qual a diferença entre "Bloqueada" e "Sem atualização (Parada)"?',
    a: '"Bloqueada" é um travamento que você registrou (ex.: aguardando senha ou cliente). "Sem atualização" é um aviso automático após 4 dias sem edição em uma tarefa em andamento.',
  },
  {
    id: 'entidade',
    cat: 'Dia 1',
    q: 'O que são "Entidades" (Pessoas externas)? Elas recebem avisos?',
    a: 'Entidades são stakeholders externos (como clientes ou parceiros), usados apenas para identificação na tarefa. Nunca concedem permissão no aplicativo nem enviam notificações.',
  },
  {
    id: 'gestor',
    cat: 'Gestão',
    q: 'O que significa a etiqueta "Gestor" na linha do tempo?',
    a: 'Toda edição gera uma entrada com data, autor e mudança na linha do tempo. Quando um Gestor edita ou move a tarefa de um colaborador, a entrada recebe a marca "Gestor" para transparência.',
  },
  {
    id: 'custo',
    cat: 'Gestão',
    q: 'Quem vê os valores em R$ (valor/hora e custo total)?',
    a: 'O custo da tarefa é a soma de (horas × valor/hora) por envolvido. Cada colaborador vê apenas o próprio valor/hora. Somente o Gestor vê os valores de todos e o custo total em R$.',
  },
  {
    id: 'wip',
    cat: 'Fluxo',
    q: 'O que é "Limite simultâneo" (WIP, ex.: 1/3 simult.)? Ele trava meu trabalho?',
    a: 'WIP (Work in Progress) é o máximo recomendado de tarefas ao mesmo tempo naquela coluna. Se passar do limite, o cabeçalho alerta visualmente, mas nunca impede você de mover o cartão.',
  },
  {
    id: 'dod',
    cat: 'Fluxo',
    q: 'O que é "Critério de pronto" (Checklist de conclusão)?',
    a: 'É uma lista padrão configurada no projeto com conferências mínimas antes de finalizar uma tarefa. Ao mover para Concluído, o sistema pede a confirmação dos itens.',
  },
  {
    id: 'backlog',
    cat: 'Fluxo',
    q: 'O que é "Backlog" e qual a diferença para "Planejamento"?',
    a: 'Backlog (próximas tarefas) organiza por prioridade o que ainda está em Planejamento antes de entrar em uma Sprint ou ir para "A fazer" no quadro.',
  },
  {
    id: 'sprint',
    cat: 'Fluxo',
    q: 'O que é uma Sprint?',
    a: 'É um ciclo curto com prazo definido (ex.: 1 ou 2 semanas) para o time focar em um pacote fechado de entregas e revisar o resultado ao final.',
  },
  {
    id: 'burndown',
    cat: 'Fluxo',
    q: 'Como leio o gráfico de Ritmo (Burndown) sem confundir bom e ruim?',
    a: 'A linha tracejada mostra o ritmo ideal descendo até zero. Ficar abaixo dela significa entrega dentro do prazo; ficar acima indica atraso ou risco de sobrar trabalho no fim da sprint.',
  },
  {
    id: 'fluxo',
    cat: 'Fluxo',
    q: 'O que significam Lead Time, Cycle Time e Vazão?',
    a: 'Lead Time é o tempo do pedido até a entrega final. Cycle Time é apenas o tempo em execução (desde que começou a desenvolver). Vazão é quantas tarefas são concluídas por semana.',
  },
  {
    id: 'eap',
    cat: 'Fluxo',
    q: 'O que é EAP / Entregas?',
    a: 'Estrutura Analítica do Projeto (EAP) divide o objetivo final em grandes entregas palpáveis (ex.: Infraestrutura, Portal, Treinamento) antes de detalhar tarefas individuais.',
  },
  {
    id: 'baseline',
    cat: 'Gestão',
    q: 'O que é Marco e Linha de base (Plano salvo)?',
    a: 'Marco é uma data-chave de entrega ou aprovação sem duração. Linha de base (Plano salvo) congela as datas e custos planejados para comparar desvios ao longo do projeto.',
  },
  {
    id: 'dependencia',
    cat: 'Fluxo',
    q: 'Como funcionam dependências no Cronograma?',
    a: 'Em vez de termos técnicos, você define em linguagem direta: "Esta tarefa só pode começar depois de [outra tarefa]".',
  },
  {
    id: 'agenda',
    cat: 'Gestão',
    q: 'Quem pode criar e editar agendamentos na Agenda?',
    a: 'Somente o Gestor cria e edita agendamentos. Colaboradores visualizam todos os compromissos da equipe e suas cerimônias.',
  },
  {
    id: 'daily',
    cat: 'Dia 1',
    q: 'Como funciona a atualização do dia (Daily) na Bandeja?',
    a: 'Um fluxo rápido em 3 passos na Bandeja para registrar o que avançou hoje, o que fará em seguida e eventuais travamentos, visível depois para o Gestor.',
  },
  {
    id: 'config',
    cat: 'Gestão',
    q: 'Como configuro módulos, membros e checklist do projeto?',
    a: 'Abra "Configurações" no menu do projeto atual na barra lateral. Desligar um módulo apenas oculta as telas correspondentes, sem apagar nenhum dado.',
  },
  {
    id: 'preditivo',
    cat: 'Fluxo',
    q: 'Por que usar Entregas e Cronograma no mesmo projeto?',
    a: 'Em projetos com data fixa, "Entregas" organiza o que precisa ser construído e "Cronograma" distribui no calendário com marcos e plano salvo.',
  },
]
