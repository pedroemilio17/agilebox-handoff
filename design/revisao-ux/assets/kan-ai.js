/*
 * AgileBox · Shared Store + Assistente IA Kan (Google AI Studio / Gemini + Modo Local)
 * Todas as alterações executam direto com snapshot para Desfazer e respeitam papel Gestor/Colaborador.
 */
(function () {
  'use strict';

  var KEY_STORE = 'agilebox_proto_ai_store_v1';
  var KEY_API = 'agilebox_proto_gemini_key';
  var KEY_MODEL = 'agilebox_proto_gemini_model';
  var KEY_CHAT = 'agilebox_proto_kan_chat_v1';

  var OFFICIAL_STATES = ['Planejamento', 'A fazer', 'Desenvolvendo', 'Revisar', 'Concluído'];
  var DEFAULT_MODEL = 'gemini-2.5-flash';

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function nowLabel() {
    var d = new Date();
    return 'Hoje, ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function normalizeText(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function normalizeState(raw) {
    var n = normalizeText(raw);
    if (!n) return null;
    if (n.indexOf('planej') !== -1 || n === 'plan' || n === 'triage') return 'Planejamento';
    if (n.indexOf('fazer') !== -1 || n === 'todo' || n === 'to do' || n === 'afazer') return 'A fazer';
    if (n.indexOf('desenv') !== -1 || n.indexOf('andament') !== -1 || n === 'doing' || n === 'in progress') return 'Desenvolvendo';
    if (n.indexOf('revis') !== -1 || n === 'review' || n === 'qa') return 'Revisar';
    if (n.indexOf('conclu') !== -1 || n === 'done' || n === 'feito' || n === 'pronto' || n === 'finalizado') return 'Concluído';
    return null;
  }

  function normalizePriority(raw) {
    var n = normalizeText(raw);
    if (!n) return null;
    if (n.indexOf('alt') !== -1 || n === 'high' || n === 'urgente') return 'Alta';
    if (n.indexOf('baix') !== -1 || n === 'low') return 'Baixa';
    if (n.indexOf('med') !== -1 || n === 'medium' || n === 'normal') return 'Média';
    return null;
  }

  function normalizePerson(raw) {
    var n = normalizeText(raw);
    if (!n) return null;
    var map = [
      ['ana', 'Ana'],
      ['joao', 'João'],
      ['pedro', 'Pedro'],
      ['carlos', 'Carlos'],
      ['maria', 'Maria'],
      ['carla', 'Carla']
    ];
    for (var i = 0; i < map.length; i++) {
      if (n.indexOf(map[i][0]) !== -1) return map[i][1];
    }
    return String(raw || '').trim() || null;
  }

  function formatShortDue(isoDate) {
    if (!isoDate) return '30 nov';
    if (isoDate === '2026-11-22') return 'Hoje';
    var months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var parts = String(isoDate).split('-');
    if (parts.length !== 3) return isoDate;
    var mIdx = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    return day + ' ' + (months[mIdx] || parts[1]);
  }

  function buildSeedStore() {
    return {
      version: 1,
      nextIdNum: 16,
      tasks: [
        {
          id: 'AB-1',
          projectId: 'a',
          status: 'Planejamento',
          title: 'Mapear fluxo de aprovação de pedidos B2B',
          assignee: 'Ana',
          support: 'Pedro',
          external: '',
          priority: 'Média',
          due: '28 nov',
          dueDate: '2026-11-28',
          dueWarn: false,
          subtasks: [
            { id: 's1-1', text: 'Levantar alçadas por faixa de valor', done: true },
            { id: 's1-2', text: 'Validar exceções com o comercial', done: false },
            { id: 's1-3', text: 'Documentar fluxo aprovado', done: false }
          ],
          blocked: false,
          blockReason: '',
          hours: 1.5,
          summary: 'Levantar regras de desconto com o time comercial antes de iniciar a implementação.',
          timeline: []
        },
        {
          id: 'AB-3',
          projectId: 'a',
          status: 'A fazer',
          title: 'Ajustar webhook de confirmação de boleto',
          assignee: 'Pedro',
          support: 'Carlos',
          external: '',
          priority: 'Alta',
          due: '25 nov',
          dueDate: '2026-11-25',
          dueWarn: true,
          subtasks: [
            { id: 's3-1', text: 'Simular retorno bancário com atraso', done: false },
            { id: 's3-2', text: 'Adicionar fila de reprocessamento', done: false }
          ],
          blocked: false,
          blockReason: '',
          hours: 0,
          summary: 'Garantir reprocessamento automático quando o retorno bancário chegar com atraso.',
          timeline: []
        },
        {
          id: 'AB-5',
          projectId: 'a',
          status: 'Desenvolvendo',
          title: 'Revisar contrato com Cliente ACME',
          assignee: 'Ana',
          support: 'João',
          external: 'Cliente ACME · Externa',
          priority: 'Alta',
          due: 'Hoje',
          dueDate: '2026-11-22',
          dueWarn: true,
          subtasks: [
            { id: 's5-1', text: 'Conferir cláusulas de SLA e tempo de resposta', done: true },
            { id: 's5-2', text: 'Alinhar cronograma de implantação com suporte', done: true },
            { id: 's5-3', text: 'Validar anexo financeiro final', done: false }
          ],
          blocked: false,
          blockReason: '',
          hours: 5.0,
          hoursByPerson: { Ana: 3.0, 'João': 2.0 },
          summary: 'Conferir cláusulas de SLA, prazos de entrega e cronograma de implantação junto ao Jurídico e validar pontos de pagamento diretamente com o Cliente ACME antes de liberar para faturamento.',
          timeline: [
            { author: 'Carla', isManager: true, time: 'Hoje, 09:15', text: 'Definiu prioridade como Alta e pediu acompanhamento.' },
            { author: 'João', isManager: false, time: 'Ontem, 17:05', text: 'Registrou +2,0h na validação técnica.' },
            { author: 'Ana', isManager: false, time: '18 nov, 14:20', text: 'Resolveu bloqueio: Aguardando anexo de SLA revisado.' }
          ]
        },
        {
          id: 'AB-8',
          projectId: 'a',
          status: 'A fazer',
          title: 'Corrigir filtro de datas no relatório mensal',
          assignee: 'João',
          support: 'Maria',
          external: '',
          priority: 'Média',
          due: '26 nov',
          dueDate: '2026-11-26',
          dueWarn: false,
          subtasks: [
            { id: 's8-1', text: 'Reproduzir erro de fuso após 21h', done: true },
            { id: 's8-2', text: 'Normalizar exportação CSV em UTC-3', done: false }
          ],
          blocked: true,
          blockReason: 'Aguardando massa de dados de homologação.',
          hours: 1.0,
          summary: 'Exportação CSV não considera fuso horário local nos registros após 21h.',
          timeline: []
        },
        {
          id: 'AB-11',
          projectId: 'a',
          status: 'Revisar',
          title: 'Validar tela de login no Fedora e Windows',
          assignee: 'Maria',
          support: 'Pedro',
          external: '',
          priority: 'Média',
          due: '24 nov',
          dueDate: '2026-11-24',
          dueWarn: false,
          subtasks: [
            { id: 's11-1', text: 'Testar modo sólido opaco no Fedora', done: true },
            { id: 's11-2', text: 'Conferir foco por teclado no Windows', done: true },
            { id: 's11-3', text: 'Validar escala 125%', done: true }
          ],
          blocked: false,
          blockReason: '',
          hours: 2.5,
          summary: 'Conferir contraste no modo sólido opaco e navegação por teclado.',
          timeline: []
        },
        {
          id: 'AB-12',
          projectId: 'a',
          status: 'Desenvolvendo',
          title: 'Migrar autenticação de sessão da Bandeja',
          assignee: 'João',
          support: 'Carlos',
          external: '',
          priority: 'Alta',
          due: '27 nov',
          dueDate: '2026-11-27',
          dueWarn: false,
          subtasks: [
            { id: 's12-1', text: 'Extrair provedor de token local', done: true },
            { id: 's12-2', text: 'Compartilhar sessão via IPC seguro', done: false },
            { id: 's12-3', text: 'Tratar expiração silenciosa', done: false },
            { id: 's12-4', text: 'Atualizar testes de integração', done: false }
          ],
          blocked: true,
          blockReason: 'Sem acesso à chave de staging do servidor.',
          hours: 2.0,
          summary: 'Compartilhar token local de forma segura entre Painel principal e Bandeja.',
          timeline: []
        },
        {
          id: 'AB-2',
          projectId: 'a',
          status: 'Concluído',
          title: 'Publicar pacote base de ícones do sistema',
          assignee: 'Ana',
          support: 'Pedro',
          external: '',
          priority: 'Baixa',
          due: '19 nov',
          dueDate: '2026-11-19',
          dueWarn: false,
          subtasks: [
            { id: 's2-1', text: 'Padronizar stroke 1.75px em SVGs', done: true },
            { id: 's2-2', text: 'Publicar sprites e tokens', done: true }
          ],
          blocked: false,
          blockReason: '',
          hours: 4.0,
          summary: 'Padronização dos ícones SVG de navegação e estados.',
          timeline: []
        },
        {
          id: 'AB-14',
          projectId: 'b',
          status: 'Planejamento',
          title: 'Inventário de tabelas legadas do ERP',
          assignee: 'Carlos',
          support: 'João',
          external: 'Parceiro SysERP · Externa',
          priority: 'Alta',
          due: '29 nov',
          dueDate: '2026-11-29',
          dueWarn: false,
          subtasks: [
            { id: 's14-1', text: 'Exportar dicionário de dados atual', done: true },
            { id: 's14-2', text: 'Mapear chaves estrangeiras críticas', done: false },
            { id: 's14-3', text: 'Definir campos obrigatórios de corte', done: false },
            { id: 's14-4', text: 'Validar mapeamento com Parceiro SysERP', done: false }
          ],
          blocked: false,
          blockReason: '',
          hours: 2.0,
          summary: 'Mapear campos obrigatórios antes da importação piloto.',
          timeline: []
        },
        {
          id: 'AB-15',
          projectId: 'b',
          status: 'Desenvolvendo',
          title: 'Script de migração de centros de custo',
          assignee: 'Pedro',
          support: 'Ana',
          external: '',
          priority: 'Média',
          due: '30 nov',
          dueDate: '2026-11-30',
          dueWarn: false,
          subtasks: [
            { id: 's15-1', text: 'Ler planilha consolidada do financeiro', done: true },
            { id: 's15-2', text: 'Validar hierarquia de contas', done: true },
            { id: 's15-3', text: 'Executar carga de teste em staging', done: false }
          ],
          blocked: false,
          blockReason: '',
          hours: 3.5,
          summary: 'Importar plano de contas validado pela equipe financeira.',
          timeline: []
        }
      ],
      backlog: {
        a: [
          { id: 'AB-11', title: 'Revisar envio de nota fiscal automática', priority: 'Alta', estimate: '4h · Média', owner: 'Carlos', allocated: false },
          { id: 'AB-12', title: 'Exportar histórico de tarefa em PDF simples', priority: 'Média', estimate: '3h · Média', owner: 'Ana', allocated: false },
          { id: 'AB-13', title: 'Ajustar máscara de telefone no cadastro externo', priority: 'Média', estimate: '2h · Rápida', owner: 'João', allocated: false },
          { id: 'AB-14', title: 'Melhorar mensagem de erro quando internet cai', priority: 'Baixa', estimate: '2h · Rápida', owner: 'Maria', allocated: false }
        ],
        b: [
          { id: 'ERP-08', title: 'Migrar tabela de centros de custo', priority: 'Alta', estimate: '6h · Grande', owner: 'Carlos', allocated: false },
          { id: 'ERP-09', title: 'Conferir saldos iniciais com a contabilidade', priority: 'Alta', estimate: '4h · Média', owner: 'Maria', allocated: false },
          { id: 'ERP-10', title: 'Documentar passo a passo de login único', priority: 'Média', estimate: '2h · Rápida', owner: 'Pedro', allocated: false }
        ],
        c: []
      },
      sprints: {
        a: {
          name: 'Sprint 14 · Fluxo de pedidos e relatórios',
          goal: 'Entregar checkout simplificado e validação de pedidos sem travamentos.',
          period: '16 nov – 27 nov',
          daysLeft: 'Restam 4 dias',
          closed: false,
          tasks: [
            { id: 'AB-01', title: 'Definir critérios de erro do pagamento', status: 'Planejamento', owner: 'Ana', hours: 3 },
            { id: 'AB-03', title: 'Validar campo de CEP no resumo do pedido', status: 'A fazer', owner: 'João', hours: 2 },
            { id: 'AB-04', title: 'Atualizar endpoint de cálculo de frete', status: 'Desenvolvendo', owner: 'Carlos', hours: 6 },
            { id: 'AB-05', title: 'Testar cupom de desconto com valor mínimo', status: 'Revisar', owner: 'Maria', hours: 3 },
            { id: 'AB-06', title: 'Conferir textos do e-mail de confirmação', status: 'Revisar', owner: 'Pedro', hours: 2 },
            { id: 'AB-07', title: 'Publicar ajuste de estoque em tempo real', status: 'Concluído', owner: 'Carlos', hours: 4 },
            { id: 'AB-08', title: 'Corrigir alinhamento do botão Finalizar', status: 'Concluído', owner: 'Ana', hours: 2 }
          ]
        }
      },
      dailies: [
        {
          id: 'daily-seed-1',
          author: 'Ana',
          date: 'Ontem',
          doneText: 'Avançou cláusulas SLA de AB-5 e validou ícones base em AB-2.',
          hoursLogged: 4.5,
          blocker: '',
          isManager: false
        }
      ]
    };
  }

  function loadStore() {
    try {
      var raw = window.localStorage.getItem(KEY_STORE);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tasks)) return parsed;
      }
    } catch (e) {
      /* ignore */
    }
    var seeded = buildSeedStore();
    saveStore(seeded);
    return seeded;
  }

  function saveStore(store) {
    try {
      window.localStorage.setItem(KEY_STORE, JSON.stringify(store));
    } catch (e) {
      /* ignore */
    }
  }

  var undoStack = {};

  function pushUndo(prevStore, label) {
    var undoId = 'undo_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    undoStack[undoId] = { store: clone(prevStore), label: label, undone: false };
    return undoId;
  }

  function getActor() {
    var proto = window.AgileBoxProto;
    var role = proto ? proto.getRole() : 'collaborator';
    return role === 'manager'
      ? { role: 'manager', name: 'Carla', isManager: true }
      : { role: 'collaborator', name: 'Ana', isManager: false };
  }

  function activeProjectId() {
    return window.AgileBoxProto ? window.AgileBoxProto.getProjectId() : 'a';
  }

  function emitStoreEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) {
      /* ignore */
    }
  }

  function triggerKanActionSpin(summary) {
    emitStoreEvent('ab:kanaction', { summary: summary });
  }

  function syncSubtasksMeta(task) {
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    task.subtasksTotal = task.subtasks.length;
    task.subtasksDone = task.subtasks.filter(function (s) { return Boolean(s.done); }).length;
  }

  function findTaskInStore(store, idOrQuery, projectId) {
    var tasks = store.tasks || [];
    if (idOrQuery) {
      var clean = String(idOrQuery).trim().toUpperCase();
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id.toUpperCase() === clean) return tasks[i];
      }
      var q = normalizeText(idOrQuery);
      for (var j = 0; j < tasks.length; j++) {
        if (projectId && tasks[j].projectId !== projectId) continue;
        if (normalizeText(tasks[j].title).indexOf(q) !== -1) return tasks[j];
      }
      for (var k = 0; k < tasks.length; k++) {
        if (normalizeText(tasks[k].title).indexOf(q) !== -1) return tasks[k];
      }
    }
    return null;
  }

  function appendTimeline(task, text, actor) {
    if (!Array.isArray(task.timeline)) task.timeline = [];
    task.timeline.unshift({
      author: actor.name,
      isManager: actor.isManager,
      time: nowLabel(),
      text: text
    });
  }

  function getWorkspaceContext() {
    var store = loadStore();
    var pid = activeProjectId();
    var actor = getActor();
    var proto = window.AgileBoxProto;
    var projTasks = store.tasks.filter(function (t) { return t.projectId === pid; });
    return {
      activeProjectId: pid,
      activeProjectName: proto && proto.getProject ? proto.getProject().fullName : 'Projeto A',
      activeRole: actor.role,
      actorName: actor.name,
      currentPage: proto ? proto.getPage() : 'quadro',
      officialStates: OFFICIAL_STATES,
      tasks: projTasks.map(function (t) {
        syncSubtasksMeta(t);
        return {
          id: t.id,
          projectId: t.projectId,
          title: t.title,
          status: t.status,
          assignee: t.assignee,
          support: t.support,
          priority: t.priority,
          due: t.due,
          hours: t.hours || 0,
          blocked: Boolean(t.blocked),
          blockReason: t.blockReason || '',
          subtasksDone: t.subtasksDone,
          subtasksTotal: t.subtasksTotal
        };
      }),
      sprint: store.sprints[pid] || null,
      backlog: store.backlog[pid] || [],
      recentDailies: store.dailies.slice(0, 5)
    };
  }

  function toolCreateTask(args) {
    var title = String((args && args.title) || '').trim();
    if (!title) {
      return { ok: false, error: 'Informe um título para criar a tarefa.' };
    }
    var store = loadStore();
    var prev = clone(store);
    var pid = (args && args.projectId) || activeProjectId();
    if (pid !== 'a' && pid !== 'b' && pid !== 'c') pid = activeProjectId();
    var actor = getActor();
    var status = normalizeState(args && args.status) || 'A fazer';
    var priority = normalizePriority(args && args.priority) || 'Média';
    var assignee = normalizePerson(args && args.assignee) || (actor.isManager ? 'Ana' : 'Pedro');
    var support = normalizePerson(args && args.support) || 'João';
    var dueDate = (args && args.dueDate) || '2026-11-30';
    var hours = typeof (args && args.hours) === 'number' && args.hours >= 0 ? args.hours : 0;
    var id = 'AB-' + (store.nextIdNum || 16);
    store.nextIdNum = (store.nextIdNum || 16) + 1;

    var subtasks = Array.isArray(args && args.subtasks)
      ? args.subtasks.filter(Boolean).map(function (txt, idx) {
          return { id: id.toLowerCase() + '-s' + (idx + 1), text: String(txt).trim(), done: false };
        })
      : [];

    var newTask = {
      id: id,
      projectId: pid,
      status: status,
      title: title,
      assignee: assignee,
      support: support,
      external: String((args && args.external) || '').trim(),
      priority: priority,
      due: formatShortDue(dueDate),
      dueDate: dueDate,
      dueWarn: dueDate === '2026-11-22',
      subtasks: subtasks,
      blocked: false,
      blockReason: '',
      hours: hours,
      summary: String((args && args.description) || 'Criada via assistente Kan.'),
      timeline: []
    };
    syncSubtasksMeta(newTask);
    appendTimeline(newTask, 'Criou a tarefa em ' + status + (hours ? ' com ' + hours + 'h' : '') + ' (via Kan).', actor);

    store.tasks.push(newTask);
    if (args && args.addToSprint && store.sprints[pid]) {
      store.sprints[pid].tasks.push({
        id: newTask.id,
        title: newTask.title,
        status: newTask.status,
        owner: newTask.assignee,
        hours: Math.max(1, hours || 2)
      });
    }
    saveStore(store);

    var undoId = pushUndo(prev, 'Criar ' + id);
    emitStoreEvent('ab:taskcreated', { task: clone(newTask), projectId: pid, source: 'kan-ai' });
    emitStoreEvent('ab:storechange', { reason: 'create_task', taskId: id, store: clone(store) });
    triggerKanActionSpin('Tarefa ' + id + ' criada');

    return {
      ok: true,
      undoId: undoId,
      actionType: 'create_task',
      summary: 'Tarefa ' + id + ' criada em "' + status + '"',
      detail: newTask.title + ' · Resp.: ' + assignee + ' · Prioridade ' + priority,
      task: clone(newTask)
    };
  }

  function toolUpdateTask(args) {
    var store = loadStore();
    var pid = activeProjectId();
    var target = findTaskInStore(store, (args && (args.taskId || args.id || args.query)), pid);
    if (!target) {
      return { ok: false, error: 'Não encontrei nenhuma tarefa correspondente a "' + ((args && (args.taskId || args.query)) || '') + '".' };
    }
    var actor = getActor();
    if (!actor.isManager && target.projectId === 'a' && target.assignee === 'Maria' && target.support !== 'Pedro') {
      return { ok: false, error: 'No modo Colaborador você só edita tarefas em que participa (' + target.id + ' é de ' + target.assignee + ').' };
    }

    var prev = clone(store);
    var changes = [];

    if (args.title) {
      target.title = String(args.title).trim();
      changes.push('título alterado');
    }
    if (args.status) {
      var nextStatus = normalizeState(args.status);
      if (!nextStatus) {
        return { ok: false, error: 'Estado inválido. Use um dos 5 estados: ' + OFFICIAL_STATES.join(', ') + '.' };
      }
      if (target.status !== nextStatus) {
        changes.push('estado: ' + target.status + ' → ' + nextStatus);
        target.status = nextStatus;
      }
    }
    if (args.assignee) {
      var p = normalizePerson(args.assignee);
      if (p && target.assignee !== p) {
        target.assignee = p;
        changes.push('responsável → ' + p);
      }
    }
    if (args.support) {
      var sp = normalizePerson(args.support);
      if (sp) {
        target.support = sp;
        changes.push('apoio → ' + sp);
      }
    }
    if (args.priority) {
      var pr = normalizePriority(args.priority);
      if (pr) {
        target.priority = pr;
        changes.push('prioridade → ' + pr);
      }
    }
    if (args.dueDate) {
      target.dueDate = String(args.dueDate);
      target.due = formatShortDue(target.dueDate);
      changes.push('prazo → ' + target.due);
    }
    if (typeof args.addHours === 'number' && args.addHours > 0) {
      target.hours = Math.round(((target.hours || 0) + args.addHours) * 10) / 10;
      if (!target.hoursByPerson) target.hoursByPerson = {};
      target.hoursByPerson[actor.name] = Math.round(((target.hoursByPerson[actor.name] || 0) + args.addHours) * 10) / 10;
      changes.push('+' + args.addHours + 'h (total ' + target.hours.toFixed(1).replace('.', ',') + 'h)');
    }
    if (typeof args.blocked === 'boolean') {
      target.blocked = args.blocked;
      target.blockReason = args.blocked ? String(args.blockReason || 'Impedimento registrado via Kan.') : '';
      changes.push(args.blocked ? 'marcada como bloqueada' : 'bloqueio resolvido');
    }
    if (args.addSubtask) {
      if (!Array.isArray(target.subtasks)) target.subtasks = [];
      target.subtasks.push({
        id: target.id.toLowerCase() + '-s' + (target.subtasks.length + 1) + '-' + Date.now(),
        text: String(args.addSubtask).trim(),
        done: false
      });
      changes.push('subtarefa adicionada');
    }
    if (typeof args.toggleSubtaskIndex === 'number' && target.subtasks && target.subtasks[args.toggleSubtaskIndex]) {
      var st = target.subtasks[args.toggleSubtaskIndex];
      st.done = !st.done;
      changes.push('subtarefa ' + (st.done ? 'concluída' : 'reaberta'));
    }
    if (args.comment) {
      changes.push('comentário registrado: "' + String(args.comment).trim() + '"');
    }

    if (!changes.length) {
      return { ok: false, error: 'Nenhuma alteração reconhecida para aplicar em ' + target.id + '.' };
    }

    syncSubtasksMeta(target);
    appendTimeline(target, 'Via Kan: ' + changes.join(' · ') + '.', actor);

    // Sincronizar estado se a tarefa também estiver espelhada na Sprint ativa
    var spData = store.sprints[target.projectId];
    if (spData && Array.isArray(spData.tasks)) {
      for (var s = 0; s < spData.tasks.length; s++) {
        if (spData.tasks[s].id === target.id) {
          spData.tasks[s].status = target.status;
          spData.tasks[s].owner = target.assignee;
          spData.tasks[s].hours = target.hours;
        }
      }
    }

    saveStore(store);
    var undoId = pushUndo(prev, 'Atualizar ' + target.id);
    emitStoreEvent('ab:taskupdated', { task: clone(target), changes: changes, source: 'kan-ai' });
    emitStoreEvent('ab:storechange', { reason: 'update_task', taskId: target.id, store: clone(store) });
    triggerKanActionSpin(target.id + ' atualizada');

    return {
      ok: true,
      undoId: undoId,
      actionType: 'update_task',
      summary: target.id + ' atualizada (' + target.status + ')',
      detail: changes.join(' · ') + (actor.isManager ? ' · Marca: Gestor' : ''),
      task: clone(target)
    };
  }

  function toolManageSprint(args) {
    var actor = getActor();
    var action = (args && args.action) || 'allocate_task';
    var store = loadStore();
    var pid = (args && args.projectId) || activeProjectId();
    var sprint = store.sprints[pid];
    if (!sprint) {
      return { ok: false, error: 'Este projeto não está com Sprints ativas no momento (ex.: Modo Simples).' };
    }

    if (action === 'close_sprint') {
      if (!actor.isManager) {
        return { ok: false, error: 'Somente o papel Gestor pode encerrar uma Sprint.' };
      }
      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: true,
          toolName: 'manage_sprint',
          pendingArgs: { action: 'close_sprint', projectId: pid, confirmed: true },
          actionTitle: 'Encerrar ' + sprint.name + '?',
          detail: 'Esta é uma ação crítica de fim de ciclo. As tarefas não concluídas ficarão pendentes para o próximo ciclo.'
        };
      }
      var prevClose = clone(store);
      sprint.closed = true;
      saveStore(store);
      var undoCloseId = pushUndo(prevClose, 'Encerrar Sprint');
      emitStoreEvent('ab:sprintupdated', { sprint: clone(sprint), projectId: pid, source: 'kan-ai' });
      emitStoreEvent('ab:storechange', { reason: 'close_sprint', store: clone(store) });
      triggerKanActionSpin('Sprint encerrada');
      return {
        ok: true,
        undoId: undoCloseId,
        actionType: 'manage_sprint',
        summary: 'Sprint encerrada',
        detail: sprint.name + ' marcada como encerrada (Marca: Gestor).'
      };
    }

    if (action === 'update_goal') {
      if (!actor.isManager) {
        return { ok: false, error: 'Somente o papel Gestor pode alterar a meta da Sprint.' };
      }
      var goal = String((args && args.goal) || '').trim();
      if (!goal) return { ok: false, error: 'Informe o novo texto da meta da Sprint.' };
      var prevGoal = clone(store);
      sprint.goal = goal;
      saveStore(store);
      var undoGoalId = pushUndo(prevGoal, 'Atualizar meta da Sprint');
      emitStoreEvent('ab:sprintupdated', { sprint: clone(sprint), projectId: pid, source: 'kan-ai' });
      emitStoreEvent('ab:storechange', { reason: 'sprint_goal', store: clone(store) });
      triggerKanActionSpin('Meta da Sprint atualizada');
      return {
        ok: true,
        undoId: undoGoalId,
        actionType: 'manage_sprint',
        summary: 'Meta da Sprint atualizada',
        detail: goal
      };
    }

    // allocate_task
    var tId = String((args && (args.taskId || args.query)) || '').trim();
    var task = findTaskInStore(store, tId, pid);
    var title = task ? task.title : String((args && args.title) || tId || 'Nova entrega na Sprint');
    var finalId = task ? task.id : (tId.toUpperCase() || ('AB-' + store.nextIdNum++));
    var prevAlloc = clone(store);
    var exists = sprint.tasks.some(function (st) { return st.id === finalId; });
    if (!exists) {
      sprint.tasks.push({
        id: finalId,
        title: title,
        status: (task && task.status) || 'A fazer',
        owner: (task && task.assignee) || actor.name,
        hours: (task && task.hours) || 2
      });
    }
    var backlogList = store.backlog[pid] || [];
    for (var b = 0; b < backlogList.length; b++) {
      if (backlogList[b].id === finalId) backlogList[b].allocated = true;
    }
    saveStore(store);
    var undoAllocId = pushUndo(prevAlloc, 'Alocar ' + finalId + ' na Sprint');
    emitStoreEvent('ab:sprintupdated', { sprint: clone(sprint), projectId: pid, source: 'kan-ai' });
    emitStoreEvent('ab:storechange', { reason: 'sprint_allocate', taskId: finalId, store: clone(store) });
    triggerKanActionSpin(finalId + ' alocada na Sprint');
    return {
      ok: true,
      undoId: undoAllocId,
      actionType: 'manage_sprint',
      summary: finalId + ' alocada na ' + sprint.name.split('·')[0].trim(),
      detail: title
    };
  }

  function toolManageBacklog(args) {
    var store = loadStore();
    var pid = (args && args.projectId) || activeProjectId();
    if (!store.backlog[pid]) store.backlog[pid] = [];
    var action = (args && args.action) || 'add';
    var prev = clone(store);
    var actor = getActor();

    if (action === 'send_to_board') {
      var itemId = String((args && args.itemId) || '').trim().toUpperCase();
      var list = store.backlog[pid];
      var foundIdx = -1;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id.toUpperCase() === itemId) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx === -1) return { ok: false, error: 'Item ' + itemId + ' não encontrado no Backlog.' };
      var moved = list.splice(foundIdx, 1)[0];
      var newTask = {
        id: moved.id,
        projectId: pid,
        status: 'A fazer',
        title: moved.title,
        assignee: moved.owner || actor.name,
        support: 'Ana',
        external: '',
        priority: moved.priority || 'Média',
        due: '28 nov',
        dueDate: '2026-11-28',
        dueWarn: false,
        subtasks: [],
        blocked: false,
        blockReason: '',
        hours: 0,
        summary: 'Movida do Backlog para o Quadro via Kan.',
        timeline: [{ author: actor.name, isManager: actor.isManager, time: nowLabel(), text: 'Enviou do Backlog para o Quadro.' }]
      };
      syncSubtasksMeta(newTask);
      store.tasks.push(newTask);
      saveStore(store);
      var undoSend = pushUndo(prev, 'Enviar ' + moved.id + ' ao Quadro');
      emitStoreEvent('ab:taskcreated', { task: clone(newTask), projectId: pid, source: 'kan-ai' });
      emitStoreEvent('ab:storechange', { reason: 'backlog_to_board', store: clone(store) });
      triggerKanActionSpin(moved.id + ' no Quadro');
      return {
        ok: true,
        undoId: undoSend,
        actionType: 'manage_backlog',
        summary: moved.id + ' enviado do Backlog ao Quadro',
        detail: moved.title
      };
    }

    var title = String((args && args.title) || '').trim();
    if (!title) return { ok: false, error: 'Informe o título da ideia/tarefa para o Backlog.' };
    var newId = 'AB-' + (store.nextIdNum || 16);
    store.nextIdNum = (store.nextIdNum || 16) + 1;
    var item = {
      id: newId,
      title: title,
      priority: normalizePriority(args && args.priority) || 'Média',
      estimate: String((args && args.estimate) || '3h · Média'),
      owner: normalizePerson(args && args.owner) || actor.name,
      allocated: false
    };
    store.backlog[pid].unshift(item);
    saveStore(store);
    var undoAdd = pushUndo(prev, 'Adicionar ao Backlog');
    emitStoreEvent('ab:storechange', { reason: 'backlog_add', item: item, store: clone(store) });
    triggerKanActionSpin(newId + ' no Backlog');
    return {
      ok: true,
      undoId: undoAdd,
      actionType: 'manage_backlog',
      summary: newId + ' adicionada ao Backlog',
      detail: item.title + ' · Prioridade ' + item.priority
    };
  }

  function toolRecordDaily(args) {
    var text = String((args && (args.summary || args.doneText)) || '').trim();
    if (!text) return { ok: false, error: 'Descreva o que foi feito ou planejado para registrar na atualização do dia.' };
    var store = loadStore();
    var prev = clone(store);
    var actor = getActor();
    var entry = {
      id: 'daily_' + Date.now(),
      author: actor.name,
      date: nowLabel(),
      doneText: text,
      hoursLogged: typeof (args && args.hours) === 'number' ? args.hours : 0,
      blocker: String((args && args.blocker) || '').trim(),
      isManager: actor.isManager
    };
    store.dailies.unshift(entry);
    saveStore(store);
    var undoId = pushUndo(prev, 'Registrar atualização do dia');
    emitStoreEvent('ab:dailyupdated', { entry: entry, source: 'kan-ai' });
    emitStoreEvent('ab:storechange', { reason: 'record_daily', entry: entry, store: clone(store) });
    triggerKanActionSpin('Atualização do dia salva');
    return {
      ok: true,
      undoId: undoId,
      actionType: 'record_daily',
      summary: 'Atualização do dia registrada (' + actor.name + ')',
      detail: entry.doneText + (entry.hoursLogged ? ' · ' + entry.hoursLogged + 'h' : '') + (entry.blocker ? ' · Bloqueio: ' + entry.blocker : '')
    };
  }

  function undoAction(undoId) {
    var rec = undoStack[undoId];
    if (!rec) return { ok: false, error: 'Snapshot não encontrado ou expirado.' };
    if (rec.undone) return { ok: false, error: 'Essa ação já foi desfeita.' };
    saveStore(clone(rec.store));
    rec.undone = true;
    emitStoreEvent('ab:storechange', { reason: 'undo', undoId: undoId, store: clone(rec.store) });
    triggerKanActionSpin('Ação desfeita');
    if (window.AgileBoxProto && window.AgileBoxProto.showToast) {
      window.AgileBoxProto.showToast('Ação desfeita: ' + rec.label, 'info');
    }
    return { ok: true, label: rec.label };
  }

  var GEMINI_TOOLS = [
    {
      functionDeclarations: [
        {
          name: 'get_workspace_context',
          description: 'Lê o projeto ativo, papel do usuário, tarefas atuais, sprint ativa, backlog e atualizações diárias.',
          parameters: { type: 'OBJECT', properties: {} }
        },
        {
          name: 'create_task',
          description: 'Cria uma nova tarefa no AgileBox em um dos 5 estados oficiais: Planejamento, A fazer, Desenvolvendo, Revisar ou Concluído.',
          parameters: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: 'Título objetivo da tarefa em português.' },
              status: { type: 'STRING', description: 'Estado inicial: Planejamento, A fazer, Desenvolvendo, Revisar ou Concluído.' },
              assignee: { type: 'STRING', description: 'Responsável (Ana, João, Pedro, Carlos, Maria ou Carla).' },
              support: { type: 'STRING', description: 'Pessoa de apoio.' },
              priority: { type: 'STRING', description: 'Alta, Média ou Baixa.' },
              hours: { type: 'NUMBER', description: 'Horas já registradas inicialmente.' },
              description: { type: 'STRING', description: 'Descrição curta.' },
              subtasks: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Lista opcional de subtarefas.' },
              addToSprint: { type: 'BOOLEAN', description: 'Se true, também aloca na Sprint ativa.' }
            },
            required: ['title']
          }
        },
        {
          name: 'update_task',
          description: 'Atualiza qualquer tarefa existente (por ID como AB-5 ou trecho do título): mudar estado, lançar horas, bloquear/desbloquear, adicionar subtarefa, trocar responsável ou comentar.',
          parameters: {
            type: 'OBJECT',
            properties: {
              taskId: { type: 'STRING', description: 'ID da tarefa (ex.: AB-5) ou parte do título.' },
              title: { type: 'STRING' },
              status: { type: 'STRING', description: 'Novo estado entre os 5 oficiais.' },
              assignee: { type: 'STRING' },
              priority: { type: 'STRING' },
              addHours: { type: 'NUMBER', description: 'Horas a somar no registro (ex.: 1.5).' },
              blocked: { type: 'BOOLEAN', description: 'true para bloquear, false para resolver bloqueio.' },
              blockReason: { type: 'STRING', description: 'Motivo do bloqueio.' },
              addSubtask: { type: 'STRING', description: 'Texto de uma nova subtarefa.' },
              comment: { type: 'STRING', description: 'Comentário ou nota para a linha do tempo.' }
            },
            required: ['taskId']
          }
        },
        {
          name: 'manage_sprint',
          description: 'Gerencia a Sprint ativa: alocar tarefa, atualizar meta ou solicitar encerramento da sprint.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', description: 'allocate_task | update_goal | close_sprint' },
              taskId: { type: 'STRING', description: 'ID da tarefa para alocar.' },
              goal: { type: 'STRING', description: 'Nova meta da Sprint (para update_goal).' }
            },
            required: ['action']
          }
        },
        {
          name: 'manage_backlog',
          description: 'Adiciona item no Backlog ou envia item existente do Backlog para o Quadro.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', description: 'add | send_to_board' },
              title: { type: 'STRING' },
              priority: { type: 'STRING' },
              owner: { type: 'STRING' },
              itemId: { type: 'STRING', description: 'ID do item no Backlog ao usar send_to_board.' }
            },
            required: ['action']
          }
        },
        {
          name: 'record_daily',
          description: 'Registra uma atualização do dia (daily) para a equipe/gestor.',
          parameters: {
            type: 'OBJECT',
            properties: {
              summary: { type: 'STRING', description: 'Resumo do que foi feito hoje.' },
              hours: { type: 'NUMBER', description: 'Horas dedicadas no dia.' },
              blocker: { type: 'STRING', description: 'Impedimento opcional.' }
            },
            required: ['summary']
          }
        }
      ]
    }
  ];

  function executeTool(name, args) {
    switch (name) {
      case 'get_workspace_context':
        return { ok: true, context: getWorkspaceContext() };
      case 'create_task':
        return toolCreateTask(args || {});
      case 'update_task':
        return toolUpdateTask(args || {});
      case 'manage_sprint':
        return toolManageSprint(args || {});
      case 'manage_backlog':
        return toolManageBacklog(args || {});
      case 'record_daily':
        return toolRecordDaily(args || {});
      default:
        return { ok: false, error: 'Ferramenta desconhecida: ' + name };
    }
  }

  function buildSystemInstruction(ctx) {
    return (
      'Você é o Kan, assistente do AgileBox — plataforma brasileira de organização de tarefas para times de TI focada em mínimo atrito.\n' +
      'Regras obrigatórias do produto:\n' +
      '1. Responda sempre em português do Brasil claro, direto e enxuto.\n' +
      '2. Os únicos 5 estados oficiais de tarefa são, nesta ordem: Planejamento, A fazer, Desenvolvendo, Revisar, Concluído.\n' +
      '3. Sempre que o usuário pedir para criar tarefa, mudar estado, lançar horas, bloquear/desbloquear, atualizar sprint/backlog ou registrar daily, chame as ferramentas disponíveis imediatamente — NÃO peça confirmação para ações comuns, pois o usuário tem o botão Desfazer no chat (exceto se manage_sprint retornar needsConfirmation para encerrar a Sprint).\n' +
      '4. Papel ativo agora: ' + (ctx.activeRole === 'manager' ? 'Gestor (Carla — edições marcadas como Gestor)' : 'Colaborador (Ana — vê só o próprio valor/hora)') + '.\n' +
      '5. Projeto ativo: ' + ctx.activeProjectName + ' (id: ' + ctx.activeProjectId + '). Tela atual: ' + ctx.currentPage + '.\n' +
      '6. Nunca invente valores monetários R$ no modo Colaborador.\n'
    );
  }

  /* Fallback local esperto (quando não há chave Gemini configurada) */
  function runLocalAssistant(userText) {
    var text = String(userText || '').trim();
    var norm = normalizeText(text);
    var actions = [];
    var confirmations = [];
    var reply = '';

    var idMatch = text.match(/\b(AB-\d+|ERP-\d+)\b/i);
    var taskId = idMatch ? idMatch[1].toUpperCase() : null;

    if (/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|help|o que voce faz)/.test(norm)) {
      var ctx0 = getWorkspaceContext();
      return Promise.resolve({
        mode: 'local',
        text:
          'Oi! Sou o **Kan**. Mesmo sem conectar uma chave do Google AI Studio, consigo executar comandos diretos por aqui no **' +
          ctx0.activeProjectName +
          '** (com botão **Desfazer**):\n' +
          '• "Criar tarefa Revisar API de checkout em A fazer para Pedro"\n' +
          '• "Mover AB-5 para Revisar"\n' +
          '• "Lançar 2h em AB-5"\n' +
          '• "Registrar daily: finalizei endpoints e sem bloqueios"',
        actions: [],
        confirmations: []
      });
    }

    // Resumo / listar contexto
    if (/(quais tarefas|listar tarefas|resumo|status do projeto|o que esta bloqueado|bloqueios)/.test(norm) && !/criar|mover|lancar|registrar|bloquear\s+ab/.test(norm)) {
      var ctx = getWorkspaceContext();
      var blocked = ctx.tasks.filter(function (t) { return t.blocked; });
      var lines = ctx.tasks.slice(0, 6).map(function (t) {
        return '• ' + t.id + ' (' + t.status + (t.blocked ? ' · Bloqueada' : '') + '): ' + t.title + ' — ' + t.assignee;
      });
      reply =
        'No **' + ctx.activeProjectName + '** há ' + ctx.tasks.length + ' tarefas no quadro' +
        (blocked.length ? ' (' + blocked.length + ' bloqueada(s))' : '') + ':\n' +
        lines.join('\n');
      return Promise.resolve({ mode: 'local', text: reply, actions: [], confirmations: [] });
    }

    // Encerrar sprint -> exige cartão de confirmação
    if (/encerrar\s+sprint|fechar\s+sprint/.test(norm)) {
      var resClose = executeTool('manage_sprint', { action: 'close_sprint' });
      if (resClose.needsConfirmation) {
        confirmations.push(resClose);
        reply = 'Antes de concluir o ciclo, confirme abaixo se deseja encerrar a Sprint ativa.';
      } else {
        reply = resClose.error || 'Não foi possível iniciar o encerramento da Sprint.';
      }
      return Promise.resolve({ mode: 'local', text: reply, actions: [], confirmations: confirmations });
    }

    // Criar tarefa
    if (/^(criar|cria|nova|adicionar|adiciona)\s+(uma\s+)?tarefa\b/.test(norm) || /criar tarefa/.test(norm)) {
      var cleanTitle = text
        .replace(/^(por favor,?\s*)?(criar|cria|nova|adicionar|adiciona)\s+(uma\s+)?tarefa\s*(:|-)?\s*/i, '')
        .trim();
      var targetStatus = normalizeState(text) || 'A fazer';
      var assigneeMatch = text.match(/\b(?:para|resp(?:ons[aá]vel)?\.?)\s+([A-Za-zÀ-ÿ]+)/i);
      var assignee = assigneeMatch ? normalizePerson(assigneeMatch[1]) : null;
      var prio = normalizePriority(text) || 'Média';
      cleanTitle = cleanTitle
        .replace(/\b(?:em|para\s+o?\s+estado|na\s+coluna)\s+(?:planejamento|a fazer|desenvolvendo|revisar|conclu[ií]do)\b/ig, '')
        .replace(/\b(?:para|resp(?:ons[aá]vel)?\.?)\s+(?:ana|jo[aã]o|pedro|carlos|maria|carla)\b/ig, '')
        .replace(/\bprioridade\s+(?:alta|m[eé]dia|baixa)\b/ig, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!cleanTitle) cleanTitle = 'Nova demanda registrada pelo Kan';
      var resCreate = executeTool('create_task', {
        title: cleanTitle,
        status: targetStatus,
        assignee: assignee,
        priority: prio,
        addToSprint: /sprint/.test(norm)
      });
      if (resCreate.ok) {
        actions.push(resCreate);
        reply = 'Pronto! Criei a tarefa **' + resCreate.task.id + '** diretamente no quadro.';
      } else {
        reply = resCreate.error;
      }
      return Promise.resolve({ mode: 'local', text: reply, actions: actions, confirmations: [] });
    }

    // Backlog
    if (/backlog/.test(norm)) {
      if (taskId && /quadro|enviar|mover/.test(norm)) {
        var rSend = executeTool('manage_backlog', { action: 'send_to_board', itemId: taskId });
        if (rSend.ok) { actions.push(rSend); reply = 'Enviei **' + taskId + '** do Backlog para o Quadro.'; }
        else reply = rSend.error;
      } else {
        var bTitle = text.replace(/.*backlog\s*(:|-|de|para)?\s*/i, '').trim() || 'Nova ideia para o Backlog';
        var rAddB = executeTool('manage_backlog', { action: 'add', title: bTitle, priority: normalizePriority(text) || 'Média' });
        if (rAddB.ok) { actions.push(rAddB); reply = 'Item adicionado no Backlog.'; }
        else reply = rAddB.error;
      }
      return Promise.resolve({ mode: 'local', text: reply, actions: actions, confirmations: [] });
    }

    // Alocar na Sprint / atualizar meta
    if (/sprint/.test(norm)) {
      if (/meta/.test(norm)) {
        var gText = text.replace(/.*meta(?:\s+da\s+sprint)?\s*(:|para|-)?\s*/i, '').trim();
        var rGoal = executeTool('manage_sprint', { action: 'update_goal', goal: gText });
        if (rGoal.ok) { actions.push(rGoal); reply = 'Meta da Sprint atualizada.'; }
        else reply = rGoal.error;
      } else {
        var rAlloc = executeTool('manage_sprint', { action: 'allocate_task', taskId: taskId || text });
        if (rAlloc.ok) { actions.push(rAlloc); reply = 'Sprint atualizada com a alocação solicitada.'; }
        else reply = rAlloc.error;
      }
      return Promise.resolve({ mode: 'local', text: reply, actions: actions, confirmations: [] });
    }

    // Daily / atualização do dia
    if (/(daily|atualizacao do dia|check-?in|fiz hoje|trabalhei em)/.test(norm)) {
      var hrsDaily = text.match(/(\d+(?:[.,]\d+)?)\s*h\b/i);
      var cleanDaily = text.replace(/^(registrar\s+)?(a\s+)?(daily|atualiza[cç][aã]o\s+do\s+dia)\s*(:|-)?\s*/i, '').trim();
      var rDaily = executeTool('record_daily', {
        summary: cleanDaily || 'Atualização diária registrada pelo Kan.',
        hours: hrsDaily ? parseFloat(hrsDaily[1].replace(',', '.')) : 0
      });
      if (rDaily.ok) { actions.push(rDaily); reply = 'Atualização do dia salva com sucesso.'; }
      else reply = rDaily.error;
      return Promise.resolve({ mode: 'local', text: reply, actions: actions, confirmations: [] });
    }

    // Atualizar tarefa (estado / horas / bloqueio / subtarefa / comentário)
    if (taskId || /(mover|mudar|passar|colocar|lancar|registrar|somar|bloquear|desbloquear|subtarefa|comentar)/.test(norm)) {
      var upd = { taskId: taskId || 'AB-5' };
      var stFound = normalizeState(text);
      if (stFound) upd.status = stFound;

      var hrMatch = text.match(/([+]?\d+(?:[.,]\d+)?)\s*h\b/i);
      if (hrMatch && /(hora|lancar|lancamento|somar|registrar|adicionar|\+\d)/.test(norm)) {
        upd.addHours = parseFloat(hrMatch[1].replace(',', '.').replace('+', ''));
      }
      if (/desbloquear|resolver bloqueio|tirar bloqueio/.test(norm)) {
        upd.blocked = false;
      } else if (/bloquear|impedimento|travad/.test(norm)) {
        upd.blocked = true;
        var motivo = text.match(/(?:motivo|porque|por)\s+(.+)$/i);
        upd.blockReason = motivo ? motivo[1].trim() : 'Impedimento registrado via Kan.';
      }
      var subMatch = text.match(/subtarefa\s*[:\-]?\s*(.+)$/i);
      if (subMatch) upd.addSubtask = subMatch[1].replace(/\s+em\s+AB-\d+/i, '').trim();

      var commMatch = text.match(/comentar(?:\s+em\s+AB-\d+)?\s*[:\-]?\s*(.+)$/i);
      if (commMatch) upd.comment = commMatch[1].trim();

      var respMatch = text.match(/(?:respons[aá]vel|atribuir|passar\s+para)\s+(ana|jo[aã]o|pedro|carlos|maria|carla)/i);
      if (respMatch && !stFound) upd.assignee = respMatch[1];

      var rUpd = executeTool('update_task', upd);
      if (rUpd.ok) {
        actions.push(rUpd);
        reply = 'Feito! Atualizei a tarefa **' + rUpd.task.id + '**. Se quiser reverter, clique em **Desfazer**.';
      } else {
        reply = rUpd.error;
      }
      return Promise.resolve({ mode: 'local', text: reply, actions: actions, confirmations: [] });
    }

    return Promise.resolve({
      mode: 'local',
      text:
        'Consigo criar ou atualizar tarefas, alocar Sprints, enviar itens do Backlog e registrar a Daily — ou respondo conversas livres conectando sua chave gratuita do Google AI Studio ali no botão de chave acima.',
      actions: [],
      confirmations: []
    });
  }

  /* Integração real com Google AI Studio (Gemini REST API) */
  function callGemini(historyMessages, userText) {
    var apiKey = getApiKey();
    if (!apiKey) return runLocalAssistant(userText);

    var model = getModel();
    var url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(apiKey);

    var ctx = getWorkspaceContext();
    var contents = [];
    var slice = (historyMessages || []).slice(-8);
    for (var i = 0; i < slice.length; i++) {
      var m = slice[i];
      if (!m || !m.text) continue;
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }]
      });
    }
    contents.push({ role: 'user', parts: [{ text: userText }] });

    var collectedActions = [];
    var collectedConfirmations = [];
    var rounds = 0;

    function nextTurn() {
      if (rounds >= 6) {
        return Promise.resolve({
          mode: 'gemini',
          text: collectedActions.length ? 'Operações concluídas no workspace.' : 'Limite de chamadas de ferramenta atingido.',
          actions: collectedActions,
          confirmations: collectedConfirmations
        });
      }
      rounds += 1;

      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemInstruction(getWorkspaceContext()) }] },
          contents: contents,
          tools: GEMINI_TOOLS,
          generationConfig: { temperature: 0.35 }
        })
      }).then(function (resp) {
        if (!resp.ok) {
          return resp.json().catch(function () { return {}; }).then(function (errBody) {
            var msg = (errBody && errBody.error && errBody.error.message) || ('HTTP ' + resp.status);
            throw new Error(msg);
          });
        }
        return resp.json();
      }).then(function (data) {
        var cand = data && data.candidates && data.candidates[0];
        var parts = (cand && cand.content && cand.content.parts) || [];
        var fnCalls = [];
        var textParts = [];

        for (var p = 0; p < parts.length; p++) {
          if (parts[p].functionCall) fnCalls.push(parts[p]);
          if (parts[p].text) textParts.push(parts[p].text);
        }

        if (!fnCalls.length) {
          return {
            mode: 'gemini',
            text: textParts.join('\n').trim() || 'Pronto.',
            actions: collectedActions,
            confirmations: collectedConfirmations
          };
        }

        contents.push({ role: 'model', parts: parts });
        var fnResponses = [];
        for (var f = 0; f < fnCalls.length; f++) {
          var fc = fnCalls[f].functionCall;
          var res = executeTool(fc.name, fc.args || {});
          if (res && res.ok && res.needsConfirmation) {
            collectedConfirmations.push(res);
          } else if (res && res.ok && res.undoId) {
            collectedActions.push(res);
          }
          fnResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result: res }
            }
          });
        }
        contents.push({ role: 'user', parts: fnResponses });
        return nextTurn();
      });
    }

    return nextTurn().catch(function (err) {
      return {
        mode: 'error',
        error: String(err && err.message ? err.message : err),
        text:
          'Não consegui consultar o Google AI Studio agora (' +
          String(err && err.message ? err.message : err) +
          '). Confira sua chave API ou teste um comando rápido offline abaixo.',
        actions: collectedActions,
        confirmations: collectedConfirmations
      };
    });
  }

  function testApiKey(customKey, customModel) {
    var k = String(customKey || getApiKey() || '').trim();
    var m = customModel || getModel();
    if (!k) return Promise.resolve({ ok: false, message: 'Cole sua chave API do Google AI Studio.' });
    var url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(m) +
      ':generateContent?key=' +
      encodeURIComponent(k);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
        generationConfig: { maxOutputTokens: 8 }
      })
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return {}; }).then(function (e) {
          return { ok: false, message: (e && e.error && e.error.message) || ('Erro HTTP ' + resp.status) };
        });
      }
      return { ok: true, message: 'Conexão validada com ' + m + '!' };
    }).catch(function (err) {
      return { ok: false, message: 'Falha de rede: ' + String(err && err.message ? err.message : err) };
    });
  }

  function getApiKey() {
    try { return window.localStorage.getItem(KEY_API) || ''; } catch (e) { return ''; }
  }
  function setApiKey(key) {
    try {
      var clean = String(key || '').trim();
      if (clean) window.localStorage.setItem(KEY_API, clean);
      else window.localStorage.removeItem(KEY_API);
    } catch (e) {
      /* ignore */
    }
  }
  function getModel() {
    try { return window.localStorage.getItem(KEY_MODEL) || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; }
  }
  function setModel(model) {
    try { window.localStorage.setItem(KEY_MODEL, model || DEFAULT_MODEL); } catch (e) { /* ignore */ }
  }

  function loadChatHistory() {
    try {
      var raw = window.localStorage.getItem(KEY_CHAT);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {
      /* ignore */
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Oi! Sou o Kan. Posso responder dúvidas desta tela ou agir no seu projeto: criar tarefas, mover estados, lançar horas, atualizar Sprint/Backlog e registrar sua Daily — sempre com **Desfazer**.',
        actions: [],
        confirmations: []
      }
    ];
  }

  function saveChatHistory(msgs) {
    try {
      window.localStorage.setItem(KEY_CHAT, JSON.stringify((msgs || []).slice(-30)));
    } catch (e) {
      /* ignore */
    }
  }

  window.AgileBoxKanAI = {
    OFFICIAL_STATES: OFFICIAL_STATES,
    getStore: loadStore,
    saveStore: saveStore,
    resetStore: function () {
      var seeded = buildSeedStore();
      saveStore(seeded);
      emitStoreEvent('ab:storechange', { reason: 'reset', store: clone(seeded) });
      return seeded;
    },
    getWorkspaceContext: getWorkspaceContext,
    executeTool: executeTool,
    confirmAction: function (pending) {
      if (!pending || !pending.toolName) return { ok: false, error: 'Ação inválida.' };
      return executeTool(pending.toolName, pending.pendingArgs || {});
    },
    undoAction: undoAction,
    isUndone: function (undoId) {
      return Boolean(undoStack[undoId] && undoStack[undoId].undone);
    },
    sendMessage: callGemini,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    getModel: getModel,
    setModel: setModel,
    testApiKey: testApiKey,
    loadChatHistory: loadChatHistory,
    saveChatHistory: saveChatHistory
  };
})();
