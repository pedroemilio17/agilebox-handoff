import type { PanelView } from '../layout/PanelShell'

/**
 * Regras puras do Fluxo Preditivo (protótipo `preditivo.html`): textos de cada tópico e quais
 * indicadores aparecem em cada um. Os números vêm do servidor; aqui só se escolhe o texto.
 */

const SUBTITLES: Partial<Record<PanelView, string>> = {
  wbs: 'Divida o projeto em entregas claras antes de quebrar em tarefas.',
  risks: 'Riscos do projeto na matriz 3×3: clique em um quadrante para filtrar a lista.',
  schedule: 'Datas das tarefas, dependências entre elas e a linha de hoje.',
  milestones: 'Acompanhe datas-chave de entrega ou aprovação ao longo do projeto.',
  baseline: 'Compare a previsão atual com a fotografia original salva no início do projeto.',
}

/** Subtítulo do tópico; nulo quando o protótipo não traz um para a tela. */
export function predictiveSubtitle(view: PanelView): string | null {
  return SUBTITLES[view] ?? null
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
