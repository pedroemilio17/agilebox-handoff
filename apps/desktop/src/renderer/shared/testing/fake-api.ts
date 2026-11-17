import {
  failureResult,
  type AgileBoxApi,
  type AgileBoxBridge,
  type GuideViewDto,
  type ListBoardDto,
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
