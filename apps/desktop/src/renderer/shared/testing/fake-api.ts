import { failureResult, type AgileBoxApi, type AgileBoxBridge } from '@agilebox/contract'
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
    lastRun: () => Promise.resolve(null),
  },
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
    meetings: { ...api.meetings, ...overrides.meetings },
  }
}
