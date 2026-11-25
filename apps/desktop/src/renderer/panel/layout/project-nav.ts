import type { Capabilities } from '../../shared/capabilities/capabilities-context'
import { panelCopy } from '../copy'
import { sprintCopy } from '../sprints/sprint-copy'
import { impedimentCopy } from '../impediments/impediment-copy'
import { trackingCopy } from '../tracking/tracking-screen'
import { baselineCopy } from '../baseline/baseline-screen'
import { burndownCopy } from '../burndown/burndown-screen'
import { flowMetricsCopy } from '../flow-metrics/flow-metrics-screen'
import { planCopy } from '../plan/plan-screen'
import type { PanelView } from './PanelShell'

export interface TopicTabItem<T extends string = PanelView> {
  readonly id: T
  readonly label: string
  readonly count?: string | null | undefined
}

export type ProjectNavGroupId =
  'home' | 'board' | 'backlog' | 'sprintsGroup' | 'deliverablesGroup' | 'scheduleGroup' | 'config'

export interface ProjectNavGroup {
  readonly id: ProjectNavGroupId
  readonly label: string
  readonly icon: string
  readonly defaultView: PanelView
  readonly views: readonly PanelView[]
  readonly tabs: readonly TopicTabItem<PanelView>[]
  readonly count?: string | null | undefined
  /** Entregas e Cronograma: os tópicos saem num rail do Fluxo Preditivo, não em abas no topo. */
  readonly predictive?: boolean
}

export interface ProjectNavOptions {
  readonly hasProject: boolean
  readonly activeSprintNumber: number | null
  readonly projectModuleCount: number | null
}

const GLOBAL_VIEWS: ReadonlySet<PanelView> = new Set<PanelView>([
  'dashboard',
  'updates',
  'agenda',
  'settings',
  'plugins',
])

/** Telas globais não pertencem a um projeto específico no breadcrumb da TitleBar. */
export function isProjectScopedView(view: PanelView): boolean {
  return !GLOBAL_VIEWS.has(view)
}

/**
 * Consolida os módulos ativos na árvore da barra lateral: Início (só com projeto, como no protótipo),
 * Quadro, Backlog, Sprints/Fluxo, Entregas, Cronograma e Configurações. Telas irmãs ficam em abas
 * internas, então o projeto mostra no máximo 7 itens de primeiro nível.
 */
export function buildProjectNavGroups(
  capabilities: Capabilities,
  { hasProject, activeSprintNumber, projectModuleCount }: ProjectNavOptions,
): readonly ProjectNavGroup[] {
  const groups: ProjectNavGroup[] = []
  if (hasProject) {
    groups.push({
      id: 'home',
      label: 'Início',
      icon: 'home',
      defaultView: 'home',
      views: ['home'],
      tabs: [],
    })
  }
  groups.push({
    id: 'board',
    label: 'Quadro',
    icon: 'projects',
    defaultView: 'projects',
    views: ['projects'],
    tabs: [],
  })

  if (capabilities.showScreen('backlog')) {
    groups.push({
      id: 'backlog',
      label: panelCopy.backlogTitle,
      icon: 'backlog',
      defaultView: 'backlog',
      views: ['backlog'],
      tabs: [],
    })
  }

  const sprintsTabs: TopicTabItem<PanelView>[] = []
  const sprintsOn = capabilities.showScreen('sprints')
  if (sprintsOn) {
    sprintsTabs.push({ id: 'sprints', label: sprintCopy.title })
  }
  if (hasProject && capabilities.showScreen('burndown')) {
    sprintsTabs.push({ id: 'burndown', label: burndownCopy.title })
  }
  if (hasProject && capabilities.showScreen('flowMetrics')) {
    sprintsTabs.push({ id: 'flowMetrics', label: flowMetricsCopy.title })
  }
  if (capabilities.showScreen('impediments')) {
    sprintsTabs.push({ id: 'impediments', label: impedimentCopy.title })
  }
  if (sprintsTabs.length > 0) {
    const first = sprintsTabs[0]!
    const single = sprintsTabs.length === 1
    // Não introduz o termo "Sprints" em presets Kanban quando só fluxo/bloqueios estão ligados.
    const groupLabel = single ? first.label : sprintsOn ? sprintCopy.title : 'Fluxo'
    const groupIcon = single ? first.id : sprintsOn ? 'sprints' : 'flowMetrics'
    const count =
      sprintsOn && hasProject && activeSprintNumber !== null ? `S${activeSprintNumber}` : null
    groups.push({
      id: 'sprintsGroup',
      label: groupLabel,
      icon: groupIcon,
      defaultView: first.id,
      views: sprintsTabs.map((tab) => tab.id),
      tabs: single ? [] : sprintsTabs,
      count,
      ...(single ? {} : { predictive: true }),
    })
  }

  if (hasProject) {
    const deliverablesTabs: TopicTabItem<PanelView>[] = []
    const wbsOn = capabilities.showScreen('wbs')
    if (wbsOn) {
      deliverablesTabs.push({ id: 'wbs', label: 'Entregas (EAP)' })
    }
    if (wbsOn && sprintsOn) {
      deliverablesTabs.push({ id: 'plan', label: planCopy.title })
    }
    if (capabilities.showScreen('risks')) {
      deliverablesTabs.push({ id: 'risks', label: 'Riscos' })
    }
    if (deliverablesTabs.length > 0) {
      const first = deliverablesTabs[0]!
      const single = deliverablesTabs.length === 1
      const hasPlan = deliverablesTabs.some((tab) => tab.id === 'plan')
      const views = deliverablesTabs.map((tab) => tab.id)
      groups.push({
        id: 'deliverablesGroup',
        label: single ? (first.id === 'wbs' ? 'Entregas' : first.label) : 'Entregas',
        icon: single ? first.id : 'wbs',
        defaultView: first.id,
        views: hasPlan ? [...views, 'planSprint'] : views,
        tabs: single ? [] : deliverablesTabs,
        predictive: true,
      })
    }

    const scheduleTabs: TopicTabItem<PanelView>[] = []
    if (capabilities.showScreen('schedule')) {
      scheduleTabs.push(
        { id: 'schedule', label: 'Cronograma' },
        { id: 'tracking', label: trackingCopy.title },
      )
    }
    if (capabilities.showScreen('milestones')) {
      scheduleTabs.push({ id: 'milestones', label: 'Marcos' })
    }
    if (capabilities.showScreen('baseline')) {
      scheduleTabs.push({ id: 'baseline', label: baselineCopy.title })
    }
    if (scheduleTabs.length > 0) {
      const first = scheduleTabs[0]!
      const single = scheduleTabs.length === 1
      groups.push({
        id: 'scheduleGroup',
        label: single ? first.label : 'Cronograma',
        icon: single ? first.id : 'schedule',
        defaultView: first.id,
        views: scheduleTabs.map((tab) => tab.id),
        tabs: single ? [] : scheduleTabs,
        predictive: true,
      })
    }

    groups.push({
      id: 'config',
      label: 'Configurações',
      icon: 'modules',
      defaultView: 'modules',
      views: ['modules'],
      tabs: [],
      count: projectModuleCount !== null ? String(projectModuleCount) : null,
    })
  }

  return groups
}

/** Localiza o grupo da barra lateral ao qual a tela atual pertence. */
export function findActiveProjectNavGroup(
  groups: readonly ProjectNavGroup[],
  view: PanelView,
): ProjectNavGroup | undefined {
  return groups.find((group) => group.views.includes(view))
}
