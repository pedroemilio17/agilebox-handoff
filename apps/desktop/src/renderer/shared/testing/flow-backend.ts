import { vi } from 'vitest'
import type {
  AgileBoxApi,
  DashboardDto,
  GetTaskDto,
  ProjectDto,
  SessionUserDto,
  TaskDto,
  TeamToolsChangeResultDto,
  TeamToolsPreviewDto,
  TeamToolsViewDto,
  WipColumnDto,
  WipLimitsDto,
} from '@agilebox/contract'
import { makeDetail, makeParticipation, USER_ID } from '../../panel/task-detail/fixtures'
import { boardResponse } from './fake-api'

/**
 * Backend em memória para os testes de fluxo do painel e da bandeja. As gravações mudam o mesmo
 * estado que as leituras devolvem, então criar, mover, editar, comentar e arquivar aparecem na tela
 * como no app. As ferramentas da equipe também têm estado próprio: `serve` troca a visão que
 * `teamTools.get` devolve, como o servidor faria depois de uma gravação.
 */

export const FLOW_NOW = '2026-11-16T12:00:00.000Z'
export const FLOW_PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
export const FLOW_MANAGER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V09'

export const FLOW_PROJECT: ProjectDto = {
  id: FLOW_PROJECT_ID,
  name: 'Projeto Aurora',
  createdBy: FLOW_MANAGER_ID,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: null,
}

export const FLOW_USERS: SessionUserDto[] = [
  { id: FLOW_MANAGER_ID, name: 'Marta Gestora', initials: 'MG', role: 'manager', defaultRate: 80 },
  { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: 40 },
]

/** Tarefa que já existe no quadro: Ana é a responsável, tem horas e pode ser arquivada. */
export const FLOW_TASK: GetTaskDto = makeDetail({
  canArchive: true,
  participations: [makeParticipation({ hours: 2.5, rate: 40 })],
})

/** Tarefa com bloqueio e subtarefas: o que o Básico não deve ver, mas que precisa continuar salvo. */
export const FLOW_TASK_WITH_PLANNING: GetTaskDto = makeDetail({
  canArchive: true,
  blockedReason: 'Aguardando API',
  blockedAt: '2026-11-10T10:00:00.000Z',
  checklist: [
    {
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5CK1',
      taskId: FLOW_TASK.id,
      title: 'Mapear rotas',
      done: true,
      position: 0,
      createdAt: '2026-10-31T12:00:00.000Z',
      doneAt: '2026-11-02T10:00:00.000Z',
    },
    {
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5CK2',
      taskId: FLOW_TASK.id,
      title: 'Testar com o sandbox',
      done: false,
      position: 1,
      createdAt: '2026-10-31T12:00:00.000Z',
      doneAt: null,
    },
  ],
  checklistProgress: { done: 1, total: 2, percent: 50 },
  // Critérios e estimativa (M3.3): só aparecem no card quando o módulo está ligado.
  criteria: [
    {
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5CA1',
      taskId: FLOW_TASK.id,
      text: 'Rota de login responde',
      done: true,
      position: 0,
      createdAt: '2026-10-31T12:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
    },
    {
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5CA2',
      taskId: FLOW_TASK.id,
      text: 'Erro de senha mostra aviso',
      done: false,
      position: 1,
      createdAt: '2026-10-31T12:00:00.000Z',
      updatedAt: '2026-10-31T12:00:00.000Z',
    },
  ],
  estimatedHours: 2,
  participations: [makeParticipation({ hours: 2.5, rate: 40 })],
})

/** Tarefa parada há 5 dias (limite do sinal: mais de 4). Só a auditoria usa, para o marcador do card. */
export const FLOW_AGING_TASK = Object.assign(
  makeDetail({
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCG',
    number: 120,
    key: 'AB-120',
    title: 'Ajustar relatório',
    status: 'in_progress',
    deadline: null,
    canArchive: true,
    participations: [],
  }),
  { agingDays: 5 },
)

export function toTaskDto(detail: GetTaskDto): TaskDto {
  return {
    id: detail.id,
    number: detail.number,
    key: detail.key,
    projectId: detail.projectId,
    projectName: detail.projectName,
    title: detail.title,
    description: detail.description,
    status: detail.status,
    priority: detail.priority,
    blockedReason: detail.blockedReason,
    blockedAt: detail.blockedAt,
    checklistProgress: detail.checklistProgress,
    criteriaProgress: {
      done: (detail.criteria ?? []).filter((criterion) => criterion.done).length,
      total: (detail.criteria ?? []).length,
    },
    estimatedHours: detail.estimatedHours ?? null,
    commentCount: detail.comments.length,
    deadline: detail.deadline,
    ticketId: detail.ticketId,
    ticketUrl: detail.ticketUrl,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    archivedAt: detail.archivedAt ?? null,
    agingDays: (detail as { agingDays?: number }).agingDays ?? null,
    // Sprint aberta (M4.2): nula sem sprint ou sem o módulo ativo.
    sprint: detail.sprint ?? null,
    // Impedimento aberto (M5.2a): nulo sem impedimento ou com o módulo desligado.
    impediment: detail.impediment ?? null,
  }
}

export interface FlowBackend {
  get(taskId: string): GetTaskDto
  patch(taskId: string, changes: Partial<GetTaskDto>): TaskDto
  findByParticipation(participationId: string): GetTaskDto
  add(task: GetTaskDto): GetTaskDto
  /** Todas as tarefas guardadas, inclusive arquivadas. */
  all(): GetTaskDto[]
  board(): TaskDto[]
}

export function createFlowBackend(initial: readonly GetTaskDto[]): FlowBackend {
  let tasks = [...initial]
  const get = (taskId: string) => {
    const found = tasks.find((task) => task.id === taskId)
    if (!found) throw new Error(`tarefa ${taskId} não existe no fake`)
    return found
  }
  return {
    get,
    patch(taskId, changes) {
      tasks = tasks.map((task) =>
        task.id === taskId ? { ...task, ...changes, updatedAt: FLOW_NOW } : task,
      )
      return toTaskDto(get(taskId))
    },
    findByParticipation(participationId) {
      const found = tasks.find((task) =>
        task.participations.some((item) => item.id === participationId),
      )
      if (!found) throw new Error(`participação ${participationId} não existe no fake`)
      return found
    },
    add(task) {
      tasks = [...tasks, task]
      return task
    },
    all: () => [...tasks],
    board: () => tasks.filter((task) => !task.archivedAt).map(toTaskDto),
  }
}

/** Ponte do Electron que o painel lê (Ajustes pede a versão). */
export function stubDesktopBridge() {
  return {
    shell: {
      minimize: () => undefined,
      close: () => undefined,
      toggleTray: () => undefined,
      openPanel: () => undefined,
      setTrayHeight: () => undefined,
      setAppearance: () => undefined,
    },
    updates: {
      check: () => Promise.resolve({ state: 'unsupported', reason: 'teste' }),
      apply: () => Promise.resolve({ state: 'unsupported', reason: 'teste' }),
      restart: () => Promise.resolve({ state: 'unsupported', reason: 'teste' }),
      lastRun: () => Promise.resolve(null),
      info: () => Promise.resolve({ version: '0.0.0', mode: 'source' }),
      onProgress: () => () => undefined,
    },
  }
}

export interface FlowOptions {
  readonly role: 'collaborator' | 'manager'
  readonly tools: TeamToolsViewDto
  readonly tasks?: readonly GetTaskDto[]
  readonly wipLimits?: WipLimitsDto
  readonly wipColumns?: readonly WipColumnDto[]
  readonly dashboard?: DashboardDto
}

/**
 * Liga o fake da API a uma memória de tarefas e a uma visão de ferramentas que muda com as
 * gravações. Devolve o backend e as chamadas (espiões) para as asserções de cada teste.
 */
export function installFlowApi(api: AgileBoxApi, options: FlowOptions) {
  const backend = createFlowBackend(options.tasks ?? [FLOW_TASK])
  let tools = options.tools
  const userId = options.role === 'manager' ? FLOW_MANAGER_ID : USER_ID

  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId,
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDG',
    role: options.role,
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(FLOW_USERS)
  vi.spyOn(api.projects, 'list').mockResolvedValue([FLOW_PROJECT])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.meetings, 'list').mockResolvedValue([])
  vi.spyOn(api.meetings, 'listUpcoming').mockResolvedValue([])
  if (options.dashboard) vi.spyOn(api.dashboard, 'get').mockResolvedValue(options.dashboard)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)

  const spies = {
    listBoard: vi.spyOn(api.tasks, 'listBoard').mockImplementation(() =>
      Promise.resolve({
        ...boardResponse(backend.board()),
        wipLimits: options.wipLimits ?? {},
        wipColumns: [...(options.wipColumns ?? [])],
      }),
    ),
    getTask: vi
      .spyOn(api.tasks, 'get')
      .mockImplementation(({ taskId }) => Promise.resolve(structuredClone(backend.get(taskId)))),
    create: vi.spyOn(api.tasks, 'create').mockImplementation((input) => {
      const created = backend.add(
        makeDetail({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCF',
          number: 119,
          key: 'AB-119',
          title: input.title,
          status: 'todo',
          description: '',
          deadline: null,
          canArchive: true,
          participations: [],
        }),
      )
      return Promise.resolve(toTaskDto(created))
    }),
    move: vi
      .spyOn(api.tasks, 'move')
      .mockImplementation(({ taskId, status }) =>
        Promise.resolve(backend.patch(taskId, { status })),
      ),
    update: vi
      .spyOn(api.tasks, 'update')
      .mockImplementation(({ taskId, changes }) =>
        Promise.resolve(backend.patch(taskId, changes as Partial<GetTaskDto>)),
      ),
    setHours: vi
      .spyOn(api.participations, 'setHours')
      .mockImplementation(({ participationId, hours }) => {
        const task = backend.findByParticipation(participationId)
        const numeric = Number(hours.replace(',', '.'))
        const participations = task.participations.map((item) =>
          item.id === participationId ? { ...item, hours: numeric } : item,
        )
        backend.patch(task.id, { participations })
        return Promise.resolve(participations.find((item) => item.id === participationId)!)
      }),
    addComment: vi.spyOn(api.tasks.comments, 'add').mockImplementation(({ taskId, body }) => {
      const comment = {
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5CM1',
        taskId,
        authorId: USER_ID,
        authorName: 'Ana Souza',
        body,
        asManager: false,
        mentions: [],
        createdAt: FLOW_NOW,
        editedAt: null,
        canEdit: true,
        canRemove: true,
      }
      backend.patch(taskId, { comments: [...backend.get(taskId).comments, comment] })
      return Promise.resolve(comment)
    }),
    archive: vi
      .spyOn(api.tasks, 'archive')
      .mockImplementation(({ taskId }) =>
        Promise.resolve(backend.patch(taskId, { archivedAt: FLOW_NOW })),
      ),
    unarchive: vi
      .spyOn(api.tasks, 'unarchive')
      .mockImplementation(({ taskId }) =>
        Promise.resolve(backend.patch(taskId, { archivedAt: null })),
      ),
    getBoardFlow: vi.spyOn(api.tasks, 'getBoardFlow'),
    boardSettings: vi.spyOn(api.boardSettings, 'get'),
    teamToolsGet: vi.spyOn(api.teamTools, 'get').mockImplementation(() => Promise.resolve(tools)),
    previewChange: vi.spyOn(api.teamTools, 'previewChange'),
    applyChange: vi.spyOn(api.teamTools, 'applyChange'),
    applyPreset: vi.spyOn(api.teamTools, 'applyPreset'),
    setLevel: vi.spyOn(api.teamTools, 'setLevel'),
    completeWindDown: vi.spyOn(api.teamTools, 'completeWindDown'),
  }
  return {
    backend,
    spies,
    /** Passa a servir esta visão de ferramentas (o que o servidor devolveria depois da gravação). */
    serve: (view: TeamToolsViewDto) => {
      tools = view
    },
  }
}

/** Resultado de gravação com a visão nova e o que a regra ligou, encerrou ou desligou. */
export function changeResult(
  view: TeamToolsViewDto,
  parts: Partial<Pick<TeamToolsChangeResultDto, 'autoEnabled' | 'windingDown' | 'disabled'>> = {},
): TeamToolsChangeResultDto {
  return { view, autoEnabled: [], windingDown: [], disabled: [], ...parts }
}

/** Prévia que aceita a mudança, sem dependentes nem conflitos. */
export function previewOk(parts: Partial<TeamToolsPreviewDto> = {}): TeamToolsPreviewDto {
  return {
    ok: true,
    message: null,
    autoEnabled: [],
    activated: [],
    windingDown: [],
    disabled: [],
    conflicts: [],
    blockedBy: [],
    dependents: [],
    impact: [],
    ...parts,
  }
}

/** Painel do gestor com números de bloqueio, WIP e fluxo (o que o Básico não deve ver). */
export function managerDashboard(): DashboardDto {
  return {
    insights: {
      updatedAt: '2026-11-16T12:00:00Z',
      weekStart: '2026-11-09',
      upToDatePercentage: 80,
      agingCount: 0,
      overdueCount: 0,
      blockedCount: 1,
      overWipColumns: [{ status: 'in_progress', count: 4, limit: 3 }],
      cycleDays: 2.5,
      leadDays: 4,
      throughput: 1,
      weeks: [
        { start: '2026-11-09', throughput: 1, cycleDays: 2.5, leadDays: 4, upToDatePercentage: 80 },
      ],
      recentChanges: [],
      team: [
        {
          user: { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator' },
          taskCount: 1,
          completedPercentage: 0,
          inProgress: 1,
          agingCount: 0,
          overdueCount: 0,
          blockedCount: 1,
          lastUpdatedAt: '2026-11-16T10:00:00Z',
        },
      ],
    },
    distribution: { planning: 0, todo: 0, in_progress: 1, review: 0, done: 0 },
    collaborators: [],
  }
}
