export const queryKeys = {
  all: ['agilebox'] as const,
  session: {
    all: ['agilebox', 'session'] as const,
    current: ['agilebox', 'session', 'current'] as const,
    users: ['agilebox', 'session', 'users'] as const,
  },
  projects: {
    all: ['agilebox', 'projects'] as const,
    list: ['agilebox', 'projects', 'list'] as const,
    members: (projectId: string) => ['agilebox', 'projects', 'members', projectId] as const,
    definitionOfDone: (projectId: string) =>
      ['agilebox', 'projects', 'definitionOfDone', projectId] as const,
  },
  tasks: {
    all: ['agilebox', 'tasks'] as const,
    board: (projectId?: string, forUserId?: string, includeArchived = false) =>
      ['agilebox', 'tasks', 'board', projectId, forUserId, includeArchived] as const,
    team: (projectId?: string, includeArchived = false) =>
      ['agilebox', 'tasks', 'team', projectId, includeArchived] as const,
    detail: (taskId: string) => ['agilebox', 'tasks', 'detail', taskId] as const,
  },
  wbs: {
    all: ['agilebox', 'wbs'] as const,
    project: (projectId: string) => ['agilebox', 'wbs', projectId] as const,
  },
  milestones: {
    all: ['agilebox', 'milestones'] as const,
    project: (projectId: string) => ['agilebox', 'milestones', projectId] as const,
  },
  risks: {
    all: ['agilebox', 'risks'] as const,
    project: (projectId: string) => ['agilebox', 'risks', projectId] as const,
  },
  schedule: {
    all: ['agilebox', 'schedule'] as const,
    project: (projectId: string) => ['agilebox', 'schedule', projectId] as const,
  },
  tracking: {
    all: ['agilebox', 'tracking'] as const,
    project: (projectId: string) => ['agilebox', 'tracking', projectId] as const,
  },
  baseline: {
    all: ['agilebox', 'baseline'] as const,
    project: (projectId: string) => ['agilebox', 'baseline', projectId] as const,
  },
  burndown: {
    all: ['agilebox', 'burndown'] as const,
    project: (projectId: string) => ['agilebox', 'burndown', projectId] as const,
  },
  flowMetrics: {
    all: ['agilebox', 'flowMetrics'] as const,
    project: (projectId: string) => ['agilebox', 'flowMetrics', projectId] as const,
  },
  backlog: {
    all: ['agilebox', 'backlog'] as const,
    list: (projectId: string) => ['agilebox', 'backlog', 'list', projectId] as const,
  },
  sprints: {
    all: ['agilebox', 'sprints'] as const,
    list: (projectId: string) => ['agilebox', 'sprints', 'list', projectId] as const,
    detail: (sprintId: string) => ['agilebox', 'sprints', 'detail', sprintId] as const,
  },
  impediments: {
    all: ['agilebox', 'impediments'] as const,
    /** Lista com os filtros da tela (projeto, responsável, resolvidos). */
    list: (filters: {
      readonly projectId?: string | undefined
      readonly ownerId?: string | undefined
      readonly includeResolved?: boolean | undefined
    }) =>
      [
        'agilebox',
        'impediments',
        'list',
        filters.projectId ?? null,
        filters.ownerId ?? null,
        filters.includeResolved === true,
      ] as const,
  },
  timeline: {
    all: ['agilebox', 'timeline'] as const,
    list: (taskId: string) => ['agilebox', 'timeline', taskId] as const,
  },
  daily: {
    all: ['agilebox', 'daily'] as const,
    today: (date: string) => ['agilebox', 'daily', 'today', date] as const,
    forDate: (date: string) => ['agilebox', 'daily', 'forDate', date] as const,
    entry: (userId: string, date: string) => ['agilebox', 'daily', 'entry', userId, date] as const,
    /** Sugestão do check-in para a data e o fuso do cliente (M5.1). */
    suggestion: (date: string, timeZone: string) =>
      ['agilebox', 'daily', 'suggestion', date, timeZone] as const,
  },
  meetings: { all: ['agilebox', 'meetings'] as const },
  guide: {
    all: ['agilebox', 'guide'] as const,
    project: (projectId: string) => ['agilebox', 'guide', projectId] as const,
  },
  projectModules: {
    all: ['agilebox', 'projectModules'] as const,
    project: (projectId: string) => ['agilebox', 'projectModules', projectId] as const,
    organization: ['agilebox', 'projectModules', 'organization'] as const,
    history: (projectId: string) => ['agilebox', 'projectModules', 'history', projectId] as const,
  },
  contributors: { all: ['agilebox', 'contributors'] as const },
  dashboard: { all: ['agilebox', 'dashboard'] as const },
  teamTools: {
    all: ['agilebox', 'teamTools'] as const,
    view: ['agilebox', 'teamTools', 'view'] as const,
  },
} as const
