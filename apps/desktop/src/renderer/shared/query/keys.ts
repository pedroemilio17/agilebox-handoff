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
    archived: ['agilebox', 'projects', 'archived'] as const,
    members: (projectId: string) => ['agilebox', 'projects', 'members', projectId] as const,
  },
  tasks: {
    all: ['agilebox', 'tasks'] as const,
    board: (projectId?: string, forUserId?: string, scope?: 'mine' | 'team') =>
      ['agilebox', 'tasks', 'board', projectId, forUserId, scope] as const,
    detail: (taskId: string) => ['agilebox', 'tasks', 'detail', taskId] as const,
    archived: ['agilebox', 'tasks', 'archived'] as const,
  },
  timeline: { list: (taskId: string) => ['agilebox', 'timeline', taskId] as const },
  meetings: { all: ['agilebox', 'meetings'] as const },
  contributors: { all: ['agilebox', 'contributors'] as const },
  dashboard: { all: ['agilebox', 'dashboard'] as const },
  teamModules: {
    capabilities: ['agilebox', 'teamModules', 'capabilities'] as const,
    impactAll: ['agilebox', 'teamModules', 'impact'] as const,
    impact: (disable: readonly string[]) =>
      ['agilebox', 'teamModules', 'impact', ...disable] as const,
  },
} as const
