import { getModule, MODULE_IDS, MODULE_LABELS } from './registry'
import type { ModuleId } from './registry'

/**
 * Manifesto de módulo (ADR-10, regra 4). Dados puros: o assistente de criação, a trilha do guia, os
 * estados vazios, o botão "?" e a validação de ligar e desligar leem só daqui e do catálogo
 * (`registry.ts`). Dependência dura (`requires`) e conflito continuam no catálogo, que é a única
 * fonte; o manifesto acrescenta o que é de texto e de guia.
 */

/** Nível do módulo no design: 1 essencial, 2 intermediário, 3 avançado. `null` só no núcleo. */
export type ModuleLevel = 1 | 2 | 3

/**
 * Eventos que concluem um passo do guia. O passo se conclui sozinho quando a pessoa faz a ação
 * (ADR-10, "Cada passo mostra três coisas"). Os eventos são emitidos pelos casos de uso de cada
 * módulo; esta lista só dá nome a eles.
 */
export const GUIDE_EVENT_TYPES = [
  'task.created',
  'backlog.reordered',
  'task.estimated',
  'sprint.created',
  'sprint.task_added',
  'meeting.created',
  'daily.answered',
  'deliverable.created',
  'task.deliverable_set',
  'milestone.created',
  'task.scheduled',
  'schedule.opened',
] as const

export type GuideEventType = (typeof GUIDE_EVENT_TYPES)[number]

export interface GuideStep {
  /** Estável: a trilha concluída é guardada por este id (`guide_progress.step_key`). */
  readonly key: string
  /** "Liste as entregas principais". */
  readonly title: string
  /** Uma frase: por que o passo existe. */
  readonly why: string
  readonly doneWhen: GuideEventType
}

/** O que o botão "?" mostra: por que existe, o fluxo e o que vem depois. */
export interface ModuleTutorial {
  readonly why: string
  readonly flow: readonly string[]
  readonly next: string
}

export interface ModuleEmptyState {
  /** Uma frase, para quem já conhece o módulo. */
  readonly short: string
  /** Explicação com exemplo, para quem nunca usou. */
  readonly full: string
}

/** O que o projeto precisa informar para o módulo dizer se pode ser desligado agora. */
export interface ProjectState {
  /** Há uma sprint ativa no projeto. */
  readonly hasActiveSprint: boolean
}

export type DisableBlockReason = 'active_sprint'

export interface DisableBlock {
  readonly reason: DisableBlockReason
  /** Desligar fica agendado para o fim do bloqueio, em vez de recusado. */
  readonly scheduleAtEnd: boolean
}

export type DisableCheck =
  { readonly ok: true } | { readonly ok: false; readonly block: DisableBlock }

export interface ModuleManifest {
  readonly id: ModuleId
  /** Nome na interface, com a explicação do jargão quando houver ("Entregas (EAP)"). */
  readonly name: string
  readonly level: ModuleLevel | null
  /** Uma frase: por que o módulo existe. */
  readonly objective: string
  /** Dependência dura, lida do catálogo. */
  readonly requires: readonly ModuleId[]
  /** Dependência suave: o módulo funciona sozinho e só lê dados do outro. */
  readonly enhances: readonly ModuleId[]
  readonly tutorial: ModuleTutorial
  readonly emptyState: ModuleEmptyState
  readonly steps: readonly GuideStep[]
  canDisable(state: ProjectState): DisableCheck
}

type ManifestInput = Omit<ModuleManifest, 'id' | 'name' | 'requires' | 'canDisable'> & {
  readonly name?: string
  readonly canDisable?: ModuleManifest['canDisable']
}

const ALWAYS_DISABLEABLE: ModuleManifest['canDisable'] = () => ({ ok: true })

/** Desligar Sprints com sprint ativa fica agendado para o fim dela (ADR-10, "Regras"). */
const BLOCK_WITH_ACTIVE_SPRINT: ModuleManifest['canDisable'] = (state) =>
  state.hasActiveSprint
    ? { ok: false, block: { reason: 'active_sprint', scheduleAtEnd: true } }
    : { ok: true }

function manifest(id: ModuleId, input: ManifestInput): ModuleManifest {
  return Object.freeze({
    id,
    name: input.name ?? MODULE_LABELS[id],
    level: input.level,
    objective: input.objective,
    requires: getModule(id).requires,
    enhances: Object.freeze([...input.enhances]),
    tutorial: Object.freeze({ ...input.tutorial, flow: Object.freeze([...input.tutorial.flow]) }),
    emptyState: Object.freeze({ ...input.emptyState }),
    steps: Object.freeze(input.steps.map((step) => Object.freeze({ ...step }))),
    canDisable: input.canDisable ?? ALWAYS_DISABLEABLE,
  })
}

const MANIFESTS: readonly ModuleManifest[] = [
  manifest('core', {
    name: 'Núcleo',
    level: null,
    objective: 'Organizar tarefas sem método nenhum.',
    enhances: [],
    tutorial: {
      why: 'Todo projeto funciona só com o núcleo: tarefas, quadro de 5 estados, envolvidos, prazo e linha do tempo.',
      flow: ['Criar a tarefa', 'Mover pelo quadro', 'Concluir'],
      next: 'Ligue um módulo quando sentir falta de algo.',
    },
    emptyState: {
      short: 'Nenhuma tarefa ainda.',
      full: 'Crie a primeira tarefa. Ela anda pelos estados Planejamento, A fazer, Desenvolvendo, Revisar e Concluído.',
    },
    steps: [],
  }),
  manifest('checkins', {
    name: 'Atualização diária',
    level: 1,
    objective: 'Manter o quadro em dia sem reunião.',
    enhances: ['sprints'],
    tutorial: {
      why: 'Um lembrete curto no fim do dia evita a reunião diária só para saber o que andou.',
      flow: ['Receber o lembrete na bandeja', 'Responder o que foi feito', 'Ver o resumo do dia'],
      next: 'As respostas alimentam as cerimônias, no lugar da daily presencial.',
    },
    emptyState: {
      short: 'Nenhuma atualização hoje.',
      full: 'No fim do dia a bandeja pergunta "Vamos dar uma atualizada do que foi feito hoje?". A resposta vira o resumo do dia.',
    },
    steps: [
      {
        key: 'daily.answer',
        title: 'Atualize pela bandeja',
        why: 'O quadro fica fiel ao que aconteceu, sem reunião.',
        doneWhen: 'daily.answered',
      },
    ],
  }),
  manifest('backlog', {
    level: 1,
    objective: 'Saber o que vem a seguir, em ordem.',
    enhances: ['wbs'],
    tutorial: {
      why: 'Sem ordem, a equipe escolhe pelo que parece mais fácil. O backlog mostra o que vem a seguir.',
      flow: ['Listar', 'Ordenar', 'Levar ao quadro'],
      next: 'Estimar em horas os primeiros itens.',
    },
    emptyState: {
      short: 'O backlog está vazio.',
      full: 'O backlog são as tarefas em Planejamento, em ordem. Por exemplo: "Tela de abrir chamado". "Levar ao quadro" move para A fazer.',
    },
    steps: [
      {
        key: 'backlog.list',
        title: 'Liste o que precisa ser feito',
        why: 'Tirar tudo da cabeça e pôr num lugar só.',
        doneWhen: 'task.created',
      },
      {
        key: 'backlog.rank',
        title: 'Ordene pela importância',
        why: 'O que está no topo entra primeiro na sprint. Sem ordem, a equipe escolhe pelo que parece mais fácil.',
        doneWhen: 'backlog.reordered',
      },
    ],
  }),
  manifest('estimates.hours', {
    name: 'Estimativa',
    level: 1,
    objective: 'Saber o tamanho do trabalho.',
    enhances: [],
    tutorial: {
      why: 'Horas estimadas dizem quanto cabe no ciclo e quanto o trabalho custa.',
      flow: ['Estimar a tarefa', 'Estimar cada envolvido', 'Comparar com o realizado'],
      next: 'A estimativa alimenta custo, sprints, cronograma e burndown.',
    },
    emptyState: {
      short: 'Nenhuma tarefa estimada.',
      full: 'Abra uma tarefa e informe as horas estimadas. Comece pelas primeiras da fila.',
    },
    steps: [
      {
        key: 'estimate.first',
        title: 'Estime os primeiros itens',
        why: 'Só dá para planejar o ciclo sabendo o tamanho do trabalho.',
        doneWhen: 'task.estimated',
      },
    ],
  }),
  manifest('cost', {
    level: 1,
    objective: 'Saber quanto o trabalho custa.',
    enhances: [],
    tutorial: {
      why: 'O custo é horas vezes o valor/hora de cada envolvido.',
      flow: ['Estimar horas', 'Conferir o valor/hora', 'Ver o custo da tarefa'],
      next: 'O custo aparece no dashboard e na linha de base.',
    },
    emptyState: {
      short: 'Sem custo calculado.',
      full: 'O custo aparece quando a tarefa tem horas estimadas e envolvidos com valor/hora.',
    },
    steps: [],
  }),
  manifest('milestones', {
    level: 1,
    objective: 'Marcar as datas que importam para quem está de fora.',
    enhances: ['wbs'],
    tutorial: {
      why: 'Quem acompanha de fora quer saber de datas e entregas, não de tarefas.',
      flow: ['Nomear o marco', 'Dar a data', 'Ligar a uma entrega (opcional)'],
      next: 'Os marcos aparecem no cronograma e no dashboard.',
    },
    emptyState: {
      short: 'Nenhum marco.',
      full: 'Um marco tem nome, data e, se quiser, a entrega a que se liga. Por exemplo: "Homologação aprovada".',
    },
    steps: [
      {
        key: 'milestones.create',
        title: 'Marque os marcos',
        why: 'Quem está de fora acompanha o projeto pelas datas.',
        doneWhen: 'milestone.created',
      },
    ],
  }),
  manifest('wbs', {
    level: 2,
    objective: 'Dividir o escopo em entregas menores.',
    enhances: [],
    tutorial: {
      why: 'A EAP divide o projeto pelo que será entregue, não pelo que será feito.',
      flow: ['Listar as entregas', 'Quebrar em níveis (até 3)', 'Ligar as tarefas'],
      next: 'As entregas alimentam backlog, cronograma, marcos e custo por entrega.',
    },
    emptyState: {
      short: 'Nenhuma entrega.',
      full: 'Comece com 3 a 6 grandes entregas, em substantivos. Por exemplo: "Módulo financeiro configurado". As tarefas vêm depois.',
    },
    steps: [
      {
        key: 'wbs.deliverables',
        title: 'Liste as entregas principais',
        why: 'Define o que o projeto entrega. Nada fica de fora do escopo.',
        doneWhen: 'deliverable.created',
      },
      {
        key: 'wbs.tasks',
        title: 'Quebre cada entrega em tarefas',
        why: 'As tarefas mostram o que será feito para cada entrega.',
        doneWhen: 'task.deliverable_set',
      },
    ],
  }),
  manifest('schedule', {
    level: 2,
    objective: 'Ver o plano no tempo.',
    enhances: ['wbs', 'milestones', 'estimates.hours'],
    tutorial: {
      why: 'Início, fim e dependências mostram o caminho do projeto e o que atrasa o resto.',
      flow: ['Dar início e fim', 'Ligar término a início', 'Acompanhar no Gantt'],
      next: 'A linha de base fotografa o cronograma para comparar depois.',
    },
    emptyState: {
      short: 'Nenhuma tarefa com datas.',
      full: 'Dê início e fim às tarefas e ligue as que dependem de outras. O Gantt agrupa por entrega quando a EAP está ligada.',
    },
    steps: [
      {
        key: 'schedule.dates',
        title: 'Dê início e fim e ligue as dependências',
        why: 'Sem datas não há plano no tempo.',
        doneWhen: 'task.scheduled',
      },
      {
        key: 'schedule.follow',
        title: 'Acompanhe pelo cronograma',
        why: 'Ver cedo o que desvia do plano.',
        doneWhen: 'schedule.opened',
      },
    ],
  }),
  manifest('sprints', {
    level: 2,
    objective: 'Trabalhar em ciclos curtos com meta.',
    enhances: ['estimates.hours'],
    tutorial: {
      why: 'Quando a entrega muda no caminho, planejar tudo de uma vez não funciona. A sprint fecha um pedaço pequeno, mostra o resultado e deixa a equipe corrigir o rumo antes do próximo.',
      flow: ['Planejar', 'Executar', 'Revisar', 'Retro'],
      next: 'Cerimônias e burndown aproveitam as sprints.',
    },
    emptyState: {
      short: 'Nenhuma sprint.',
      full: 'Crie a primeira sprint com uma meta e leve itens do backlog. No máximo uma sprint fica ativa por projeto.',
    },
    steps: [
      {
        key: 'sprints.create',
        title: 'Crie a primeira sprint',
        why: 'A meta diz o que o ciclo entrega.',
        doneWhen: 'sprint.created',
      },
      {
        key: 'sprints.add',
        title: 'Leve itens para a sprint',
        why: 'Só o que está na sprint aparece no quadro.',
        doneWhen: 'sprint.task_added',
      },
    ],
    canDisable: BLOCK_WITH_ACTIVE_SPRINT,
  }),
  manifest('wip', {
    name: 'Limites WIP',
    level: 2,
    objective: 'Evitar trabalho demais ao mesmo tempo.',
    enhances: [],
    tutorial: {
      why: 'Terminar antes de começar de novo mantém o fluxo. O limite avisa quando passa, sem bloquear.',
      flow: ['Escolher o limite por estado', 'Receber o aviso ao passar', 'Ajustar o limite'],
      next: 'As métricas de fluxo mostram o efeito do limite.',
    },
    emptyState: {
      short: 'Sem limites definidos.',
      full: 'Defina quantas tarefas cabem em cada estado. Quando passar, o quadro avisa, mas deixa continuar.',
    },
    steps: [],
  }),
  manifest('definitionOfDone', {
    level: 2,
    objective: 'Combinar o que conta como concluído.',
    enhances: [],
    tutorial: {
      why: 'Um checklist do projeto evita que cada pessoa entenda "pronto" de um jeito.',
      flow: ['Escrever o checklist', 'Conferir ao sair de Revisar', 'Concluir'],
      next: 'Aceite pendente avisa e deixa concluir.',
    },
    emptyState: {
      short: 'Sem critério de pronto.',
      full: 'Liste o que precisa ser verdade para uma tarefa contar como concluída. Por exemplo: "Revisada por outra pessoa".',
    },
    steps: [],
  }),
  manifest('reviewRetro', {
    name: 'Cerimônias',
    level: 2,
    objective: 'Dar ritmo ao alinhamento da equipe.',
    // O ADR-10 lista a Agenda como dependência suave, mas o catálogo atual a exige (`requires`).
    // Mantido assim até o Pedro decidir: ver docs/laco/pendencias-do-pedro.md.
    enhances: ['checkins'],
    tutorial: {
      why: 'Planning, review e retrospectiva viram eventos da Agenda, criados pelo gestor.',
      flow: ['Marcar a planning', 'Fazer a review', 'Fazer a retro'],
      next: 'As ações da retro voltam como tarefas.',
    },
    emptyState: {
      short: 'Nenhuma cerimônia marcada.',
      full: 'O gestor marca planning, review e retrospectiva na Agenda.',
    },
    steps: [
      {
        key: 'ceremonies.planning',
        title: 'Marque a planning',
        why: 'A equipe combina o que entra na sprint.',
        doneWhen: 'meeting.created',
      },
    ],
  }),
  manifest('burndown', {
    name: 'Burndown e velocidade',
    level: 2,
    objective: 'Ver se a sprint vai fechar.',
    enhances: [],
    tutorial: {
      why: 'Horas restantes por dia e horas concluídas por sprint mostram o ritmo.',
      flow: ['Estimar', 'Trabalhar', 'Ler o gráfico'],
      next: 'O dashboard usa a velocidade para prever o fim.',
    },
    emptyState: {
      short: 'Sem dados de sprint.',
      full: 'O gráfico aparece quando há uma sprint ativa com tarefas estimadas em horas.',
    },
    steps: [],
  }),
  manifest('flowMetrics', {
    name: 'Métricas de fluxo',
    level: 3,
    objective: 'Medir a previsibilidade da entrega.',
    enhances: ['wip'],
    tutorial: {
      why: 'Lead time, cycle time e vazão saem da linha do tempo das tarefas.',
      flow: ['Acumular tarefas concluídas', 'Ler as métricas', 'Ajustar o processo'],
      next: 'O dashboard mostra a tendência.',
    },
    emptyState: {
      short: 'Poucos dados ainda.',
      full: 'As métricas ganham sentido com tarefas concluídas ao longo de algumas semanas.',
    },
    steps: [],
  }),
  manifest('baseline', {
    level: 3,
    objective: 'Comparar o planejado com o realizado.',
    enhances: ['estimates.hours', 'cost'],
    tutorial: {
      why: 'Uma foto do cronograma e do custo numa data mostra os desvios depois.',
      flow: ['Fechar o plano', 'Tirar a linha de base', 'Comparar'],
      next: 'Os desvios aparecem no dashboard.',
    },
    emptyState: {
      short: 'Nenhuma linha de base.',
      full: 'Tire a linha de base quando o plano estiver combinado. Ela guarda datas e custo desse dia.',
    },
    steps: [],
  }),
  manifest('risks', {
    level: 3,
    objective: 'Antecipar o que pode dar errado.',
    enhances: ['wbs'],
    tutorial: {
      why: 'Cada risco tem descrição, probabilidade, impacto, resposta e dono.',
      flow: ['Registrar o risco', 'Definir a resposta', 'Revisar'],
      next: 'Os riscos abertos aparecem no dashboard.',
    },
    emptyState: {
      short: 'Nenhum risco registrado.',
      full: 'Registre o que pode dar errado e quem cuida disso. Por exemplo: "Fornecedor atrasa a entrega".',
    },
    steps: [],
  }),
  // Módulos herdados, fora do design: mantidos sem mudança (ADR-10, "Correspondência").
  manifest('agenda', {
    level: 1,
    objective: 'Ver e marcar os compromissos da equipe.',
    enhances: [],
    tutorial: {
      why: 'Só o gestor cria e edita agendamentos; a equipe vê.',
      flow: ['Marcar o evento', 'Ver na agenda'],
      next: 'As cerimônias usam a Agenda.',
    },
    emptyState: { short: 'Nenhum compromisso.', full: 'O gestor marca reuniões e eventos aqui.' },
    steps: [],
  }),
  manifest('impediments', {
    level: 2,
    objective: 'Registrar o que trava uma tarefa.',
    enhances: [],
    tutorial: {
      why: 'Um impedimento tem estado e responsável, e mostra o que precisa de ajuda.',
      flow: ['Registrar', 'Atribuir', 'Resolver'],
      next: 'Impedimentos abertos aparecem no dashboard.',
    },
    emptyState: {
      short: 'Nenhum impedimento.',
      full: 'Registre o que trava uma tarefa e quem resolve.',
    },
    steps: [],
  }),
  manifest('estimates.points', {
    name: 'Estimativa em pontos',
    level: 3,
    objective: 'Estimar o tamanho relativo do trabalho.',
    enhances: [],
    tutorial: {
      why: 'Pontos medem tamanho relativo. Conflita com a estimativa em horas.',
      flow: ['Estimar', 'Comparar'],
      next: 'Em breve.',
    },
    emptyState: { short: 'Nenhuma tarefa estimada.', full: 'Informe os pontos em cada tarefa.' },
    steps: [],
  }),
  manifest('acceptance', {
    level: 2,
    objective: 'Combinar quando uma tarefa está aceita.',
    enhances: [],
    tutorial: {
      why: 'Critérios de aceitação dizem o que a tarefa precisa cumprir.',
      flow: ['Escrever os critérios', 'Conferir', 'Concluir'],
      next: 'Aceite pendente avisa e deixa concluir.',
    },
    emptyState: {
      short: 'Sem critérios.',
      full: 'Escreva o que precisa ser verdade para a tarefa ser aceita.',
    },
    steps: [],
  }),
  manifest('subtasks', {
    name: 'Subtarefas e dependências',
    level: 3,
    objective: 'Quebrar a tarefa em partes e ligar o que depende de quê.',
    enhances: [],
    tutorial: {
      why: 'Subtarefas dividem o trabalho de uma tarefa grande.',
      flow: ['Quebrar', 'Ligar', 'Concluir'],
      next: 'Em breve.',
    },
    emptyState: { short: 'Sem subtarefas.', full: 'Divida uma tarefa grande em partes menores.' },
    steps: [],
  }),
  manifest('integrations', {
    name: 'Plug-ins',
    level: 3,
    objective: 'Ligar o AgileBox a outras ferramentas.',
    enhances: [],
    tutorial: { why: 'Fora do MVP.', flow: [], next: 'Em breve.' },
    emptyState: { short: 'Em breve.', full: 'Em breve.' },
    steps: [],
  }),
]

export const MODULE_MANIFESTS: Readonly<Record<ModuleId, ModuleManifest>> = Object.freeze(
  Object.fromEntries(MANIFESTS.map((entry) => [entry.id, entry])) as Record<
    ModuleId,
    ModuleManifest
  >,
)

export function getManifest(id: ModuleId): ModuleManifest {
  return MODULE_MANIFESTS[id]
}

/** Manifestos na ordem do catálogo. */
export function listManifests(): readonly ModuleManifest[] {
  return MODULE_IDS.map((id) => MODULE_MANIFESTS[id])
}
