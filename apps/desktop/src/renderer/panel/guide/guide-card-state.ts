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
 * O que a seção "O que fazer agora" mostra além do texto do passo: um botão que leva à tela certa,
 * ou só uma orientação (para passos que acontecem fora do painel).
 */
export type GuideStepAction =
  | { readonly kind: 'navigate'; readonly view: PanelView; readonly label: string }
  | { readonly kind: 'note'; readonly text: string }

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

/** Destino da ação de um passo. `daily.answer` acontece pela bandeja, então só tem orientação. */
export function guideStepAction(stepKey: string): GuideStepAction | null {
  if (stepKey === 'daily.answer') return { kind: 'note', text: guideCopy.dailyNote }
  const target = NAVIGATE_ACTIONS[stepKey]
  return target ? { kind: 'navigate', view: target.view, label: target.label } : null
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
