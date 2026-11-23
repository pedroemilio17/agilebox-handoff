/*
 * AgileBox · Shell Desktop, Paleta Ctrl+K & Kan Acoplado (Protótipo UX)
 * Compatível com file:// e http:// (sem módulos ES).
 */
(function () {
  'use strict';

  var STORAGE = {
    role: 'agilebox_proto_role',
    glass: 'agilebox_proto_glass',
    project: 'agilebox_proto_project',
    kanOpen: 'agilebox_proto_kan_open',
    kanTab: 'agilebox_proto_kan_tab',
    kanPos: 'agilebox_proto_kan_pos',
    kanSkipped: 'agilebox_proto_kan_skipped',
    kanSteps: 'agilebox_proto_kan_steps',
    sidebarCollapsed: 'agilebox_proto_sidebar_collapsed',
    sidebarExpandedProject: 'agilebox_proto_sidebar_expanded_proj'
  };

  var STATES = [
    { id: 'planejamento', label: 'Planejamento' },
    { id: 'afazer', label: 'A fazer' },
    { id: 'desenvolvendo', label: 'Desenvolvendo' },
    { id: 'revisar', label: 'Revisar' },
    { id: 'concluido', label: 'Concluído' }
  ];

  var PROJECTS = [
    { id: 'a', name: 'Projeto A', fullName: 'Projeto A · App de Vendas', preset: 'Híbrido', dotClass: 'is-a' },
    { id: 'b', name: 'Projeto B', fullName: 'Projeto B · Migração ERP', preset: 'Tradicional', dotClass: 'is-b' },
    { id: 'c', name: 'Projeto C', fullName: 'Projeto C · Projeto Simples', preset: 'Simples', dotClass: 'is-c' }
  ];

  var PEOPLE = [
    { id: 'ana', name: 'Ana', role: 'Design & UX', isManager: false },
    { id: 'joao', name: 'João', role: 'Suporte & Dev', isManager: false },
    { id: 'carlos', name: 'Carlos', role: 'Backend', isManager: false },
    { id: 'maria', name: 'Maria', role: 'QA & Testes', isManager: false },
    { id: 'pedro', name: 'Pedro', role: 'Colaborador', isManager: false },
    { id: 'carla', name: 'Carla', role: 'Gestora', isManager: true }
  ];

  var PAGE_META = {
    index: { title: 'Índice de Fluxos', breadcrumb: 'Índice de Fluxos', navId: 'index' },
    'projeto-home': { title: 'Início do projeto', breadcrumb: 'Início', navId: 'projeto-home' },
    quadro: { title: 'Quadro', breadcrumb: 'Quadro', navId: 'quadro' },
    dashboard: { title: 'Dashboard Gestor', breadcrumb: 'Dashboard Gestor', navId: 'dashboard' },
    agenda: { title: 'Agenda', breadcrumb: 'Agenda', navId: 'agenda' },
    agil: { title: 'Fluxo Ágil', breadcrumb: 'Backlog & Sprints', navId: 'backlog' },
    preditivo: { title: 'Fluxo Preditivo', breadcrumb: 'Entregas & Cronograma', navId: 'entregas' },
    configuracoes: { title: 'Configurações', breadcrumb: 'Configurações', navId: 'config-projeto' },
    'novo-projeto': { title: 'Novo Projeto', breadcrumb: 'Criar projeto', navId: 'novo-projeto' },
    bandeja: { title: 'Bandeja Rápida', breadcrumb: 'Bandeja', navId: 'bandeja' },
    bloqueios: { title: 'Bloqueios', breadcrumb: 'Bloqueios', navId: 'quadro' },
    tarefa: { title: 'Detalhe da Tarefa', breadcrumb: 'Detalhe da Tarefa', navId: 'quadro' }
  };

  var KAN_SCREEN_GUIDES = {
    'projeto-home': {
      title: 'Início do projeto (Home)',
      summary: 'Visão rápida de tudo que acontece neste projeto: objetivo, ritmo por estado, bloqueios ativos, próximos encontros e pessoas envolvidas.',
      steps: [
        'Confira a faixa superior para ver andamento geral e próximo marco.',
        'Clique em qualquer bloqueio ou tarefa em destaque para agir imediatamente.',
        'Use os links rápidos para ir ao Quadro, Backlog ou Agenda do projeto.'
      ],
      actions: [
        { label: 'Para que servem os 5 estados?', faqKey: 'estados' },
        { label: 'O que é Pessoa externa (Entidade)?', faqKey: 'entidade' }
      ]
    },
    quadro: {
      title: 'Quadro Kanban (5 estados)',
      summary: 'Acompanhe o trabalho do começo ao fim em cinco colunas fixas: Planejamento, A fazer, Desenvolvendo, Revisar e Concluído.',
      steps: [
        'Crie uma tarefa rápida pelo botão + Nova tarefa ou pelo + no topo da coluna.',
        'Arraste ou altere o estado do cartão conforme o trabalho avança.',
        'Clique em qualquer tarefa para abrir detalhes, registrar bloqueio ou lançar horas.'
      ],
      actions: [
        { label: 'O que significa "1/3 simult."?', faqKey: 'wip' },
        { label: 'Diferença entre Minhas e Equipe', faqKey: 'escopo' },
        { label: 'Por que pediu Checklist ao concluir?', faqKey: 'dod' }
      ]
    },
    dashboard: {
      title: 'Dashboard do Gestor',
      summary: 'Visão executiva para detectar atrasos, bloqueios e carga do time sem burocracia. Ao abrir a tarefa de um colega, suas edições ficam marcadas como Gestor.',
      steps: [
        'Comece pela faixa "Precisa de você" para destravar bloqueios e prazos vencidos.',
        'Clique em um cartão de projeto para abrir o Quadro ou Cronograma dele.',
        'Clique em uma pessoa na tabela de Equipe para revisar e editar tarefas como Gestor.'
      ],
      actions: [
        { label: 'O que significa a marca "Gestor"?', faqKey: 'gestor' },
        { label: 'Quem vê os valores em R$?', faqKey: 'custo' },
        { label: 'Diferença entre Bloqueada e Sem atualização', faqKey: 'parada' }
      ]
    },
    agenda: {
      title: 'Agenda da Equipe',
      summary: 'Reuniões de alinhamento, entregas e retrospectivas em uma grade semanal completa (segunda a domingo) com acesso rápido para criar novos encontros.',
      steps: [
        'Use o botão fixo "+ Novo agendamento" no topo (disponível para Gestores).',
        'Alterne entre Semana, Dia e Mês sem cortar o domingo.',
        'Colaboradores consultam horários e combinados em modo leitura.'
      ],
      actions: [
        { label: 'Quem pode criar ou editar reuniões?', faqKey: 'agenda' },
        { label: 'Como funciona a atualização do dia (Daily)?', faqKey: 'daily' }
      ]
    },
    'agil:backlog': {
      title: 'Backlog',
      summary: 'Lista priorizada das próximas tarefas antes de irem para execução no quadro ou em uma sprint.',
      steps: [
        'Ordene os itens por prioridade de entrega do cliente ou time.',
        'Use "Enviar ao quadro" para mover um item direto para a coluna A fazer.',
        'Ou aloque os itens selecionados na próxima Sprint.'
      ],
      actions: [
        { label: 'O que é Backlog e diferença para Planejamento?', faqKey: 'backlog' },
        { label: 'O que é uma Sprint?', faqKey: 'sprint' }
      ]
    },
    'agil:sprints': {
      title: 'Sprints & Ritmo',
      summary: 'Organize ciclos curtos de entrega (1 a 2 semanas). Quando existe uma sprint em curso, esta tela já abre direto na aba Ativa.',
      steps: [
        'Mova cartões dentro do quadro da sprint ativa normalmente.',
        'Confira o painel "Ritmo da sprint (Burndown)": abaixo da linha tracejada indica prazo em dia.',
        'Ao encerrar a sprint, decida o destino das tarefas pendentes e anote lições aprendidas.'
      ],
      actions: [
        { label: 'Como ler o gráfico de Ritmo (Burndown)?', faqKey: 'burndown' },
        { label: 'O que significam Tempo do pedido e Vazão?', faqKey: 'fluxo' }
      ]
    },
    'preditivo:entregas': {
      title: 'Entregas do Projeto & Riscos',
      summary: 'Divida o resultado final em grandes entregas (EAP) e crie tarefas diretamente dentro de cada entrega, mantendo riscos visíveis na matriz 3×3.',
      steps: [
        'Cadastre uma entrega principal (ex.: "Módulo de Pagamentos").',
        'Clique "+ Nova tarefa" dentro da própria entrega para quebrar o trabalho.',
        'Na aba Riscos, transforme qualquer risco materializado em tarefa ou bloqueio em 1 clique.'
      ],
      actions: [
        { label: 'O que é EAP / Entregas?', faqKey: 'eap' },
        { label: 'Por que Entregas e Cronograma juntos?', faqKey: 'preditivo' }
      ]
    },
    'preditivo:cronograma': {
      title: 'Cronograma, Marcos e Plano Salvo',
      summary: 'Distribua datas na linha do tempo, defina o que depende de quê em linguagem simples, acompanhe marcos e congele o plano salvo (linha de base).',
      steps: [
        'Clique em qualquer barra do cronograma para ajustar início e fim.',
        'Use "Esta tarefa só pode começar depois de..." para criar dependências claras.',
        'Na aba Plano salvo, congele uma referência para comparar desvios sem surpresas.'
      ],
      actions: [
        { label: 'O que é Marco e Plano salvo (Linha de base)?', faqKey: 'baseline' },
        { label: 'Como funcionam dependências sem jargão?', faqKey: 'dependencia' }
      ]
    },
    'configuracoes:projeto': {
      title: 'Configurações e Ferramentas do Projeto',
      summary: 'Tudo que organiza este projeto em um único lugar: ferramentas ligadas, membros, checklist de conclusão e dados gerais.',
      steps: [
        'Ligue ou desligue ferramentas (Sprints, Limite simultâneo, Entregas) sem apagar dados.',
        'Gerencie membros com confirmação antes de remover alguém.',
        'Defina o Checklist de conclusão exigido ao mover tarefas para Concluído.'
      ],
      actions: [
        { label: 'Como adiciono membros ou mudo módulos?', faqKey: 'config' },
        { label: 'O que é Pessoa externa (Entidade)?', faqKey: 'entidade' }
      ]
    },
    'configuracoes:app': {
      title: 'Ajustes do Aplicativo',
      summary: 'Suas preferências pessoais vêm primeiro: aparência (Vidro ou Sólido), seu valor/hora padrão e versão do app.',
      steps: [
        'Escolha entre janela em vidro fosco ou sólida (ideal no Linux/Windows conforme preferência).',
        'Defina seu próprio valor/hora padrão — só você e o gestor veem este valor.',
        'Gestores também acessam os padrões iniciais da organização nesta tela.'
      ],
      actions: [
        { label: 'Quem vê meu valor/hora em R$?', faqKey: 'custo' },
        { label: 'Qual a diferença entre Bandeja e Painel?', faqKey: 'bandeja' }
      ]
    },
    'novo-projeto': {
      title: 'Criar Novo Projeto',
      summary: 'Dê o nome uma única vez e escolha entre começar simples em 1 clique ou responder 3 perguntas rápidas sem siglas técnicas.',
      steps: [
        'Digite o nome do projeto (já focado automaticamente).',
        'Para ir direto ao trabalho, clique em "Criar projeto simples agora".',
        'Ou clique em "Me ajude a escolher" para sugerirmos o melhor fluxo.'
      ],
      actions: [
        { label: 'Posso mudar o formato depois?', faqKey: 'config' },
        { label: 'Para que servem os 5 estados?', faqKey: 'estados' }
      ]
    },
    bandeja: {
      title: 'Bandeja Rápida (360×560)',
      summary: 'Mini-janela de captura rápida para criar e atualizar tarefas sem cobrir o que você está fazendo.',
      steps: [
        'Veja suas tarefas "Em foco" logo abaixo da busca.',
        'Use @pessoa e #projeto no campo rápido do rodapé para criar em segundos.',
        'No fim do dia, responda à atualização diária em 3 passos curtos.'
      ],
      actions: [
        { label: 'Diferença entre Bandeja e Painel', faqKey: 'bandeja' },
        { label: 'Como funciona a atualização do dia?', faqKey: 'daily' }
      ]
    },
    tarefa: {
      title: 'Detalhe da Tarefa',
      summary: 'Barra única de ações no topo, envolvidos e pessoas externas em 1 clique, controle de horas com privacidade de R$ e linha do tempo transparente.',
      steps: [
        'Mude o estado ou registre um bloqueio direto na barra horizontal superior.',
        'Adicione colegas ou vincule uma Pessoa externa (cliente/parceiro) em 1 clique — sem login nem avisos.',
        'Lance suas horas em Horas e Custo (apenas você e o gestor veem seu R$/h) e acompanhe a Linha do tempo com marca Gestor.'
      ],
      actions: [
        { label: 'O que é Pessoa externa (Entidade)?', faqKey: 'entidade' },
        { label: 'Quem vê meu valor/hora em R$?', faqKey: 'custo' },
        { label: 'O que significa a marca "Gestor"?', faqKey: 'gestor' }
      ]
    },
    bloqueios: {
      title: 'Bloqueios e Impedimentos',
      summary: 'Centralize o que está travando o time no projeto ativo e resolva impedimentos sem precisar procurar tarefa por tarefa.',
      steps: [
        'Veja motivo, responsável pela solução e há quantos dias a tarefa está bloqueada.',
        'Clique "+ Registrar bloqueio" para apontar um novo travamento diretamente aqui.',
        'Resolva o bloqueio em 1 clique para devolver a tarefa ao fluxo normal.'
      ],
      actions: [
        { label: 'Diferença entre Bloqueada e Sem atualização', faqKey: 'parada' },
        { label: 'O que significa a marca "Gestor"?', faqKey: 'gestor' }
      ]
    }
  };

  var KAN_CHECKLISTS = {
    collaborator: [
      {
        id: 'c1',
        title: 'Criar sua 1ª tarefa',
        desc: 'Use "+ Nova tarefa", Ctrl+K ou a Bandeja para registrar algo para fazer.'
      },
      {
        id: 'c2',
        title: 'Mover uma tarefa para Desenvolvendo',
        desc: 'Arraste um cartão ou mude o estado no detalhe para sinalizar que começou.'
      },
      {
        id: 'c3',
        title: 'Registrar bloqueio ou horas trabalhadas',
        desc: 'Abra o detalhe da tarefa, informe um travamento ou lance suas horas (seu R$/h é privado).'
      },
      {
        id: 'c4',
        title: 'Fazer check-in rápido na Bandeja',
        desc: 'Abra a Bandeja no rodapé esquerdo e atualize o foco do dia em segundos.'
      }
    ],
    manager: [
      {
        id: 'm1',
        title: 'Revisar "Precisa de você" no Dashboard',
        desc: 'Confira tarefas vencidas, bloqueadas ou paradas há mais de 4 dias.'
      },
      {
        id: 'm2',
        title: 'Abrir o quadro de um colaborador',
        desc: 'Clique em uma pessoa na tabela Equipe; suas edições ficam marcadas como Gestor.'
      },
      {
        id: 'm3',
        title: 'Organizar o projeto em Config. e Ferramentas',
        desc: 'Ajuste membros, checklist de conclusão e módulos ativos no projeto.'
      },
      {
        id: 'm4',
        title: 'Agendar alinhamento ou revisar custos',
        desc: 'Crie uma reunião na Agenda e confira o custo total em R$ nas tarefas.'
      }
    ]
  };

  var FAQ_ITEMS = [
    {
      id: 'bandeja',
      cat: 'Dia 1',
      q: 'Qual a diferença entre a Bandeja e o Painel?',
      a: 'A Bandeja (360×560) é a mini-janela para criar ou atualizar tarefas em segundos sem cobrir seu trabalho. O Painel principal abre o quadro completo, cronograma, dashboard e configurações.'
    },
    {
      id: 'estados',
      cat: 'Dia 1',
      q: 'Para que servem os 5 estados do quadro?',
      a: 'Toda tarefa segue sempre esta ordem: Planejamento → A fazer → Desenvolvendo → Revisar → Concluído.'
    },
    {
      id: 'escopo',
      cat: 'Dia 1',
      q: 'Quais tarefas aparecem em "Minhas tarefas" vs. "Equipe"?',
      a: '"Minhas tarefas" mostra apenas tarefas que você criou ou participa como Responsável/Apoio. "Equipe" mostra todas as tarefas do projeto em modo leitura para transparência.'
    },
    {
      id: 'parada',
      cat: 'Dia 1',
      q: 'Qual a diferença entre "Bloqueada" e "Sem atualização (Parada)"?',
      a: '"Bloqueada" é um travamento que você registrou (ex.: aguardando senha ou cliente). "Sem atualização" é um aviso automático após 4 dias sem edição em uma tarefa em andamento.'
    },
    {
      id: 'entidade',
      cat: 'Dia 1',
      q: 'O que são "Entidades" (Pessoas externas)? Elas recebem avisos?',
      a: 'Entidades são stakeholders externos (como clientes ou parceiros), usados apenas para identificação na tarefa. Nunca concedem permissão no aplicativo nem enviam notificações.'
    },
    {
      id: 'gestor',
      cat: 'Gestão',
      q: 'O que significa a etiqueta violeta "Gestor" na linha do tempo?',
      a: 'Toda edição gera uma entrada com data, autor e mudança na linha do tempo. Quando um Gestor edita ou move a tarefa de um colaborador, a entrada recebe a marca violeta "Gestor" para transparência.'
    },
    {
      id: 'custo',
      cat: 'Gestão',
      q: 'Quem vê os valores em R$ (valor/hora e custo total)?',
      a: 'O custo da tarefa é a soma de (horas × valor/hora) por envolvido. Cada colaborador vê apenas o próprio valor/hora. Somente o Gestor vê os valores de todos e o custo total em R$.'
    },
    {
      id: 'wip',
      cat: 'Fluxo',
      q: 'O que é "Limite simultâneo" (WIP, ex.: 1/3 simult.)? Ele trava meu trabalho?',
      a: 'WIP (Work in Progress) é o máximo recomendado de tarefas ao mesmo tempo naquela coluna. Se passar do limite, o cabeçalho alerta visualmente, mas nunca impede você de mover o cartão.'
    },
    {
      id: 'dod',
      cat: 'Fluxo',
      q: 'O que é "Critério de pronto" (Checklist de conclusão)?',
      a: 'É uma lista padrão configurada no projeto com conferências mínimas antes de finalizar uma tarefa. Ao mover para Concluído, o sistema pede a confirmação dos itens.'
    },
    {
      id: 'backlog',
      cat: 'Fluxo',
      q: 'O que é "Backlog" e qual a diferença para "Planejamento"?',
      a: 'Backlog (próximas tarefas) organiza por prioridade o que ainda está em Planejamento antes de entrar em uma Sprint ou ir para "A fazer" no quadro.'
    },
    {
      id: 'sprint',
      cat: 'Fluxo',
      q: 'O que é uma Sprint?',
      a: 'É um ciclo curto com prazo definido (ex.: 1 ou 2 semanas) para o time focar em um pacote fechado de entregas e revisar o resultado ao final.'
    },
    {
      id: 'burndown',
      cat: 'Fluxo',
      q: 'Como leio o gráfico de Ritmo (Burndown) sem confundir bom e ruim?',
      a: 'A linha tracejada mostra o ritmo ideal descendo até zero. Ficar abaixo dela significa entrega dentro do prazo; ficar acima indica atraso ou risco de sobrar trabalho no fim da sprint.'
    },
    {
      id: 'fluxo',
      cat: 'Fluxo',
      q: 'O que significam Lead Time, Cycle Time e Vazão?',
      a: 'Lead Time é o tempo do pedido até a entrega final. Cycle Time é apenas o tempo em execução (desde que começou a desenvolver). Vazão é quantas tarefas são concluídas por semana.'
    },
    {
      id: 'eap',
      cat: 'Fluxo',
      q: 'O que é EAP / Entregas?',
      a: 'Estrutura Analítica do Projeto (EAP) divide o objetivo final em grandes entregas palpáveis (ex.: Infraestrutura, Portal, Treinamento) antes de detalhar tarefas individuais.'
    },
    {
      id: 'baseline',
      cat: 'Gestão',
      q: 'O que é Marco e Linha de base (Plano salvo)?',
      a: 'Marco é uma data-chave de entrega ou aprovação sem duração. Linha de base (Plano salvo) congela as datas e custos planejados para comparar desvios ao longo do projeto.'
    },
    {
      id: 'dependencia',
      cat: 'Fluxo',
      q: 'Como funcionam dependências no Cronograma?',
      a: 'Em vez de termos técnicos, você define em linguagem direta: "Esta tarefa só pode começar depois de [outra tarefa]".'
    },
    {
      id: 'agenda',
      cat: 'Gestão',
      q: 'Quem pode criar e editar agendamentos na Agenda?',
      a: 'Somente o Gestor cria e edita agendamentos. Colaboradores visualizam todos os compromissos da equipe e suas cerimônias.'
    },
    {
      id: 'daily',
      cat: 'Dia 1',
      q: 'Como funciona a atualização do dia (Daily) na Bandeja?',
      a: 'Um fluxo rápido em 3 passos na Bandeja para registrar o que avançou hoje, o que fará em seguida e eventuais travamentos, visível depois para o Gestor.'
    },
    {
      id: 'config',
      cat: 'Gestão',
      q: 'Como configuro módulos, membros e checklist do projeto?',
      a: 'Abra "Config. e Ferramentas" no menu do projeto atual na barra lateral. Desligar um módulo apenas oculta as telas correspondentes, sem apagar nenhum dado.'
    },
    {
      id: 'preditivo',
      cat: 'Fluxo',
      q: 'Por que usar Entregas e Cronograma no mesmo projeto?',
      a: 'Em projetos com data fixa, "Entregas" organiza o que precisa ser construído e "Cronograma" distribui no calendário com marcos e plano salvo.'
    }
  ];

  /* ========================================================================
     Helpers de estado
     ======================================================================== */
  function readStorage(key, fallback) {
    try {
      var val = window.localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeStorage(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {
      /* ignore storage quota errors */
    }
  }

  function getUrlParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name);
    } catch (e) {
      return null;
    }
  }

  function getPage() {
    return (document.body && document.body.getAttribute('data-page')) || 'quadro';
  }

  function getTab() {
    var param = getUrlParam('tab');
    if (param) return param;
    var page = getPage();
    if (page === 'agil') return 'backlog';
    if (page === 'preditivo') return 'entregas';
    if (page === 'configuracoes') return 'projeto';
    return '';
  }

  function getRole() {
    var r = readStorage(STORAGE.role, 'collaborator');
    return r === 'manager' ? 'manager' : 'collaborator';
  }

  function getGlass() {
    var g = readStorage(STORAGE.glass, 'glass');
    return g === 'opaque' ? 'opaque' : 'glass';
  }

  function getProjectId() {
    var pUrl = getUrlParam('projeto');
    if (pUrl === 'a' || pUrl === 'b' || pUrl === 'c') {
      writeStorage(STORAGE.project, pUrl);
      return pUrl;
    }
    var p = readStorage(STORAGE.project, 'a');
    return p === 'b' || p === 'c' ? p : 'a';
  }

  function getProject() {
    var id = getProjectId();
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].id === id) return PROJECTS[i];
    }
    return PROJECTS[0];
  }

  function getCompletedSteps(role) {
    try {
      var raw = readStorage(STORAGE.kanSteps, '{}');
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed[role]) ? parsed[role] : [];
    } catch (e) {
      return [];
    }
  }

  function saveCompletedSteps(role, ids) {
    try {
      var raw = readStorage(STORAGE.kanSteps, '{}');
      var parsed = JSON.parse(raw);
      parsed[role] = ids;
      writeStorage(STORAGE.kanSteps, JSON.stringify(parsed));
    } catch (e) {
      /* ignore */
    }
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) {
      /* ignore */
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ========================================================================
     Ícones SVG limpos (inline)
     ======================================================================== */
  var ICONS = {
    home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
    tasks: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="8" rx="1"/></svg>',
    dashboard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V11M10 20V5M16 20v-7M2 20h20"/></svg>',
    agenda: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    board: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v7h-4z"/></svg>',
    backlog: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    sprints: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/></svg>',
    entregas: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M7 12h13M10 18h10"/></svg>',
    cronograma: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h8M9 12h11M5 17h7"/></svg>',
    config: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    plugins: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4"/></svg>',
    tray: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 14h5l1.5 2h3L15 14h5"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    chevDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
    chevRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    arrowLeft: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    collapse: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>'
  };

  /* ========================================================================
     Aplica atributos iniciais no <html> antes da montagem
     ======================================================================== */
  document.documentElement.dataset.role = getRole();
  document.documentElement.dataset.glass = getGlass();

  var shellRefs = {};
  var paletteState = {
    open: false,
    selectedIndex: 0,
    mentionMode: null, // '@' | '#' | null
    mentionIndex: 0
  };

  /* ========================================================================
     Construção da Barra de Protótipo (34px)
     ======================================================================== */
  function buildProtoBar(page) {
    var meta = PAGE_META[page] || { title: page, breadcrumb: page };
    var role = getRole();
    var glass = getGlass();

    var bar = document.createElement('header');
    bar.className = 'proto-bar';
    bar.setAttribute('aria-label', 'Controles do protótipo UX');

    bar.innerHTML =
      '<div class="proto-bar-left">' +
      (page === 'index'
        ? '<span class="proto-screen-pill"><strong>AgileBox UX</strong> · Mapa dos fluxos revisados</span>'
        : '<a class="proto-back-link" href="index.html">← Índice de fluxos</a>' +
          '<span class="proto-screen-pill">Tela: <strong id="ab-proto-screen-name">' + escapeHtml(meta.title) + '</strong></span>') +
      '</div>' +
      '<div class="proto-bar-right">' +
        '<div class="proto-control-group" role="group" aria-label="Alternar papel">' +
          '<span class="proto-control-label">Papel:</span>' +
          '<div class="proto-seg">' +
            '<button type="button" class="proto-seg-btn' + (role === 'collaborator' ? ' is-active' : '') + '" data-proto-role="collaborator" data-role-val="collaborator">Colaborador</button>' +
            '<button type="button" class="proto-seg-btn' + (role === 'manager' ? ' is-active' : '') + '" data-proto-role="manager" data-role-val="manager">Gestor</button>' +
          '</div>' +
        '</div>' +
        '<div class="proto-control-group" role="group" aria-label="Alternar superfície">' +
          '<span class="proto-control-label">Superfície:</span>' +
          '<div class="proto-seg">' +
            '<button type="button" class="proto-seg-btn' + (glass === 'glass' ? ' is-active' : '') + '" data-proto-glass="glass">Vidro</button>' +
            '<button type="button" class="proto-seg-btn' + (glass === 'opaque' ? ' is-active' : '') + '" data-proto-glass="opaque">Sólido</button>' +
          '</div>' +
        '</div>' +
        (page !== 'index' && page !== 'bandeja'
          ? '<button type="button" class="proto-mini-btn" id="ab-proto-kan-btn" title="Alternar painel Kan (F1)">Kan · F1</button>'
          : '') +
        '<button type="button" class="proto-mini-btn" id="ab-proto-k-btn" title="Abrir paleta de comandos (Ctrl+K)">Ctrl+K</button>' +
      '</div>';

    bar.addEventListener('click', function (ev) {
      var roleBtn = ev.target.closest('[data-proto-role]');
      if (roleBtn) {
        setRole(roleBtn.getAttribute('data-proto-role'));
        return;
      }
      var glassBtn = ev.target.closest('[data-proto-glass]');
      if (glassBtn) {
        setGlass(glassBtn.getAttribute('data-proto-glass'));
        return;
      }
      if (ev.target.closest('#ab-proto-kan-btn')) {
        toggleKan();
        return;
      }
      if (ev.target.closest('#ab-proto-k-btn')) {
        openPalette('');
      }
    });

    return bar;
  }

  /* ========================================================================
     Construção do Shell Desktop Completo
     ======================================================================== */
  function isActiveNav(navHref, page, tab) {
    var scope = getUrlParam('scope');
    if (navHref === 'projeto-home.html') return page === 'projeto-home';
    if (navHref === 'quadro.html?scope=mine') return page === 'quadro' && scope === 'mine';
    if (navHref === 'quadro.html') return (page === 'quadro' && scope !== 'mine') || page === 'tarefa';
    if (navHref === 'dashboard.html') return page === 'dashboard';
    if (navHref === 'agenda.html') return page === 'agenda';
    if (navHref === 'agil.html?tab=backlog') return page === 'agil' && tab === 'backlog';
    if (navHref === 'agil.html?tab=sprints') return page === 'agil' && tab === 'sprints';
    if (navHref === 'preditivo.html?tab=entregas') return page === 'preditivo' && tab === 'entregas';
    if (navHref === 'preditivo.html?tab=cronograma') return page === 'preditivo' && tab === 'cronograma';
    if (navHref === 'configuracoes.html?tab=projeto') return page === 'configuracoes' && tab === 'projeto';
    if (navHref === 'configuracoes.html?tab=app') return page === 'configuracoes' && tab === 'app';
    if (navHref === 'novo-projeto.html') return page === 'novo-projeto';
    return false;
  }

  function getProjectNavItems(project) {
    var pid = project.id;
    var items = [
      { navKey: 'projeto-home', label: 'Início', href: 'projeto-home.html?projeto=' + pid },
      { navKey: 'quadro', label: 'Quadro', href: 'quadro.html?projeto=' + pid }
    ];
    if (project.preset === 'Híbrido') {
      items.push(
        { navKey: 'agil:backlog', label: 'Backlog', href: 'agil.html?tab=backlog&projeto=' + pid },
        { navKey: 'agil:sprints', label: 'Sprints', href: 'agil.html?tab=sprints&projeto=' + pid, meta: 'S4' },
        { navKey: 'preditivo:entregas', label: 'Entregas', href: 'preditivo.html?tab=entregas&projeto=' + pid },
        { navKey: 'preditivo:cronograma', label: 'Cronograma', href: 'preditivo.html?tab=cronograma&projeto=' + pid }
      );
    } else if (project.preset === 'Tradicional') {
      items.push(
        { navKey: 'preditivo:entregas', label: 'Entregas', href: 'preditivo.html?tab=entregas&projeto=' + pid },
        { navKey: 'preditivo:cronograma', label: 'Cronograma', href: 'preditivo.html?tab=cronograma&projeto=' + pid }
      );
    }
    items.push({ navKey: 'configuracoes:projeto', label: 'Configurações', href: 'configuracoes.html?tab=projeto&projeto=' + pid });
    return items;
  }

  function isActiveProjectSubItem(navKey, projectId, page, tab) {
    if (projectId !== getProjectId()) return false;
    var scope = getUrlParam('scope');
    if (navKey === 'projeto-home') return page === 'projeto-home';
    if (navKey === 'quadro') return (page === 'quadro' && scope !== 'mine') || page === 'tarefa';
    if (navKey === 'agil:backlog') return page === 'agil' && tab === 'backlog';
    if (navKey === 'agil:sprints') return page === 'agil' && tab === 'sprints';
    if (navKey === 'preditivo:entregas') return page === 'preditivo' && tab === 'entregas';
    if (navKey === 'preditivo:cronograma') return page === 'preditivo' && tab === 'cronograma';
    if (navKey === 'configuracoes:projeto') return page === 'configuracoes' && tab === 'projeto';
    return false;
  }

  function renderProjectsTree(treeEl, page, tab, expandedProjectId) {
    if (!treeEl) return;
    var currentProjectId = getProjectId();
    shellRefs.expandedProjectId = expandedProjectId;

    treeEl.innerHTML = PROJECTS.map(function (p) {
      var isExpanded = expandedProjectId === p.id;
      var isCurrent = currentProjectId === p.id;
      var subItemsHtml = getProjectNavItems(p).map(function (item) {
        var active = isActiveProjectSubItem(item.navKey, p.id, page, tab);
        return (
          '<button type="button" class="ab-proj-subitem' + (active ? ' is-active' : '') + '"' +
          ' data-href="' + item.href + '" data-project-id="' + p.id + '" data-nav-key="' + item.navKey + '"' +
          (active ? ' aria-current="page"' : '') + '>' +
            '<span class="ab-proj-subitem-label">' + escapeHtml(item.label) + '</span>' +
            (item.meta ? '<span class="ab-nav-meta">' + escapeHtml(item.meta) + '</span>' : '') +
          '</button>'
        );
      }).join('');

      return (
        '<div class="ab-proj-group' + (isExpanded ? ' is-open' : '') + (isCurrent ? ' is-current' : '') + '" data-proj-group="' + p.id + '">' +
          '<button type="button" class="ab-proj-toggle" data-proj-toggle="' + p.id + '" data-tip="' + escapeHtml(p.name + ' (' + p.preset + ')') + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">' +
            '<span class="ab-nav-icon" aria-hidden="true"><span class="ab-proj-dot ' + p.dotClass + '"></span></span>' +
            '<span class="ab-sidebar-label">' + escapeHtml(p.name) + '</span>' +
            '<span class="ab-proj-chevron" aria-hidden="true">' + ICONS.chevRight + '</span>' +
          '</button>' +
          '<div class="ab-proj-children"' + (isExpanded ? '' : ' hidden') + '>' +
            subItemsHtml +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function buildSidebar(page, tab) {
    var collapsed = readStorage(STORAGE.sidebarCollapsed, 'false') === 'true';
    var project = getProject();
    var role = getRole();

    var nav = document.createElement('aside');
    nav.className = 'ab-sidebar' + (collapsed ? ' is-collapsed' : '');
    nav.setAttribute('aria-label', 'Navegação principal');

    function navLink(href, label, iconHtml, opts) {
      opts = opts || {};
      var active = !opts.skipActive && isActiveNav(href, page, tab);
      var attrs = '';
      if (opts.roleOnly) attrs += ' data-role-only="' + opts.roleOnly + '"';
      if (opts.disabled) attrs += ' disabled aria-disabled="true"';
      return (
        '<button type="button" class="ab-nav-item' + (active ? ' is-active' : '') + (opts.extraClass ? ' ' + opts.extraClass : '') + '"' +
        ' data-href="' + href + '" data-tip="' + escapeHtml(label) + '"' + attrs +
        (active ? ' aria-current="page"' : '') + '>' +
          '<span class="ab-nav-icon" aria-hidden="true">' + iconHtml + '</span>' +
          '<span class="ab-sidebar-label">' + escapeHtml(label) + '</span>' +
          (opts.meta ? '<span class="ab-nav-meta">' + escapeHtml(opts.meta) + '</span>' : '') +
          (opts.soon ? '<span class="ab-soon-badge">Em breve</span>' : '') +
        '</button>'
      );
    }

    var newProjActive = page === 'novo-projeto';

    nav.innerHTML =
      '<div class="ab-sidebar-head">' +
        '<div class="ab-brand">' +
          '<span class="ab-brand-mark" aria-hidden="true">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 7h7v10H4z"/><path d="M13 4h7v7h-7z"/><path d="M13 14h7v6h-7z"/></svg>' +
          '</span>' +
          '<span class="ab-brand-name">AgileBox</span>' +
        '</div>' +
        '<button type="button" class="ab-collapse-btn" id="ab-collapse-sidebar" aria-label="Recolher ou expandir barra lateral" title="Recolher/expandir barra lateral">' +
          ICONS.collapse +
        '</button>' +
      '</div>' +
      '<div class="ab-sidebar-nav">' +
        '<span class="ab-section-label">Global</span>' +
        navLink('quadro.html?scope=mine', 'Minhas tarefas', ICONS.tasks) +
        navLink('dashboard.html', 'Dashboard Gestor', ICONS.dashboard, { roleOnly: 'manager' }) +
        navLink('agenda.html', 'Agenda', ICONS.agenda) +

        '<div class="ab-section-head">' +
          '<span class="ab-section-label">Projetos</span>' +
          '<button type="button" class="ab-section-add-btn' + (newProjActive ? ' is-active' : '') + '" id="ab-sidebar-new-project" data-href="novo-projeto.html" data-tip="Novo projeto" aria-label="Novo projeto" title="Novo projeto"' + (newProjActive ? ' aria-current="page"' : '') + '>' +
            ICONS.plus +
          '</button>' +
        '</div>' +
        '<div class="ab-projects-tree" id="ab-projects-tree"></div>' +
      '</div>' +
      '<div class="ab-sidebar-footer">' +
        '<span class="ab-section-label">Sistema</span>' +
        navLink('configuracoes.html?tab=app', 'Ajustes do App', ICONS.config) +
        navLink('#plugins', 'Plug-ins', ICONS.plugins, { disabled: true, soon: true, skipActive: true }) +
        navLink('bandeja.html', 'Abrir Bandeja', ICONS.tray, { skipActive: true }) +
        '<button type="button" class="ab-account-pill" id="ab-account-switch" title="Clique para alternar entre Colaborador e Gestor">' +
          '<span class="ab-avatar" id="ab-account-avatar">' + (role === 'manager' ? 'C' : 'P') + '</span>' +
          '<span class="ab-account-info">' +
            '<span class="ab-account-name" id="ab-account-name">' + (role === 'manager' ? 'Carla Mendes' : 'Pedro Alves') + '</span>' +
            '<span class="ab-account-role" id="ab-account-role">' + (role === 'manager' ? 'Gestora · Modo completo' : 'Colaborador · Minhas tarefas') + '</span>' +
          '</span>' +
          '<span class="ab-account-chevron" aria-hidden="true">' + ICONS.chevDown + '</span>' +
        '</button>' +
      '</div>';

    var treeEl = nav.querySelector('#ab-projects-tree');
    renderProjectsTree(treeEl, page, tab, project.id);

    nav.addEventListener('click', function (ev) {
      if (ev.target.closest('#ab-collapse-sidebar')) {
        var next = !nav.classList.contains('is-collapsed');
        nav.classList.toggle('is-collapsed', next);
        writeStorage(STORAGE.sidebarCollapsed, next ? 'true' : 'false');
        return;
      }
      if (ev.target.closest('#ab-account-switch')) {
        setRole(getRole() === 'manager' ? 'collaborator' : 'manager');
        showToast('Papel alternado para ' + (getRole() === 'manager' ? 'Gestor (Carla)' : 'Colaborador (Pedro)'), 'info');
        return;
      }

      var newProjBtn = ev.target.closest('#ab-sidebar-new-project');
      if (newProjBtn) {
        window.location.href = newProjBtn.getAttribute('data-href') || 'novo-projeto.html';
        return;
      }

      var toggleBtn = ev.target.closest('[data-proj-toggle]');
      if (toggleBtn) {
        var pid = toggleBtn.getAttribute('data-proj-toggle');
        var isCollapsedNow = nav.classList.contains('is-collapsed') || (window.innerWidth && window.innerWidth <= 1100);
        if (isCollapsedNow) {
          writeStorage(STORAGE.project, pid);
          writeStorage(STORAGE.sidebarExpandedProject, pid);
          window.location.href = 'quadro.html?projeto=' + pid;
          return;
        }
        var nextExpanded = shellRefs.expandedProjectId === pid ? null : pid;
        shellRefs.expandedProjectId = nextExpanded;
        writeStorage(STORAGE.sidebarExpandedProject, nextExpanded || '');
        var groups = treeEl.querySelectorAll('.ab-proj-group');
        for (var g = 0; g < groups.length; g++) {
          var gId = groups[g].getAttribute('data-proj-group');
          var openNow = gId === nextExpanded;
          groups[g].classList.toggle('is-open', openNow);
          var gToggle = groups[g].querySelector('[data-proj-toggle]');
          var gChildren = groups[g].querySelector('.ab-proj-children');
          if (gToggle) gToggle.setAttribute('aria-expanded', openNow ? 'true' : 'false');
          if (gChildren) gChildren.hidden = !openNow;
        }
        return;
      }

      var subBtn = ev.target.closest('.ab-proj-subitem[data-href]');
      if (subBtn) {
        var subProjId = subBtn.getAttribute('data-project-id');
        if (subProjId) {
          writeStorage(STORAGE.project, subProjId);
          writeStorage(STORAGE.sidebarExpandedProject, subProjId);
        }
        var subHref = subBtn.getAttribute('data-href');
        if (subHref) window.location.href = subHref;
        return;
      }

      var btn = ev.target.closest('.ab-nav-item[data-href]');
      if (!btn || btn.disabled) return;
      var href = btn.getAttribute('data-href');
      if (href && href !== '#plugins') {
        window.location.href = href;
      }
    });

    return nav;
  }

  function buildTitleBar(page, tab) {
    var project = getProject();
    var meta = PAGE_META[page] || { title: page, breadcrumb: page };
    var pageTitle = meta.title;
    if (page === 'agil') pageTitle = tab === 'sprints' ? 'Sprints' : 'Backlog';
    if (page === 'preditivo') pageTitle = tab === 'cronograma' ? 'Cronograma' : 'Entregas';
    if (page === 'configuracoes') pageTitle = tab === 'app' ? 'Ajustes do App' : 'Config. e Ferramentas';

    var header = document.createElement('header');
    header.className = 'ab-titlebar';

    var breadcrumbMiddle = '';
    if (page === 'tarefa') {
      var taskId = getUrlParam('id') || 'AB-5';
      pageTitle = taskId;
      breadcrumbMiddle =
        '<a class="ab-breadcrumb-link" href="quadro.html">Quadro</a>' +
        '<span class="ab-breadcrumb-sep" aria-hidden="true">›</span>';
    }

    header.innerHTML =
      '<div class="ab-titlebar-left">' +
        '<button type="button" class="ab-back-btn" id="ab-titlebar-back" aria-label="Voltar" title="Voltar">' +
          ICONS.arrowLeft +
        '</button>' +
        '<div class="ab-breadcrumb" aria-label="Localização atual">' +
          '<span class="ab-breadcrumb-proj" id="ab-breadcrumb-proj">' + escapeHtml(project.name) + '</span>' +
          '<span class="ab-breadcrumb-sep" aria-hidden="true">›</span>' +
          breadcrumbMiddle +
          '<span class="ab-breadcrumb-page" id="ab-breadcrumb-page">' + escapeHtml(pageTitle) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="ab-titlebar-actions">' +
        '<button type="button" class="ab-search-trigger" id="ab-title-search" title="Abrir busca, comandos ou ? ajuda">' +
          ICONS.search +
          '<span class="ab-search-label-full">Buscar, comandos ou ? ajuda</span>' +
          '<span class="ab-search-label-short">Buscar / ?</span>' +
          '<kbd class="ab-kbd">Ctrl+K</kbd>' +
        '</button>' +
        '<button type="button" class="ab-title-new-task" id="ab-title-new-task">' +
          '<span aria-hidden="true">+</span><span>Nova tarefa</span>' +
        '</button>' +
        '<button type="button" class="ab-kan-pill" id="ab-kan-pill" aria-expanded="false" title="Abrir ou fechar Kan (F1)">' +
          '<span>? Ajuda</span>' +
          '<kbd class="ab-kbd">F1</kbd>' +
        '</button>' +
        '<div class="ab-win-controls" aria-label="Controles da janela">' +
          '<button type="button" class="ab-win-btn" data-win-action="minimize" title="Minimizar janela" aria-label="Minimizar">−</button>' +
          '<button type="button" class="ab-win-btn" data-win-action="maximize" title="Maximizar ou restaurar" aria-label="Maximizar">□</button>' +
          '<button type="button" class="ab-win-btn is-close" data-win-action="close" title="Fechar painel" aria-label="Fechar">×</button>' +
        '</div>' +
      '</div>';

    header.querySelector('#ab-titlebar-back').addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = page === 'projeto-home' ? 'quadro.html' : 'projeto-home.html';
      }
    });

    header.querySelector('#ab-title-search').addEventListener('click', function () {
      openPalette('');
    });

    header.querySelector('#ab-title-new-task').addEventListener('click', function () {
      var evt = new CustomEvent('ab:newtask', { cancelable: true, detail: { source: 'titlebar' } });
      var proceed = window.dispatchEvent(evt);
      if (proceed) {
        openNewTaskModal();
      }
    });

    header.querySelector('#ab-kan-pill').addEventListener('click', function () {
      toggleKan();
    });

    header.querySelector('.ab-win-controls').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-win-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-win-action');
      if (act === 'minimize') showToast('Simulação desktop: janela minimizada', 'info');
      if (act === 'maximize') showToast('Simulação desktop: alternado tamanho da janela', 'info');
      if (act === 'close') showToast('No app desktop, fechar mantém a Bandeja disponível no sistema', 'info');
    });

    return header;
  }

  /* ========================================================================
     Kan Acoplado (Split Drawer lateral direita, 3 abas instantâneas)
     ======================================================================== */
  function getKanScreenKey() {
    var page = getPage();
    var tab = getTab();
    if (page === 'agil') return 'agil:' + (tab === 'sprints' ? 'sprints' : 'backlog');
    if (page === 'preditivo') return 'preditivo:' + (tab === 'cronograma' ? 'cronograma' : 'entregas');
    if (page === 'configuracoes') return 'configuracoes:' + (tab === 'app' ? 'app' : 'projeto');
    return page;
  }

  function clampNum(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function formatInlineMd(raw) {
    return escapeHtml(raw || '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function getDefaultFabPos() {
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 780;
    return {
      left: Math.max(8, vw - 112 - 14),
      top: Math.max(48, vh - 112 - 12)
    };
  }

  function loadFabPos() {
    var raw = readStorage(STORAGE.kanPos, '');
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
          var vw = window.innerWidth || 1280;
          var vh = window.innerHeight || 780;
          return {
            custom: true,
            left: clampNum(parsed.left, 8, Math.max(8, vw - 120)),
            top: clampNum(parsed.top, 48, Math.max(48, vh - 120))
          };
        }
      } catch (e) {
        /* ignore */
      }
    }
    var def = getDefaultFabPos();
    return { custom: false, left: def.left, top: def.top };
  }

  function applyFabPos(fab, pos) {
    if (!fab) return;
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 780;
    var left = clampNum(pos.left, 8, Math.max(8, vw - 120));
    var top = clampNum(pos.top, 48, Math.max(48, vh - 120));
    fab.style.left = Math.round(left) + 'px';
    fab.style.top = Math.round(top) + 'px';
  }

  function positionKanDrawer() {
    var drawer = shellRefs.kanDrawer;
    var fab = shellRefs.kanFab;
    if (!drawer || !fab) return;
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 780;
    var fabRect = fab.getBoundingClientRect();
    var drawerW = Math.min(368, vw - 24);
    var drawerH = drawer.offsetHeight || Math.max(360, Math.min(Math.round(vh * 0.6), vh - 124));

    var fabCenterX = fabRect.left + fabRect.width * 0.5;
    var topAbove = fabRect.top - drawerH - 8;
    var topBelow = fabRect.bottom + 8;
    var left;
    var top;

    if (topAbove >= 48) {
      top = topAbove;
      left = fabCenterX < vw * 0.38
        ? clampNum(fabRect.left, 12, Math.max(12, vw - drawerW - 12))
        : clampNum(fabRect.right - drawerW, 12, Math.max(12, vw - drawerW - 12));
    } else if (topBelow + drawerH <= vh - 12) {
      top = topBelow;
      left = fabCenterX < vw * 0.38
        ? clampNum(fabRect.left, 12, Math.max(12, vw - drawerW - 12))
        : clampNum(fabRect.right - drawerW, 12, Math.max(12, vw - drawerW - 12));
    } else {
      // Sem espaço vertical acima/abaixo: encaixa ao lado do FAB sem sobrepor o botão
      var spaceLeft = fabRect.left - 12;
      var spaceRight = vw - fabRect.right - 12;
      if (spaceLeft >= drawerW + 12 || spaceLeft >= spaceRight) {
        left = clampNum(fabRect.left - drawerW - 12, 12, Math.max(12, vw - drawerW - 12));
      } else {
        left = clampNum(fabRect.right + 12, 12, Math.max(12, vw - drawerW - 12));
      }
      top = clampNum(fabRect.bottom - drawerH, 48, Math.max(48, vh - drawerH - 12));
    }

    drawer.style.left = Math.round(left) + 'px';
    drawer.style.top = Math.round(top) + 'px';
  }

  function buildKanFab() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ab-kan-fab';
    btn.id = 'ab-kan-fab';
    btn.setAttribute('aria-label', 'Kan · Abrir chat assistente (F1) · Arraste para mover');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = 'Clique para conversar com o Kan (F1) ou arraste para mover';

    btn.innerHTML =
      '<span class="ab-kan-fab-stage" id="ab-kan-fab-stage">' +
        '<img class="ab-kan-fab-fallback" src="assets/img/kan_fechado.png" alt="Kan">' +
      '</span>';

    var pos = loadFabPos();
    applyFabPos(btn, pos);

    var drag = { active: false, moved: false, startX: 0, startY: 0, origLeft: 0, origTop: 0, suppressClick: false };

    btn.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var rect = btn.getBoundingClientRect();
      drag.active = true;
      drag.moved = false;
      drag.startX = ev.clientX;
      drag.startY = ev.clientY;
      drag.origLeft = rect.left;
      drag.origTop = rect.top;
      if (btn.setPointerCapture) {
        try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
    });

    window.addEventListener('pointermove', function (ev) {
      if (!drag.active) return;
      var dx = ev.clientX - drag.startX;
      var dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        btn.classList.add('is-dragging');
      }
      if (!drag.moved) return;
      var vw = window.innerWidth || 1280;
      var vh = window.innerHeight || 780;
      var nextLeft = clampNum(drag.origLeft + dx, 8, Math.max(8, vw - 120));
      var nextTop = clampNum(drag.origTop + dy, 48, Math.max(48, vh - 120));
      btn.style.left = Math.round(nextLeft) + 'px';
      btn.style.top = Math.round(nextTop) + 'px';
      if (shellRefs.kanDrawer && shellRefs.kanDrawer.classList.contains('is-open')) {
        positionKanDrawer();
      }
    });

    function endDrag(ev) {
      if (!drag.active) return;
      drag.active = false;
      btn.classList.remove('is-dragging');
      if (btn.releasePointerCapture && ev && ev.pointerId !== undefined) {
        try { btn.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
      if (drag.moved) {
        drag.suppressClick = true;
        var rect = btn.getBoundingClientRect();
        writeStorage(STORAGE.kanPos, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
        setTimeout(function () { drag.suppressClick = false; }, 40);
      }
    }

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    btn.addEventListener('click', function () {
      if (drag.suppressClick) return;
      toggleKan();
    });

    window.addEventListener('resize', function () {
      var saved = readStorage(STORAGE.kanPos, '');
      if (!saved) {
        applyFabPos(btn, getDefaultFabPos());
      } else {
        var r = btn.getBoundingClientRect();
        applyFabPos(btn, { left: r.left, top: r.top });
      }
      if (shellRefs.kanDrawer && shellRefs.kanDrawer.classList.contains('is-open')) {
        positionKanDrawer();
      }
    });

    return btn;
  }

  function updateKanApiHeaderState() {
    var drawer = shellRefs.kanDrawer;
    if (!drawer) return;
    var ai = window.AgileBoxKanAI;
    var hasKey = Boolean(ai && ai.getApiKey && ai.getApiKey());
    var model = (ai && ai.getModel && ai.getModel()) || 'gemini-2.5-flash';
    var dot = drawer.querySelector('#ab-kan-header-dot');
    var sub = drawer.querySelector('#ab-kan-subtitle');
    var toggleBtn = drawer.querySelector('#ab-kan-api-toggle');
    if (dot) dot.classList.toggle('is-local', !hasKey);
    if (sub) {
      var key = getKanScreenKey();
      var guide = KAN_SCREEN_GUIDES[key] || KAN_SCREEN_GUIDES.quadro;
      sub.textContent = hasKey ? ('Gemini · ' + model) : ('Modo local · ' + guide.title);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-connected', hasKey);
      toggleBtn.textContent = hasKey ? 'Gemini ON' : 'Chave AI';
    }
  }

  function buildKanDrawer() {
    var aside = document.createElement('aside');
    aside.className = 'ab-kan-drawer';
    aside.id = 'ab-kan-drawer';
    aside.setAttribute('aria-label', 'Kan · Chat e Guia do AgileBox');

    aside.innerHTML =
      '<div class="ab-kan-header">' +
        '<span class="ab-kan-header-dot is-local" id="ab-kan-header-dot" aria-hidden="true"></span>' +
        '<div class="ab-kan-title-group">' +
          '<h3 class="ab-kan-title">Kan · Assistente</h3>' +
          '<p class="ab-kan-subtitle" id="ab-kan-subtitle">Modo local</p>' +
        '</div>' +
        '<div class="ab-kan-header-actions">' +
          '<button type="button" class="ab-kan-icon-btn" id="ab-kan-api-toggle" aria-expanded="false" title="Conectar API gratuita do Google AI Studio (Gemini)">Chave AI</button>' +
          '<button type="button" class="ab-kan-close-btn" id="ab-kan-close" aria-label="Fechar Kan" title="Fechar (F1)">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="ab-kan-api-panel" id="ab-kan-api-panel" hidden>' +
        '<div class="ab-kan-api-row">' +
          '<input type="password" class="ab-kan-input" id="ab-kan-api-input" placeholder="Cole sua chave do Google AI Studio (AIza...)" aria-label="Chave da API Google AI Studio">' +
          '<button type="button" class="btn btn-sm btn-primary" id="ab-kan-api-save">Salvar</button>' +
        '</div>' +
        '<div class="ab-kan-api-row">' +
          '<select class="select" id="ab-kan-model-select" aria-label="Modelo Gemini" style="flex:1;height:30px;font-size:11.5px;">' +
            '<option value="gemini-2.5-flash">gemini-2.5-flash (Recomendado · Grátis)</option>' +
            '<option value="gemini-2.0-flash">gemini-2.0-flash</option>' +
            '<option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Mais rápido)</option>' +
          '</select>' +
          '<button type="button" class="btn btn-sm btn-secondary" id="ab-kan-api-test">Testar</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="ab-kan-api-clear">Limpar</button>' +
        '</div>' +
        '<div class="ab-kan-api-meta">' +
          '<span id="ab-kan-api-status">Chave salva só no seu navegador.</span>' +
          '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Obter chave ↗</a>' +
        '</div>' +
      '</div>' +
      '<div class="ab-kan-tabs" role="tablist" aria-label="Abas do Kan">' +
        '<button type="button" class="ab-kan-tab" role="tab" data-kan-tab="chat">Chat IA</button>' +
        '<button type="button" class="ab-kan-tab" role="tab" data-kan-tab="screen">Esta tela</button>' +
        '<button type="button" class="ab-kan-tab" role="tab" data-kan-tab="steps">Passos</button>' +
        '<button type="button" class="ab-kan-tab" role="tab" data-kan-tab="faq">Dúvidas</button>' +
      '</div>' +
      '<div class="ab-kan-body" id="ab-kan-body"></div>';

    aside.querySelector('#ab-kan-close').addEventListener('click', closeKan);

    var apiToggle = aside.querySelector('#ab-kan-api-toggle');
    var apiPanel = aside.querySelector('#ab-kan-api-panel');
    var apiInput = aside.querySelector('#ab-kan-api-input');
    var modelSelect = aside.querySelector('#ab-kan-model-select');
    var apiStatus = aside.querySelector('#ab-kan-api-status');

    apiToggle.addEventListener('click', function () {
      var open = apiPanel.hidden;
      apiPanel.hidden = !open;
      apiToggle.classList.toggle('is-active', open);
      apiToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && window.AgileBoxKanAI) {
        apiInput.value = window.AgileBoxKanAI.getApiKey();
        modelSelect.value = window.AgileBoxKanAI.getModel();
        apiInput.focus();
      }
    });

    aside.querySelector('#ab-kan-api-save').addEventListener('click', function () {
      if (!window.AgileBoxKanAI) return;
      var val = apiInput.value.trim();
      window.AgileBoxKanAI.setApiKey(val);
      window.AgileBoxKanAI.setModel(modelSelect.value);
      updateKanApiHeaderState();
      apiStatus.textContent = val ? 'Chave salva com segurança neste navegador.' : 'Chave removida. Usando modo local.';
      showToast(val ? 'Chave Google AI Studio conectada.' : 'Modo local ativado.', 'success');
      if (val) apiPanel.hidden = true;
    });

    aside.querySelector('#ab-kan-api-clear').addEventListener('click', function () {
      if (!window.AgileBoxKanAI) return;
      apiInput.value = '';
      window.AgileBoxKanAI.setApiKey('');
      updateKanApiHeaderState();
      apiStatus.textContent = 'Chave removida. Modo local ativo.';
    });

    aside.querySelector('#ab-kan-api-test').addEventListener('click', function () {
      if (!window.AgileBoxKanAI) return;
      var candidate = apiInput.value.trim() || window.AgileBoxKanAI.getApiKey();
      window.AgileBoxKanAI.setModel(modelSelect.value);
      apiStatus.textContent = 'Testando conexão com Google AI Studio...';
      window.AgileBoxKanAI.testApiKey(candidate, modelSelect.value).then(function (res) {
        apiStatus.textContent = res.message;
        if (res.ok && candidate) {
          window.AgileBoxKanAI.setApiKey(candidate);
          updateKanApiHeaderState();
        }
      });
    });

    aside.querySelector('.ab-kan-tabs').addEventListener('click', function (ev) {
      var tabBtn = ev.target.closest('[data-kan-tab]');
      if (!tabBtn) return;
      var t = tabBtn.getAttribute('data-kan-tab');
      writeStorage(STORAGE.kanTab, t);
      renderKanContent();
    });

    return aside;
  }

  function renderKanContent() {
    var drawer = shellRefs.kanDrawer;
    if (!drawer) return;

    var tab = readStorage(STORAGE.kanTab, 'chat');
    if (tab !== 'chat' && tab !== 'screen' && tab !== 'steps' && tab !== 'faq') tab = 'chat';

    var tabBtns = drawer.querySelectorAll('[data-kan-tab]');
    for (var i = 0; i < tabBtns.length; i++) {
      var isAct = tabBtns[i].getAttribute('data-kan-tab') === tab;
      tabBtns[i].classList.toggle('is-active', isAct);
      tabBtns[i].setAttribute('aria-selected', isAct ? 'true' : 'false');
    }

    updateKanApiHeaderState();

    var key = getKanScreenKey();
    var guide = KAN_SCREEN_GUIDES[key] || KAN_SCREEN_GUIDES.quadro;
    var body = drawer.querySelector('#ab-kan-body');
    if (!body) return;

    if (tab === 'chat') {
      body.style.padding = '0';
      body.style.overflow = 'hidden';
      var ai = window.AgileBoxKanAI;
      var messages = ai ? ai.loadChatHistory() : [];
      var busy = false;

      body.innerHTML =
        '<div class="ab-kan-chat-shell">' +
          '<div class="ab-kan-chat-list" id="ab-kan-chat-list"></div>' +
          '<div class="ab-kan-suggestions" id="ab-kan-suggestions">' +
            '<button type="button" class="ab-kan-chip" data-kan-prompt="Criar tarefa Validar webhook de pagamento em A fazer para Pedro">+ Nova tarefa</button>' +
            '<button type="button" class="ab-kan-chip" data-kan-prompt="Mover AB-5 para Revisar">AB-5 → Revisar</button>' +
            '<button type="button" class="ab-kan-chip" data-kan-prompt="Lançar 1h em AB-5">+1h em AB-5</button>' +
            '<button type="button" class="ab-kan-chip" data-kan-prompt="Registrar daily: avancei no checkout, 3h, sem bloqueios">Daily</button>' +
          '</div>' +
          '<form class="ab-kan-composer" id="ab-kan-chat-form">' +
            '<input type="text" class="ab-kan-input" id="ab-kan-chat-input" placeholder="Peça ao Kan ou tire uma dúvida..." autocomplete="off">' +
            '<button type="submit" class="ab-kan-send-btn" id="ab-kan-send-btn">Enviar</button>' +
          '</form>' +
        '</div>';

      var listEl = body.querySelector('#ab-kan-chat-list');
      var formEl = body.querySelector('#ab-kan-chat-form');
      var inputEl = body.querySelector('#ab-kan-chat-input');
      var sendBtn = body.querySelector('#ab-kan-send-btn');

      function drawMessages() {
        var html = messages.map(function (msg, msgIdx) {
          var roleCls = msg.role === 'user' ? 'is-user' : 'is-assistant';
          var actionsHtml = (msg.actions || []).map(function (act, actIdx) {
            var isUndone = Boolean(act.undone || (ai && ai.isUndone && ai.isUndone(act.undoId)));
            return (
              '<div class="ab-kan-action-receipt' + (isUndone ? ' is-undone' : '') + '">' +
                '<div class="ab-kan-action-info">' +
                  '<div class="ab-kan-action-title">' + escapeHtml(act.summary) + '</div>' +
                  '<div class="ab-kan-action-detail">' + escapeHtml(act.detail || '') + '</div>' +
                '</div>' +
                '<button type="button" class="ab-kan-undo-btn" data-undo-id="' + escapeHtml(act.undoId) + '" data-msg-idx="' + msgIdx + '" data-act-idx="' + actIdx + '"' + (isUndone ? ' disabled' : '') + '>' +
                  (isUndone ? 'Desfeito' : 'Desfazer') +
                '</button>' +
              '</div>'
            );
          }).join('');

          var confirmHtml = (msg.confirmations || []).map(function (conf, cIdx) {
            if (conf.resolved) return '';
            return (
              '<div class="ab-kan-confirm-card">' +
                '<div class="ab-kan-action-title">' + escapeHtml(conf.actionTitle) + '</div>' +
                '<div style="font-size:11.5px;color:var(--color-text-muted);line-height:1.4;">' + escapeHtml(conf.detail) + '</div>' +
                '<div class="ab-kan-confirm-btns">' +
                  '<button type="button" class="btn btn-sm btn-ghost" data-conf-cancel="' + msgIdx + ':' + cIdx + '">Cancelar</button>' +
                  '<button type="button" class="btn btn-sm btn-primary" data-conf-ok="' + msgIdx + ':' + cIdx + '">Confirmar</button>' +
                '</div>' +
              '</div>'
            );
          }).join('');

          return (
            '<div class="ab-kan-msg ' + roleCls + '">' +
              '<div class="ab-kan-msg-bubble">' + formatInlineMd(msg.text) + '</div>' +
              actionsHtml +
              confirmHtml +
            '</div>'
          );
        }).join('');

        if (busy) {
          html += '<div class="ab-kan-msg is-assistant"><div class="ab-kan-msg-bubble" style="color:var(--color-text-subtle);">Kan pensando e executando...</div></div>';
        }

        listEl.innerHTML = html;
        listEl.scrollTop = listEl.scrollHeight;
      }

      function submitUserPrompt(rawText) {
        var text = String(rawText || '').trim();
        if (!text || busy) return;
        messages.push({ id: 'u_' + Date.now(), role: 'user', text: text, actions: [], confirmations: [] });
        if (ai) ai.saveChatHistory(messages);
        inputEl.value = '';
        busy = true;
        sendBtn.disabled = true;
        drawMessages();

        var runner = ai
          ? ai.sendMessage(messages.slice(0, -1), text)
          : Promise.resolve({ text: 'Módulo de IA não carregado.', actions: [], confirmations: [] });

        runner.then(function (resp) {
          busy = false;
          sendBtn.disabled = false;
          messages.push({
            id: 'a_' + Date.now(),
            role: 'assistant',
            text: resp.text || 'Concluído.',
            actions: resp.actions || [],
            confirmations: resp.confirmations || []
          });
          if (ai) ai.saveChatHistory(messages);
          drawMessages();
          inputEl.focus();
        });
      }

      formEl.addEventListener('submit', function (ev) {
        ev.preventDefault();
        submitUserPrompt(inputEl.value);
      });

      body.querySelector('#ab-kan-suggestions').addEventListener('click', function (ev) {
        var chip = ev.target.closest('[data-kan-prompt]');
        if (!chip) return;
        submitUserPrompt(chip.getAttribute('data-kan-prompt'));
      });

      listEl.addEventListener('click', function (ev) {
        var undoBtn = ev.target.closest('[data-undo-id]');
        if (undoBtn && ai) {
          var uid = undoBtn.getAttribute('data-undo-id');
          var mIdx = parseInt(undoBtn.getAttribute('data-msg-idx'), 10);
          var aIdx = parseInt(undoBtn.getAttribute('data-act-idx'), 10);
          var resUndo = ai.undoAction(uid);
          if (resUndo && resUndo.ok && messages[mIdx] && messages[mIdx].actions && messages[mIdx].actions[aIdx]) {
            messages[mIdx].actions[aIdx].undone = true;
            ai.saveChatHistory(messages);
            drawMessages();
          }
          return;
        }

        var okBtn = ev.target.closest('[data-conf-ok]');
        if (okBtn && ai) {
          var partsOk = okBtn.getAttribute('data-conf-ok').split(':');
          var mOk = messages[parseInt(partsOk[0], 10)];
          var cOk = mOk && mOk.confirmations[parseInt(partsOk[1], 10)];
          if (cOk && !cOk.resolved) {
            cOk.resolved = true;
            var executed = ai.confirmAction(cOk);
            if (executed && executed.ok) {
              mOk.actions = mOk.actions || [];
              mOk.actions.push(executed);
            }
            ai.saveChatHistory(messages);
            drawMessages();
          }
          return;
        }

        var cancelBtn = ev.target.closest('[data-conf-cancel]');
        if (cancelBtn && ai) {
          var partsCancel = cancelBtn.getAttribute('data-conf-cancel').split(':');
          var mCan = messages[parseInt(partsCancel[0], 10)];
          var cCan = mCan && mCan.confirmations[parseInt(partsCancel[1], 10)];
          if (cCan && !cCan.resolved) {
            cCan.resolved = true;
            mCan.text += '\n(Ação crítica cancelada.)';
            ai.saveChatHistory(messages);
            drawMessages();
          }
        }
      });

      drawMessages();
      return;
    }

    body.style.padding = '';
    body.style.overflow = '';

    if (tab === 'screen') {
      var stepsHtml = guide.steps.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('');
      var actionsHtml = (guide.actions || []).map(function (a) {
        return '<button type="button" class="ab-kan-action-link" data-open-faq="' + escapeHtml(a.faqKey) + '"><span>' + escapeHtml(a.label) + '</span><span>→</span></button>';
      }).join('');

      body.innerHTML =
        '<div class="ab-kan-card">' +
          '<h4>Você está em: ' + escapeHtml(guide.title) + '</h4>' +
          '<p>' + escapeHtml(guide.summary) + '</p>' +
        '</div>' +
        '<div class="ab-kan-card">' +
          '<h4>Como funciona aqui</h4>' +
          '<ol class="ab-kan-list">' + stepsHtml + '</ol>' +
        '</div>' +
        '<div class="ab-kan-card">' +
          '<h4>Dúvidas rápidas desta tela</h4>' +
          '<div style="display:flex;flex-direction:column;gap:6px;">' + actionsHtml + '</div>' +
        '</div>';

      body.onclick = function (ev) {
        var faqTrigger = ev.target.closest('[data-open-faq]');
        if (!faqTrigger) return;
        var fKey = faqTrigger.getAttribute('data-open-faq');
        writeStorage(STORAGE.kanTab, 'faq');
        renderKanContent(fKey);
      };
      return;
    }

    if (tab === 'steps') {
      var role = getRole();
      var list = KAN_CHECKLISTS[role];
      var done = getCompletedSteps(role);
      var pct = Math.round((done.length / list.length) * 100);

      var itemsHtml = list.map(function (step) {
        var isDone = done.indexOf(step.id) !== -1;
        return (
          '<button type="button" class="ab-kan-step' + (isDone ? ' is-done' : '') + '" data-step-id="' + step.id + '">' +
            '<span class="ab-kan-step-check">' + (isDone ? '✓' : '') + '</span>' +
            '<span>' +
              '<div class="ab-kan-step-title">' + escapeHtml(step.title) + '</div>' +
              '<div class="ab-kan-step-desc">' + escapeHtml(step.desc) + '</div>' +
            '</span>' +
          '</button>'
        );
      }).join('');

      body.innerHTML =
        '<div class="ab-kan-card">' +
          '<h4>Trilha para ' + (role === 'manager' ? 'Gestor' : 'Colaborador') + '</h4>' +
          '<p style="margin-bottom:8px;">' + done.length + ' de ' + list.length + ' passos concluídos (' + pct + '%). No app real, cada passo marca sozinho quando você realiza a ação.</p>' +
          '<div class="ab-kan-progress"><div class="ab-kan-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        itemsHtml;

      body.onclick = function (ev) {
        var stepBtn = ev.target.closest('[data-step-id]');
        if (!stepBtn) return;
        var sid = stepBtn.getAttribute('data-step-id');
        var current = getCompletedSteps(role);
        var idx = current.indexOf(sid);
        if (idx === -1) {
          current.push(sid);
          showToast('Passo concluído na trilha do Kan!', 'success');
        } else {
          current.splice(idx, 1);
        }
        saveCompletedSteps(role, current);
        renderKanContent();
      };
      return;
    }

    // Tab: faq (Dúvidas + Dicionário com busca instantânea)
    var focusFaqId = arguments[0] || '';
    var searchTerm = '';

    body.innerHTML =
      '<div class="field">' +
        '<input type="search" class="input" id="ab-kan-faq-search" placeholder="Buscar dúvida ou termo (ex.: WIP, R$, Sprint...)" aria-label="Buscar no dicionário e dúvidas">' +
      '</div>' +
      '<div id="ab-kan-faq-list" style="display:flex;flex-direction:column;gap:8px;"></div>';

    var searchInput = body.querySelector('#ab-kan-faq-search');
    var listElFaq = body.querySelector('#ab-kan-faq-list');

    function renderFaqList(q) {
      var norm = (q || '').trim().toLowerCase();
      var matches = FAQ_ITEMS.filter(function (item) {
        if (!norm) return true;
        return (
          item.q.toLowerCase().indexOf(norm) !== -1 ||
          item.a.toLowerCase().indexOf(norm) !== -1 ||
          item.id.toLowerCase().indexOf(norm) !== -1
        );
      });
      if (!matches.length) {
        listElFaq.innerHTML = '<div class="ab-kan-card"><p>Nenhum termo encontrado para "' + escapeHtml(q) + '". Tente buscar por WIP, R$, Sprint, Entidades ou Bandeja.</p></div>';
        return;
      }
      listElFaq.innerHTML = matches.map(function (item) {
        var openAttr = (focusFaqId && item.id === focusFaqId) || (norm && matches.length <= 3) ? ' open' : '';
        return (
          '<details class="ab-kan-faq-item"' + openAttr + '>' +
            '<summary><span>' + escapeHtml(item.q) + '</span></summary>' +
            '<div class="ab-kan-faq-answer">' + escapeHtml(item.a) + '</div>' +
          '</details>'
        );
      }).join('');
    }

    renderFaqList(searchTerm);
    searchInput.addEventListener('input', function () {
      focusFaqId = '';
      renderFaqList(searchInput.value);
    });
    if (focusFaqId) {
      var opened = listElFaq.querySelector('details[open]');
      if (opened && opened.scrollIntoView) {
        opened.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function setKanOpen(open, tabOverride, silent) {
    if (!shellRefs.kanDrawer) return;
    var wasOpen = shellRefs.kanDrawer.classList.contains('is-open');
    if (tabOverride) writeStorage(STORAGE.kanTab, tabOverride);
    writeStorage(STORAGE.kanOpen, open ? 'true' : 'false');

    if (open) {
      renderKanContent();
      positionKanDrawer();
    }
    shellRefs.kanDrawer.classList.toggle('is-open', open);

    if (shellRefs.kanPill) {
      shellRefs.kanPill.classList.toggle('is-active', open);
      shellRefs.kanPill.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (shellRefs.kanFab) {
      shellRefs.kanFab.classList.toggle('is-active', open);
      shellRefs.kanFab.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (shellRefs.kan3d) {
      if (silent) {
        shellRefs.kan3d.setOpen(open);
      } else if (open !== wasOpen) {
        shellRefs.kan3d.play('Open', { reverse: !open });
      }
    }
  }

  function openKan(tab) { setKanOpen(true, tab); }
  function closeKan() { setKanOpen(false); }
  function toggleKan(tab) {
    if (!shellRefs.kanDrawer) return;
    var isOpen = shellRefs.kanDrawer.classList.contains('is-open');
    setKanOpen(tab ? true : !isOpen, tab);
  }

  /* ========================================================================
     Paleta Ctrl+K Interativa (com @pessoa, #projeto e ? ajuda)
     ======================================================================== */
  var NAV_COMMANDS = [
    { label: 'Ir para: Início do projeto', href: 'projeto-home.html', meta: 'Visão geral' },
    { label: 'Ir para: Quadro (Minhas tarefas)', href: 'quadro.html', meta: 'G Q' },
    { label: 'Ir para: Detalhe da Tarefa (AB-5)', href: 'tarefa.html', meta: 'Detalhe' },
    { label: 'Ir para: Dashboard Gestor', href: 'dashboard.html', meta: 'Gestor', roleOnly: 'manager' },
    { label: 'Ir para: Agenda', href: 'agenda.html', meta: 'Semana / Dia / Mês' },
    { label: 'Ir para: Backlog', href: 'agil.html?tab=backlog', meta: 'Fluxo Ágil' },
    { label: 'Ir para: Sprints & Ritmo', href: 'agil.html?tab=sprints', meta: 'Fluxo Ágil' },
    { label: 'Ir para: Entregas & Riscos', href: 'preditivo.html?tab=entregas', meta: 'Fluxo Preditivo' },
    { label: 'Ir para: Cronograma, Marcos & Plano salvo', href: 'preditivo.html?tab=cronograma', meta: 'Fluxo Preditivo' },
    { label: 'Ir para: Config. e Ferramentas do Projeto', href: 'configuracoes.html?tab=projeto', meta: 'Projeto' },
    { label: 'Ir para: Ajustes do App', href: 'configuracoes.html?tab=app', meta: 'Preferências' },
    { label: 'Criar: Novo projeto', href: 'novo-projeto.html', meta: 'Fluxo rápido' },
    { label: 'Abrir: Bandeja Rápida (360×560)', href: 'bandeja.html', meta: 'Captura rápida' },
    { label: 'Voltar para: Índice de fluxos', href: 'index.html', meta: 'Protótipo' }
  ];

  function buildPalette() {
    var backdrop = document.createElement('div');
    backdrop.className = 'ab-palette-backdrop';
    backdrop.id = 'ab-palette-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Paleta de comandos e busca');

    backdrop.innerHTML =
      '<div class="ab-palette">' +
        '<div class="ab-palette-search">' +
          ICONS.search +
          '<input type="text" class="ab-palette-input" id="ab-palette-input" placeholder="Digite tarefa com @pessoa #projeto, busque tela ou ? dúvida..." autocomplete="off">' +
          '<button type="button" class="ab-kan-close-btn" id="ab-palette-close" aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="ab-palette-dest" id="ab-palette-dest"></div>' +
        '<div class="ab-palette-results" id="ab-palette-results"></div>' +
        '<div class="ab-palette-footer">' +
          '<span>Use <kbd class="ab-kbd">@</kbd> pessoa · <kbd class="ab-kbd">#</kbd> projeto · <kbd class="ab-kbd">?</kbd> ajuda do Kan</span>' +
          '<span><kbd class="ab-kbd">↑↓</kbd> navegar · <kbd class="ab-kbd">Enter</kbd> confirmar · <kbd class="ab-kbd">Esc</kbd> fechar</span>' +
        '</div>' +
      '</div>';

    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop || ev.target.closest('#ab-palette-close')) {
        closePalette();
      }
    });

    var input = backdrop.querySelector('#ab-palette-input');
    input.addEventListener('input', function () {
      paletteState.selectedIndex = 0;
      renderPalette();
    });

    input.addEventListener('keydown', function (ev) {
      var options = backdrop.querySelectorAll('.ab-palette-option');
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closePalette();
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (options.length) {
          paletteState.selectedIndex = (paletteState.selectedIndex + 1) % options.length;
          highlightPaletteOption();
        }
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (options.length) {
          paletteState.selectedIndex = (paletteState.selectedIndex - 1 + options.length) % options.length;
          highlightPaletteOption();
        }
        return;
      }
      if (ev.key === 'Tab' && options.length) {
        var active = options[paletteState.selectedIndex];
        if (active && active.getAttribute('data-insert-token')) {
          ev.preventDefault();
          active.click();
        }
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        var activeOpt = options[paletteState.selectedIndex];
        if (activeOpt) activeOpt.click();
      }
    });

    document.body.appendChild(backdrop);
    shellRefs.paletteBackdrop = backdrop;
    shellRefs.paletteInput = input;
  }

  function highlightPaletteOption() {
    var options = shellRefs.paletteBackdrop.querySelectorAll('.ab-palette-option');
    for (var i = 0; i < options.length; i++) {
      var sel = i === paletteState.selectedIndex;
      options[i].classList.toggle('is-selected', sel);
      if (sel && options[i].scrollIntoView) {
        options[i].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function parseTaskCommand(raw) {
    var currentProj = getProject();
    var targetProject = currentProj;
    var assignee = null;
    var text = raw;

    var hashMatch = raw.match(/#([a-zA-Z0-9À-ÿ_-]+)/);
    if (hashMatch) {
      var qProj = hashMatch[1].toLowerCase();
      for (var i = 0; i < PROJECTS.length; i++) {
        if (
          PROJECTS[i].id === qProj ||
          PROJECTS[i].name.toLowerCase().indexOf(qProj) !== -1 ||
          PROJECTS[i].fullName.toLowerCase().indexOf(qProj) !== -1
        ) {
          targetProject = PROJECTS[i];
          break;
        }
      }
      text = text.replace(hashMatch[0], '');
    }

    var atMatch = raw.match(/@([a-zA-ZÀ-ÿ_-]+)/);
    if (atMatch) {
      var qPerson = atMatch[1].toLowerCase();
      for (var j = 0; j < PEOPLE.length; j++) {
        if (PEOPLE[j].name.toLowerCase().indexOf(qPerson) === 0) {
          assignee = PEOPLE[j];
          break;
        }
      }
      text = text.replace(atMatch[0], '');
    }

    return {
      title: text.replace(/\s+/g, ' ').trim(),
      project: targetProject,
      assignee: assignee
    };
  }

  function renderPalette() {
    var input = shellRefs.paletteInput;
    var destEl = shellRefs.paletteBackdrop.querySelector('#ab-palette-dest');
    var resultsEl = shellRefs.paletteBackdrop.querySelector('#ab-palette-results');
    var raw = input.value;
    var trimmed = raw.trim();
    var role = getRole();

    var parsed = parseTaskCommand(raw);

    // Chip explícito de destino
    if (trimmed.indexOf('?') === 0) {
      destEl.innerHTML =
        '<span class="ab-dest-chip">Modo Ajuda do Kan (?)</span>' +
        '<span class="ab-token-chip">Respostas instantâneas sem criar tarefa</span>';
    } else {
      destEl.innerHTML =
        '<span class="ab-dest-chip">Destino: ' + escapeHtml(parsed.project.name) + ' · A fazer</span>' +
        (parsed.assignee ? '<span class="ab-token-chip">Responsável: ' + escapeHtml(parsed.assignee.name) + '</span>' : '<span class="ab-token-chip">@pessoa opcional</span>') +
        '<span class="ab-token-chip">#projeto opcional</span>';
    }

    var html = '';

    // 1. Modo '?' — respostas do Dicionário/Kan (NUNCA criar tarefa '?')
    if (trimmed.indexOf('?') === 0) {
      var qHelp = trimmed.slice(1).trim().toLowerCase();
      var faqs = FAQ_ITEMS.filter(function (f) {
        if (!qHelp) return true;
        return f.q.toLowerCase().indexOf(qHelp) !== -1 || f.a.toLowerCase().indexOf(qHelp) !== -1;
      }).slice(0, 6);

      html += '<div class="ab-palette-section">Respostas rápidas do Kan</div>';
      if (!faqs.length) {
        html += '<div class="ab-kan-card" style="margin:6px;"><p>Nenhuma resposta direta para "' + escapeHtml(qHelp) + '". Abra a aba Dúvidas no Kan para ver todo o dicionário.</p></div>';
      } else {
        faqs.forEach(function (f) {
          html +=
            '<button type="button" class="ab-palette-option" data-faq-id="' + f.id + '">' +
              '<div style="min-width:0;">' +
                '<div style="font-weight:600;">' + escapeHtml(f.q) + '</div>' +
                '<div class="ab-palette-option-meta" style="white-space:normal;margin-top:2px;">' + escapeHtml(f.a) + '</div>' +
              '</div>' +
              '<span class="ab-palette-option-meta">Abrir no Kan</span>' +
            '</button>';
        });
      }
      resultsEl.innerHTML = html;
      wirePaletteClicks(resultsEl, input);
      highlightPaletteOption();
      return;
    }

    // 2. Autocomplete vivo para '@' (pessoas) ou '#' (projetos) no fim do texto
    var tailAt = raw.match(/(?:^|\s)@([a-zA-ZÀ-ÿ]*)$/);
    if (tailAt) {
      var qAt = tailAt[1].toLowerCase();
      var peopleMatches = PEOPLE.filter(function (p) {
        return !qAt || p.name.toLowerCase().indexOf(qAt) !== -1;
      });
      html += '<div class="ab-palette-section">Mencionar responsável (@)</div>';
      peopleMatches.forEach(function (p) {
        html +=
          '<button type="button" class="ab-palette-option" data-insert-token="@' + p.name + '" data-token-prefix="@">' +
            '<span><strong>@' + escapeHtml(p.name) + '</strong> · ' + escapeHtml(p.role) + '</span>' +
            '<span class="ab-palette-option-meta">Tab / Enter</span>' +
          '</button>';
      });
    }

    var tailHash = raw.match(/(?:^|\s)#([a-zA-Z0-9À-ÿ_-]*)$/);
    if (tailHash) {
      var qHash = tailHash[1].toLowerCase();
      var projMatches = PROJECTS.filter(function (p) {
        return !qHash || p.name.toLowerCase().indexOf(qHash) !== -1 || p.fullName.toLowerCase().indexOf(qHash) !== -1;
      });
      html += '<div class="ab-palette-section">Escolher projeto (#)</div>';
      projMatches.forEach(function (p) {
        var tag = 'Projeto' + p.id.toUpperCase();
        html +=
          '<button type="button" class="ab-palette-option" data-insert-token="#' + p.id + '" data-token-prefix="#">' +
            '<span><span class="ab-proj-dot ' + p.dotClass + '" style="display:inline-block;margin:0 6px 0 0;"></span><strong>' + escapeHtml(p.fullName) + '</strong></span>' +
            '<span class="ab-palette-option-meta">#' + p.id + ' (' + escapeHtml(p.preset) + ')</span>' +
          '</button>';
      });
    }

    // 3. Criar tarefa se houver título real (e não for apenas '?' ou vazio)
    if (parsed.title.length >= 2 && !tailAt && !tailHash) {
      html += '<div class="ab-palette-section">Criar nova tarefa</div>';
      html +=
        '<button type="button" class="ab-palette-option" data-create-task="true">' +
          '<span>+ Criar tarefa "<strong>' + escapeHtml(parsed.title) + '</strong>"</span>' +
          '<span class="ab-palette-option-meta">' + escapeHtml(parsed.project.name) + ' · A fazer' + (parsed.assignee ? ' · @' + escapeHtml(parsed.assignee.name) : '') + '</span>' +
        '</button>';
    }

    // 4. Navegação rápida filtrada
    var qNav = trimmed.toLowerCase();
    var navMatches = NAV_COMMANDS.filter(function (c) {
      if (c.roleOnly === 'manager' && role !== 'manager') return false;
      if (!qNav || tailAt || tailHash) return true;
      return c.label.toLowerCase().indexOf(qNav) !== -1 || c.meta.toLowerCase().indexOf(qNav) !== -1;
    });

    if (navMatches.length) {
      html += '<div class="ab-palette-section">Ir para tela ou ação</div>';
      navMatches.forEach(function (c) {
        html +=
          '<button type="button" class="ab-palette-option" data-nav-href="' + c.href + '">' +
            '<span>' + escapeHtml(c.label) + '</span>' +
            '<span class="ab-palette-option-meta">' + escapeHtml(c.meta) + '</span>' +
          '</button>';
      });
    }

    if (!html) {
      html = '<div class="ab-kan-card" style="margin:6px;"><p>Digite o título de uma tarefa, use <strong>@</strong> para pessoa, <strong>#</strong> para projeto ou <strong>?</strong> para ajuda.</p></div>';
    }

    resultsEl.innerHTML = html;
    wirePaletteClicks(resultsEl, input);
    highlightPaletteOption();
  }

  function wirePaletteClicks(resultsEl, input) {
    resultsEl.onclick = function (ev) {
      var opt = ev.target.closest('.ab-palette-option');
      if (!opt) return;

      var tok = opt.getAttribute('data-insert-token');
      var prefix = opt.getAttribute('data-token-prefix');
      if (tok) {
        var val = input.value;
        if (prefix === '@') {
          input.value = val.replace(/@[a-zA-ZÀ-ÿ]*$/, tok + ' ');
        } else {
          input.value = val.replace(/#[a-zA-Z0-9À-ÿ_-]*$/, tok + ' ');
        }
        paletteState.selectedIndex = 0;
        renderPalette();
        input.focus();
        return;
      }

      var faqId = opt.getAttribute('data-faq-id');
      if (faqId) {
        closePalette();
        if (shellRefs.kanDrawer) {
          setKanOpen(true, 'faq');
          renderKanContent(faqId);
        } else {
          showToast('Dica: abra qualquer tela do Painel e aperte F1 para ver no Kan.', 'info');
        }
        return;
      }

      if (opt.getAttribute('data-create-task') === 'true') {
        var parsed = parseTaskCommand(input.value);
        closePalette();
        emit('ab:taskcreated', {
          title: parsed.title,
          status: 'A fazer',
          projectId: parsed.project.id,
          projectName: parsed.project.name,
          assignee: parsed.assignee ? parsed.assignee.name : 'Pedro'
        });
        showToast('Tarefa "' + parsed.title + '" criada em ' + parsed.project.name + ' · A fazer', 'success');
        return;
      }

      var href = opt.getAttribute('data-nav-href');
      if (href) {
        closePalette();
        window.location.href = href;
      }
    };
  }

  function openPalette(initialQuery) {
    if (!shellRefs.paletteBackdrop) return;
    paletteState.open = true;
    paletteState.selectedIndex = 0;
    shellRefs.paletteBackdrop.classList.add('is-open');
    shellRefs.paletteInput.value = initialQuery || '';
    renderPalette();
    setTimeout(function () {
      shellRefs.paletteInput.focus();
    }, 10);
  }

  function closePalette() {
    if (!shellRefs.paletteBackdrop) return;
    paletteState.open = false;
    shellRefs.paletteBackdrop.classList.remove('is-open');
  }

  /* ========================================================================
     Modal Global "+ Nova tarefa" (funciona em qualquer tela!)
     ======================================================================== */
  function buildNewTaskModal() {
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'ab-global-newtask-modal';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'ab-newtask-heading');

    backdrop.innerHTML =
      '<form class="modal" id="ab-newtask-form">' +
        '<div class="modal-header">' +
          '<h3 id="ab-newtask-heading">Nova tarefa</h3>' +
          '<button type="button" class="ab-kan-close-btn" id="ab-newtask-close" aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="field">' +
            '<label class="field-label" for="ab-newtask-title">O que precisa ser feito?</label>' +
            '<input type="text" class="input" id="ab-newtask-title" placeholder="Ex.: Ajustar integração de nota fiscal" required>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
            '<div class="field">' +
              '<label class="field-label" for="ab-newtask-project">Projeto</label>' +
              '<select class="select" id="ab-newtask-project">' +
                PROJECTS.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.fullName) + '</option>'; }).join('') +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label class="field-label" for="ab-newtask-status">Estado inicial</label>' +
              '<select class="select" id="ab-newtask-status">' +
                STATES.map(function (s) { return '<option value="' + s.label + '"' + (s.id === 'afazer' ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>'; }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="ab-newtask-assignee">Responsável</label>' +
            '<select class="select" id="ab-newtask-assignee">' +
              PEOPLE.map(function (p) { return '<option value="' + p.name + '"' + (p.id === 'pedro' ? ' selected' : '') + '>' + escapeHtml(p.name) + ' (' + escapeHtml(p.role) + ')</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button type="button" class="btn btn-ghost" id="ab-newtask-cancel">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary">Criar tarefa</button>' +
        '</div>' +
      '</form>';

    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop || ev.target.closest('#ab-newtask-close') || ev.target.closest('#ab-newtask-cancel')) {
        backdrop.classList.remove('is-open');
      }
    });

    backdrop.querySelector('#ab-newtask-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var titleInput = backdrop.querySelector('#ab-newtask-title');
      var title = titleInput.value.trim();
      if (!title) return;
      var pid = backdrop.querySelector('#ab-newtask-project').value;
      var status = backdrop.querySelector('#ab-newtask-status').value;
      var assignee = backdrop.querySelector('#ab-newtask-assignee').value;
      var proj = PROJECTS.filter(function (p) { return p.id === pid; })[0] || PROJECTS[0];

      backdrop.classList.remove('is-open');
      titleInput.value = '';
      emit('ab:taskcreated', {
        title: title,
        status: status,
        projectId: proj.id,
        projectName: proj.name,
        assignee: assignee
      });
      showToast('Tarefa "' + title + '" criada em ' + proj.name + ' · ' + status, 'success');
    });

    document.body.appendChild(backdrop);
    shellRefs.newTaskModal = backdrop;
  }

  function openNewTaskModal(defaultStatus) {
    if (!shellRefs.newTaskModal) return;
    shellRefs.newTaskModal.querySelector('#ab-newtask-project').value = getProjectId();
    if (defaultStatus) {
      shellRefs.newTaskModal.querySelector('#ab-newtask-status').value = defaultStatus;
    }
    shellRefs.newTaskModal.classList.add('is-open');
    setTimeout(function () {
      shellRefs.newTaskModal.querySelector('#ab-newtask-title').focus();
    }, 20);
  }

  /* ========================================================================
     Toasts
     ======================================================================== */
  function ensureToastStack() {
    if (shellRefs.toastStack) return shellRefs.toastStack;
    var stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
    shellRefs.toastStack = stack;
    return stack;
  }

  function showToast(message, type) {
    var stack = ensureToastStack();
    var toast = document.createElement('div');
    toast.className = 'toast';
    var icon = type === 'warning' ? '<span class="toast-icon-warn">⚠</span>' : '<span class="toast-icon-ok">✓</span>';
    toast.innerHTML = icon + '<span>' + escapeHtml(message) + '</span>';
    stack.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3400);
  }

  /* ========================================================================
     Setters Globais (Role, Glass, Project) + Eventos
     ======================================================================== */
  function setRole(role) {
    var normalized = role === 'manager' ? 'manager' : 'collaborator';
    writeStorage(STORAGE.role, normalized);
    document.documentElement.dataset.role = normalized;

    var btns = document.querySelectorAll('[data-proto-role]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-proto-role') === normalized);
    }

    var av = document.getElementById('ab-account-avatar');
    var nm = document.getElementById('ab-account-name');
    var rl = document.getElementById('ab-account-role');
    if (av) av.textContent = normalized === 'manager' ? 'C' : 'P';
    if (nm) nm.textContent = normalized === 'manager' ? 'Carla Mendes' : 'Pedro Alves';
    if (rl) rl.textContent = normalized === 'manager' ? 'Gestora · Modo completo' : 'Colaborador · Minhas tarefas';

    renderKanContent();
    emit('ab:rolechange', { role: normalized });
  }

  function setGlass(glass) {
    var normalized = glass === 'opaque' ? 'opaque' : 'glass';
    writeStorage(STORAGE.glass, normalized);
    document.documentElement.dataset.glass = normalized;

    var btns = document.querySelectorAll('[data-proto-glass]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-proto-glass') === normalized);
    }
    emit('ab:glasschange', { glass: normalized });
  }

  function setProject(projectId) {
    var valid = projectId === 'b' || projectId === 'c' ? projectId : 'a';
    writeStorage(STORAGE.project, valid);
    writeStorage(STORAGE.sidebarExpandedProject, valid);
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has('projeto')) {
        url.searchParams.set('projeto', valid);
        window.history.replaceState(null, '', url.toString());
      }
    } catch (e) {
      /* ignore file:// restrictions if any */
    }
    var p = PROJECTS[0];
    for (var j = 0; j < PROJECTS.length; j++) {
      if (PROJECTS[j].id === valid) {
        p = PROJECTS[j];
        break;
      }
    }

    var bcProj = document.getElementById('ab-breadcrumb-proj');
    if (bcProj) bcProj.textContent = p.name;

    var treeEl = document.getElementById('ab-projects-tree');
    if (treeEl) {
      renderProjectsTree(treeEl, getPage(), getTab(), valid);
    }

    emit('ab:projectchange', { projectId: valid, project: p });
    showToast('Projeto ativo: ' + p.fullName, 'info');
  }

  function setActiveTab(tabId, titleOverride) {
    var page = getPage();
    var targetHref = page + '.html?tab=' + tabId;
    var navItems = document.querySelectorAll('.ab-nav-item[data-href]');
    for (var i = 0; i < navItems.length; i++) {
      var isMatch = navItems[i].getAttribute('data-href') === targetHref;
      navItems[i].classList.toggle('is-active', isMatch);
      if (isMatch) navItems[i].setAttribute('aria-current', 'page');
      else navItems[i].removeAttribute('aria-current');
    }
    var curProj = getProjectId();
    var targetKey = page + ':' + tabId;
    var subItems = document.querySelectorAll('.ab-proj-subitem[data-nav-key]');
    for (var s = 0; s < subItems.length; s++) {
      var isSubMatch =
        subItems[s].getAttribute('data-project-id') === curProj &&
        subItems[s].getAttribute('data-nav-key') === targetKey;
      subItems[s].classList.toggle('is-active', isSubMatch);
      if (isSubMatch) subItems[s].setAttribute('aria-current', 'page');
      else subItems[s].removeAttribute('aria-current');
    }
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      /* ignore file:// restrictions if any */
    }
    if (titleOverride) {
      var el = document.getElementById('ab-breadcrumb-page');
      var pill = document.getElementById('ab-proto-screen-name');
      if (el) el.textContent = titleOverride;
      if (pill) pill.textContent = titleOverride;
    }
    renderKanContent();
  }

  /* ========================================================================
     Montagem do Shell ao carregar o DOM
     ======================================================================== */
  var mounted = false;

  function mountShell() {
    if (mounted) return;
    mounted = true;

    var page = getPage();
    var tab = getTab();
    var isSpecial = page === 'index' || page === 'bandeja';

    if (page === 'index') document.body.setAttribute('data-shell', 'index');
    if (page === 'bandeja') document.body.setAttribute('data-shell', 'tray');

    // Captura os filhos originais da página (snapshot estático, mantendo <script> intactos)
    var children = Array.prototype.slice.call(document.body.childNodes);
    var pageNodes = [];
    for (var i = 0; i < children.length; i++) {
      var node = children[i];
      if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
        continue;
      }
      document.body.removeChild(node);
      pageNodes.push(node);
    }

    var protoBar = buildProtoBar(page);
    var stage = document.createElement('div');
    stage.className = 'proto-stage';

    if (isSpecial) {
      pageNodes.forEach(function (n) { stage.appendChild(n); });
      document.body.insertBefore(stage, document.body.firstChild);
      document.body.insertBefore(protoBar, stage);
    } else {
      var win = document.createElement('div');
      win.className = 'ab-window';

      var sidebar = buildSidebar(page, tab);
      var main = document.createElement('div');
      main.className = 'ab-main';

      var titlebar = buildTitleBar(page, tab);
      var workspace = document.createElement('div');
      workspace.className = 'ab-workspace';

      var content = document.createElement('main');
      content.className = 'ab-content';
      content.id = 'ab-content';
      pageNodes.forEach(function (n) { content.appendChild(n); });

      var kanDrawer = buildKanDrawer();
      var kanFab = buildKanFab();
      shellRefs.kanDrawer = kanDrawer;
      shellRefs.kanFab = kanFab;
      shellRefs.kanPill = titlebar.querySelector('#ab-kan-pill');

      workspace.appendChild(content);
      main.appendChild(titlebar);
      main.appendChild(workspace);
      win.appendChild(sidebar);
      win.appendChild(main);
      stage.appendChild(win);

      document.body.insertBefore(stage, document.body.firstChild);
      document.body.insertBefore(protoBar, stage);
      document.body.appendChild(kanDrawer);
      document.body.appendChild(kanFab);

      var shouldOpenKan = getUrlParam('kan') === '1' || readStorage(STORAGE.kanOpen, 'false') === 'true';
      if (window.KAN3D) {
        shellRefs.kan3d = window.KAN3D.mount(kanFab.querySelector('#ab-kan-fab-stage'), {
          view: 'closed',
          follow: true,
          initialOpen: shouldOpenKan
        });
      }
      setKanOpen(shouldOpenKan, null, true);

      window.addEventListener('ab:kanaction', function () {
        if (shellRefs.kan3d) shellRefs.kan3d.play('Spin_360');
      });
      window.addEventListener('ab:taskcreated', function () {
        if (shellRefs.kan3d) shellRefs.kan3d.play('Spin_360');
      });
      window.addEventListener('ab:rolechange', updateKanApiHeaderState);
      window.addEventListener('ab:projectchange', updateKanApiHeaderState);
    }

    buildPalette();
    buildNewTaskModal();
    ensureToastStack();

    // Atalhos globais de teclado: Ctrl+K, F1, Esc
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        if (paletteState.open) closePalette();
        else openPalette('');
        return;
      }
      if (ev.key === 'F1') {
        ev.preventDefault();
        toggleKan();
        return;
      }
      if (ev.key === 'Escape') {
        if (paletteState.open) {
          closePalette();
          return;
        }
        if (shellRefs.newTaskModal && shellRefs.newTaskModal.classList.contains('is-open')) {
          shellRefs.newTaskModal.classList.remove('is-open');
          return;
        }
        if (shellRefs.kanDrawer && shellRefs.kanDrawer.classList.contains('is-open')) {
          closeKan();
        }
      }
    });

    emit('ab:ready', {
      page: page,
      tab: tab,
      role: getRole(),
      glass: getGlass(),
      project: getProject()
    });
  }

  /* ========================================================================
     API Pública window.AgileBoxProto
     ======================================================================== */
  window.AgileBoxProto = {
    getRole: getRole,
    setRole: setRole,
    getGlass: getGlass,
    setGlass: setGlass,
    getProject: getProject,
    getProjectId: getProjectId,
    setProject: setProject,
    getPage: getPage,
    getTab: getTab,
    openKan: openKan,
    closeKan: closeKan,
    toggleKan: toggleKan,
    completeKanStep: function (stepId) {
      var role = getRole();
      var done = getCompletedSteps(role);
      if (done.indexOf(stepId) === -1) {
        done.push(stepId);
        saveCompletedSteps(role, done);
        renderKanContent();
        showToast('Passo concluído no guia do Kan!', 'success');
      }
    },
    openPalette: openPalette,
    closePalette: closePalette,
    openNewTaskModal: openNewTaskModal,
    showToast: showToast,
    setActiveTab: setActiveTab,
    setBreadcrumbTitle: function (title) {
      var el = document.getElementById('ab-breadcrumb-page');
      var pill = document.getElementById('ab-proto-screen-name');
      if (el) el.textContent = title;
      if (pill) pill.textContent = title;
    },
    getData: function () {
      return {
        states: STATES.slice(),
        projects: PROJECTS.slice(),
        people: PEOPLE.slice(),
        faq: FAQ_ITEMS.slice()
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountShell);
  } else {
    mountShell();
  }
})();
