import {
  failureResult,
  type WbsViewDto,
  type AgileBoxApi,
  type AgileBoxBridge,
  type GuideViewDto,
  type ListBoardDto,
  type MilestonesListDto,
  type RisksListDto,
  type ScheduleViewDto,
  type BurndownViewDto,
  type FlowMetricsViewDto,
  type TrackingViewDto,
  type OrganizationModulesViewDto,
  type ProjectModulesViewDto,
  type TaskDto,
} from '@agilebox/contract'
import { createIpcClient } from '../api/ipc-client'

const bridge: AgileBoxBridge = {
  invoke: () => Promise.resolve(failureResult('CONFLICT', 'A chamada não foi configurada no fake')),
  onChanges: () => () => undefined,
  shell: {
    minimize: () => undefined,
    close: () => undefined,
    toggleTray: () => undefined,
    openPanel: () => undefined,
    setTrayHeight: () => undefined,
    setAppearance: () => undefined,
  },
  updates: {
    check: () => Promise.resolve({ state: 'unsupported', reason: 'fake' }),
    apply: () => Promise.resolve({ state: 'unsupported', reason: 'fake' }),
    restart: () => Promise.resolve({ state: 'unsupported', reason: 'fake' }),
    lastRun: () => Promise.resolve(null),
    info: () => Promise.resolve({ version: '0.0.0', mode: 'source' }),
    onProgress: () => () => undefined,
  },
}

/** Resposta do quadro para os testes: tarefas, sem limites de WIP e sem contagem por coluna. */
export function boardResponse(tasks: readonly TaskDto[]): ListBoardDto {
  return { tasks: [...tasks], wipLimits: {}, wipColumns: [] }
}

/**
 * Guia sem trilha e escondido: o padrão dos testes, para o cartão "Primeiros passos" não aparecer
 * nas telas que não tratam dele. Testes do guia substituem `guide.get` pelo que precisam.
 */
export function hiddenGuide(projectId: string): GuideViewDto {
  return {
    projectId,
    trail: [],
    done: 0,
    total: 0,
    currentKey: null,
    experience: 'never',
    intensity: {
      firstStepsCard: 'hidden',
      emptyState: 'full',
      firstTimeHints: false,
      explainJargon: false,
    },
    cardDismissed: false,
    showWelcome: false,
    welcome: null,
  }
}

/**
 * Módulos do projeto sem nenhum módulo listado e sem permissão de gestor: o padrão dos testes, para
 * o botão "Como funciona" não depender de estado de módulo. Testes do painel substituem
 * `projectModules.get` pelo que precisam.
 */
export function hiddenProjectModules(projectId: string): ProjectModulesViewDto {
  return { projectId, modules: [], canManage: false }
}

/**
 * Estado dos módulos da organização sem projeto ativo: a interface cai nas ferramentas da equipe,
 * como antes. É o padrão dos testes; quem quer testar a regra por projeto substitui a leitura.
 */
export function hiddenOrganizationModules(): OrganizationModulesViewDto {
  return { modules: [], hasActiveProjects: false }
}

/** Marcos vazios do projeto, sem edição: o padrão dos testes para a tela Marcos não aparecer preenchida. */
export function emptyMilestonesView(projectId: string): MilestonesListDto {
  return { projectId, canEdit: false, milestones: [] }
}

/** Riscos vazios e sem permissão de edição: o padrão neutro dos testes da tela Riscos. */
export function emptyRisksView(projectId: string): RisksListDto {
  return { projectId, canEdit: false, risks: [] }
}

/** EAP vazia do projeto, sem edição: o padrão dos testes para a tela "Entregas" não aparecer preenchida. */
/** Cronograma vazio e sem permissão de edição: o padrão neutro dos testes do renderer. */
export function emptyScheduleView(projectId: string): ScheduleViewDto {
  return {
    projectId,
    canEdit: false,
    range: null,
    tasks: [],
    dependencies: [],
    milestones: [],
    today: '2026-01-01',
  }
}

export function emptyWbsView(projectId: string): WbsViewDto {
  return {
    projectId,
    canEdit: false,
    costEnabled: true,
    deliverables: [],
    summary: { deliverables: 0, tasks: 0, hours: 0, cost: null, progress: 0 },
    milestones: [],
    tasksWithoutDeliverable: 0,
  }
}

/** Burndown vazio: sem sprint, sem dias e sem velocidade. */
export function emptyBurndownView(projectId: string): BurndownViewDto {
  return {
    projectId,
    today: '2026-01-01',
    sprint: null,
    totalHours: 0,
    remainingHours: 0,
    scopeTasks: 0,
    doneTasks: 0,
    unestimatedTasks: 0,
    days: [],
    velocity: { average: null, sprints: [] },
  }
}

/** Métricas de fluxo vazias: sem tarefa concluída, sem médias e sem semanas. */
export function emptyFlowMetricsView(projectId: string): FlowMetricsViewDto {
  return {
    projectId,
    today: '2026-01-02',
    windowStart: '2025-11-10',
    windowEnd: '2026-01-05',
    leadDays: null,
    cycleDays: null,
    completed: 0,
    weeks: [],
  }
}

/** Acompanhamento vazio e sem custo: o padrão neutro dos testes (sem semana, sem marcos, sem valores). */
export function emptyTrackingView(projectId: string): TrackingViewDto {
  return {
    projectId,
    costEnabled: true,
    week: null,
    summary: {
      progress: 0,
      plannedHours: 0,
      loggedHours: 0,
      realizedCost: null,
      plannedCost: null,
      tasks: { total: 0, done: 0 },
    },
    nextMilestone: null,
    milestones: [],
    today: '2026-01-01',
  }
}

export function createFakeApi(overrides: Partial<AgileBoxApi> = {}): AgileBoxApi {
  const api = createIpcClient(bridge)
  return {
    ...api,
    ...overrides,
    session: { ...api.session, ...overrides.session },
    users: { ...api.users, ...overrides.users },
    projects: { ...api.projects, ...overrides.projects },
    tasks: { ...api.tasks, ...overrides.tasks },
    participations: { ...api.participations, ...overrides.participations },
    contributors: { ...api.contributors, ...overrides.contributors },
    timeline: { ...api.timeline, ...overrides.timeline },
    dashboard: { ...api.dashboard, ...overrides.dashboard },
    boardSettings: { ...api.boardSettings, ...overrides.boardSettings },
    meetings: { ...api.meetings, ...overrides.meetings },
    backlog: { ...api.backlog, ...overrides.backlog },
    // Sem EAP configurada, a leitura devolve uma visão vazia e sem permissão de edição.
    wbs: {
      ...api.wbs,
      get: (input) => Promise.resolve(emptyWbsView(input.projectId)),
      ...overrides.wbs,
    },
    milestones: {
      ...api.milestones,
      list: (input) => Promise.resolve(emptyMilestonesView(input.projectId)),
      ...overrides.milestones,
    },
    risks: {
      ...api.risks,
      list: (input) => Promise.resolve(emptyRisksView(input.projectId)),
      ...overrides.risks,
    },
    schedule: {
      ...api.schedule,
      get: (input) => Promise.resolve(emptyScheduleView(input.projectId)),
      ...overrides.schedule,
    },
    tracking: {
      ...api.tracking,
      get: (input) => Promise.resolve(emptyTrackingView(input.projectId)),
      ...overrides.tracking,
    },
    burndown: {
      ...api.burndown,
      get: (input) => Promise.resolve(emptyBurndownView(input.projectId)),
      ...overrides.burndown,
    },
    flowMetrics: {
      ...api.flowMetrics,
      get: (input) => Promise.resolve(emptyFlowMetricsView(input.projectId)),
      ...overrides.flowMetrics,
    },
    impediments: { ...api.impediments, ...overrides.impediments },
    sprints: { ...api.sprints, ...overrides.sprints },
    teamTools: { ...api.teamTools, ...overrides.teamTools },
    guide: {
      get: (input) => Promise.resolve(hiddenGuide(input.projectId)),
      dismissCard: () => Promise.resolve(undefined),
      resolveWelcome: () => Promise.resolve(undefined),
      ...overrides.guide,
    },
    projectModules: {
      ...api.projectModules,
      get: (input) => Promise.resolve(hiddenProjectModules(input.projectId)),
      getOrganization: () => Promise.resolve(hiddenOrganizationModules()),
      // Sem mudança configurada, a gravação não altera nada: os testes da tela substituem o que precisam.
      change: () =>
        Promise.resolve({ modules: [], autoEnabled: [], cascadeDisabled: [], scheduled: [] }),
      // Sem configuração de módulo por projeto, a gravação devolve a visão sem mudança.
      setConfig: (input) => Promise.resolve(hiddenProjectModules(input.projectId)),
      ...overrides.projectModules,
    },
  }
}
