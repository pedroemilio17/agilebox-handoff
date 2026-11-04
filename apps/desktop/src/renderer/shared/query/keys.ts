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
    board: (projectId?: string, forUserId?: string) =>
      ['agilebox', 'tasks', 'board', projectId, forUserId] as const,
    detail: (taskId: string) => ['agilebox', 'tasks', 'detail', taskId] as const,
  },
  timeline: { list: (taskId: string) => ['agilebox', 'timeline', taskId] as const },
  meetings: { all: ['agilebox', 'meetings'] as const },
  contributors: { all: ['agilebox', 'contributors'] as const },
  dashboard: { all: ['agilebox', 'dashboard'] as const },
} as const
