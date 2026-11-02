import {
  ApiError,
  type AgileBoxApi,
  type AgileBoxBridge,
  type ApiChannel,
  type ApiInput,
  type ApiOutput,
} from '@agilebox/contract'

type ApiInvoker = Pick<AgileBoxBridge, 'invoke' | 'onChanges'>

export function createIpcClient(bridge: ApiInvoker): AgileBoxApi {
  const call = <Channel extends ApiChannel>(
    channel: Channel,
    input: ApiInput<Channel>,
  ): Promise<ApiOutput<Channel>> =>
    bridge.invoke(channel, input).then((result) => {
      if (!result.ok) throw new ApiError(result.error.code, result.error.message)
      return result.value
    })

  return {
    session: {
      getCurrent: () => call('session.getCurrent', undefined),
      switchUser: (input) => call('session.switchUser', input),
      listUsers: () => call('session.listUsers', undefined),
    },
    users: { setDefaultRate: (input) => call('users.setDefaultRate', input) },
    projects: {
      list: () => call('projects.list', undefined),
      create: (input) => call('projects.create', input),
      listMembers: (input) => call('projects.listMembers', input),
      addMember: (input) => call('projects.addMember', input),
      removeMember: (input) => call('projects.removeMember', input),
    },
    tasks: {
      listBoard: (input) => call('tasks.listBoard', input),
      getBoardFlow: (input) => call('tasks.getBoardFlow', input),
      listTeamBoard: (input) => call('tasks.listTeamBoard', input),
      get: (input) => call('tasks.get', input),
      create: (input) => call('tasks.create', input),
      update: (input) => call('tasks.update', input),
      move: (input) => call('tasks.move', input),
      listRecent: () => call('tasks.listRecent', undefined),
      listFrequent: () => call('tasks.listFrequent', undefined),
      search: (input) => call('tasks.search', input),
      recordOpen: (input) => call('tasks.recordOpen', input),
    },
    participations: {
      add: (input) => call('participations.add', input),
      remove: (input) => call('participations.remove', input),
      setHours: (input) => call('participations.setHours', input),
      setRate: (input) => call('participations.setRate', input),
    },
    contributors: {
      list: () => call('contributors.list', undefined),
      create: (input) => call('contributors.create', input),
      setDefaultRate: (input) => call('contributors.setDefaultRate', input),
    },
    timeline: { list: (input) => call('timeline.list', input) },
    dashboard: { get: () => call('dashboard.get', undefined) },
    meetings: {
      list: (input) => call('meetings.list', input),
      listUpcoming: () => call('meetings.listUpcoming', undefined),
      create: (input) => call('meetings.create', input),
      update: (input) => call('meetings.update', input),
      delete: (input) => call('meetings.delete', input),
    },
    onChanges: bridge.onChanges,
  }
}

export function getIpcClient(): AgileBoxApi {
  return createIpcClient(window.agilebox)
}
