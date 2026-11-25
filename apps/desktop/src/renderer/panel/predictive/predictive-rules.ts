import type { PanelView } from '../layout/PanelShell'

/**
 * Regras puras do Fluxo Preditivo (protótipo `preditivo.html`): textos de cada tópico e quais
 * indicadores aparecem em cada um. Os números vêm do servidor; aqui só se escolhe o texto.
 */

const SUBTITLES: Partial<Record<PanelView, string>> = {
  wbs: 'Divida o projeto em entregas claras e crie tarefas diretamente dentro de cada grupo.',
  risks: 'Clique na matriz 3×3 para filtrar a lista de riscos do projeto.',
  schedule: 'Passe o mouse ou clique em qualquer barra para abrir o detalhe completo da tarefa.',
  milestones: 'Acompanhe datas-chave de entrega ou aprovação ao longo do projeto.',
  baseline: 'Compare a previsão atual com a fotografia original salva no início do projeto.',
  burndown: 'Acompanhe o ritmo restante da sprint em comparação com a linha ideal.',
  flowMetrics: 'Veja quanto tempo o trabalho leva do pedido à entrega e onde está ficando retido.',
  impediments: 'Centralize impedimentos ativos do projeto e registre quem ajuda a destravar.',
}

/** Subtítulo do tópico; nulo quando o protótipo não traz um para a tela. */
export function predictiveSubtitle(view: PanelView): string | null {
  return SUBTITLES[view] ?? null
}

const TITLES: Partial<Record<PanelView, string>> = {
  wbs: 'Entregas (EAP)',
  risks: 'Riscos do Projeto',
  schedule: 'Linha do tempo (Gantt)',
  tracking: 'Acompanhamento',
  milestones: 'Marcos do projeto',
  baseline: 'Plano salvo (Linha de base)',
  plan: 'Plano',
  burndown: 'Ritmo (Burndown)',
  flowMetrics: 'Métricas de fluxo',
  impediments: 'Bloqueios do projeto',
}

/** Título da página por tópico (`.ab-page-title` do desenho). */
export function predictiveTitle(view: PanelView): string | null {
  return TITLES[view] ?? null
}

/** Rótulos do rail no desenho; o que não está aqui usa o rótulo da barra lateral. */
const RAIL_LABELS: Partial<Record<PanelView, string>> = {
  wbs: 'Estrutura (EAP)',
  risks: 'Riscos (3×3)',
  schedule: 'Linha do tempo',
  baseline: 'Plano salvo',
  burndown: 'Ritmo (Burndown)',
  flowMetrics: 'Métricas de fluxo',
  impediments: 'Bloqueios',
}

export const railLabelOf = (view: PanelView, fallback: string): string =>
  RAIL_LABELS[view] ?? fallback

/** Subtópicos da tela de Sprints, na ordem do rail do desenho. */
export const SPRINT_TOPICS = [
  { tab: 'active', label: 'Sprint ativa' },
  { tab: 'draft', label: 'Planejamento' },
  { tab: 'closed', label: 'Encerradas' },
] as const

export const SPRINT_TOPIC_TEXT = {
  active: {
    title: 'Sprint ativa',
    subtitle: 'Quadro vivo da sprint ativa nos 5 estados oficiais e acompanhamento de entrega.',
  },
  draft: {
    title: 'Planejamento da próxima sprint',
    subtitle: 'Selecione itens do Backlog que cabem na capacidade antes de iniciar o ciclo.',
  },
  closed: {
    title: 'Sprints encerradas',
    subtitle: 'Histórico das sprints concluídas, com o que foi entregue e o que seguiu adiante.',
  },
} as const

/** Grupo do rail pelo conjunto de telas: o rótulo mono em caixa alta do desenho. */
export function predictiveGroupLabel(views: readonly PanelView[]): string {
  if (views.some((view) => view === 'sprints' || view === 'burndown' || view === 'flowMetrics'))
    return 'Sprints'
  if (views.some((view) => view === 'wbs' || view === 'risks' || view === 'plan')) return 'Entregas'
  return 'Cronograma'
}

const KPI_TOPICS: ReadonlySet<PanelView> = new Set<PanelView>([
  'schedule',
  'milestones',
  'baseline',
])

/** Faixa de indicadores no topo: só nos tópicos de cronograma (o Acompanhamento já tem os seus). */
export function showsPredictiveKpis(view: PanelView): boolean {
  return KPI_TOPICS.has(view)
}

/** "9 de 14 tarefas finalizadas", com o singular e o caso sem tarefas. */
export function tasksProgressText(done: number, total: number): string {
  if (total === 0) return 'Nenhuma tarefa ainda'
  const noun = total === 1 ? 'tarefa finalizada' : 'tarefas finalizadas'
  return `${done} de ${total} ${noun}`
}

/** "83,7% do orçamento usado"; nulo sem orçamento previsto (não há percentual para calcular). */
export function budgetUsedText(realized: number, planned: number | null): string | null {
  if (planned === null || planned <= 0) return null
  const percent = (realized / planned) * 100
  const formatted = percent.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${formatted}% do orçamento usado`
}
