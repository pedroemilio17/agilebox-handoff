import type { GuideStepDto, GuideViewDto } from '@agilebox/contract'
import type { PanelView } from '../layout/PanelShell'
import { guideCopy } from './guide-copy'

/**
 * Regras puras do cartão "Primeiros passos": quando aparece, em que estado abre, o progresso e o
 * destino da ação de cada passo. Não fala com a API nem com a tela.
 */

export type GuideStepStatus = 'done' | 'current' | 'pending'

export interface GuideStepItem {
  readonly step: GuideStepDto
  readonly status: GuideStepStatus
}

/**
 * O que a seção "O que fazer agora" mostra além do texto do passo: um botão que leva à tela do
 * passo. O passo que acontece na bandeja (`daily.answer`) leva à bandeja, com a orientação de quando.
 */
export type GuideStepAction =
  | { readonly kind: 'navigate'; readonly view: PanelView; readonly label: string }
  | { readonly kind: 'tray'; readonly label: string; readonly note: string }

export interface GuideCardState {
  readonly visible: boolean
  /** Estado inicial: aberto quando a intensidade pede `open`. */
  readonly initiallyOpen: boolean
  readonly complete: boolean
  readonly done: number
  readonly total: number
  readonly percent: number
  readonly progressText: string
  readonly steps: readonly GuideStepItem[]
  readonly current: GuideStepItem | null
  readonly action: GuideStepAction | null
  /** Título do passo seguinte, ou `null` quando o atual é o último. */
  readonly nextTitle: string | null
}

const NAVIGATE_ACTIONS: Readonly<Record<string, { view: PanelView; label: string }>> = {
  'backlog.list': { view: 'backlog', label: guideCopy.openBacklog },
  'backlog.rank': { view: 'backlog', label: guideCopy.openBacklog },
  'wbs.deliverables': { view: 'wbs', label: guideCopy.openWbs },
  'wbs.tasks': { view: 'wbs', label: guideCopy.openWbs },
  'milestones.create': { view: 'milestones', label: guideCopy.openMilestones },
  'schedule.dates': { view: 'schedule', label: guideCopy.openSchedule },
  'schedule.follow': { view: 'schedule', label: guideCopy.openSchedule },
  'estimate.first': { view: 'backlog', label: guideCopy.openBacklog },
  'sprints.create': { view: 'sprints', label: guideCopy.openSprints },
  'sprints.add': { view: 'sprints', label: guideCopy.openSprints },
  'ceremonies.planning': { view: 'agenda', label: guideCopy.openAgenda },
}

/** Destino da ação de um passo. `daily.answer` acontece pela bandeja. */
export function guideStepAction(stepKey: string): GuideStepAction | null {
  if (stepKey === 'daily.answer')
    return { kind: 'tray', label: guideCopy.openTray, note: guideCopy.dailyNote }
  const target = NAVIGATE_ACTIONS[stepKey]
  return target ? { kind: 'navigate', view: target.view, label: target.label } : null
}

/** Tela do passo (onde ele se realiza), ou `null` quando acontece fora do painel (bandeja). */
export function guideStepView(stepKey: string): PanelView | null {
  return NAVIGATE_ACTIONS[stepKey]?.view ?? null
}

/**
 * Telas do projeto em que o cartão aparece (ADR-10, 3.8.1). Painel de projeto: quadro, backlog,
 * sprints, entregas, marcos, cronograma, acompanhamento, linha de base, burndown, métricas, riscos e
 * módulos. Fora: dashboard (visão da organização), ajustes e plug-ins. A agenda entra só quando um
 * passo pendente se realiza nela (ver `guideOnScreen`).
 */
const GUIDE_SCREENS: ReadonlySet<PanelView> = new Set<PanelView>([
  'projects',
  'backlog',
  'sprints',
  'wbs',
  'milestones',
  'schedule',
  'tracking',
  'baseline',
  'burndown',
  'flowMetrics',
  'risks',
  'modules',
])

/**
 * A tela pode mostrar o cartão? Antes de consultar o guia: telas fora do fluxo nem leem o guia. A
 * agenda pode, mas depende da trilha (ver `guideOnScreen`).
 */
export function guideMayShowOn(view: PanelView): boolean {
  return GUIDE_SCREENS.has(view) || view === 'agenda'
}

/** O cartão aparece nesta tela? Só com o guia ativo (chamador confere projeto e trilha). */
export function guideOnScreen(view: PanelView, guide: GuideViewDto | undefined): boolean {
  if (GUIDE_SCREENS.has(view)) return true
  if (view === 'agenda')
    return (guide?.trail ?? []).some((step) => !step.done && guideStepView(step.key) === 'agenda')
  return false
}

/**
 * Aberto ou recolhido ao entrar numa tela. No quadro segue a intensidade do projeto. Nas demais,
 * abre só quando o passo atual se realiza nela; nas outras telas fica recolhido, com o passo atual
 * no cabeçalho. Trilha concluída fica sempre aberta (ver `GuideCard`).
 */
export function initialOpenOnScreen(state: GuideCardState, view: PanelView): boolean {
  if (!state.visible) return false
  if (view === 'projects') return state.initiallyOpen
  return state.current !== null && guideStepView(state.current.step.key) === view
}

const HIDDEN_STATE: GuideCardState = {
  visible: false,
  initiallyOpen: false,
  complete: false,
  done: 0,
  total: 0,
  percent: 0,
  progressText: '',
  steps: [],
  current: null,
  action: null,
  nextTitle: null,
}

/**
 * Decide o cartão a partir do DTO do guia. Não aparece sem projeto selecionado, sem trilha, quando a
 * pessoa dispensou o cartão ou quando a intensidade o esconde. Com todos os passos feitos, continua
 * visível no estado "Trilha concluída".
 */
export function getGuideCardState(
  projectId: string | null,
  guide: GuideViewDto | undefined,
): GuideCardState {
  if (projectId === null || guide === undefined) return HIDDEN_STATE
  if (guide.projectId !== projectId) return HIDDEN_STATE
  if (guide.trail.length === 0 || guide.cardDismissed) return HIDDEN_STATE
  if (guide.intensity.firstStepsCard === 'hidden') return HIDDEN_STATE

  const steps: GuideStepItem[] = guide.trail.map((step) => ({
    step,
    status: step.done ? 'done' : step.key === guide.currentKey ? 'current' : 'pending',
  }))
  const current = steps.find((item) => item.status === 'current') ?? null
  const complete = guide.currentKey === null
  const { total } = guide
  const done = Math.min(guide.done, total)

  return {
    visible: true,
    initiallyOpen: guide.intensity.firstStepsCard === 'open',
    complete,
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    progressText: guideCopy.progress(done, total),
    steps,
    current,
    action: current ? guideStepAction(current.step.key) : null,
    nextTitle: current ? current.step.next : null,
  }
}
