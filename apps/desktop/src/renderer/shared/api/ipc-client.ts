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
      if (!result.ok)
        throw new ApiError(result.error.code, result.error.message, result.error.missingItems)
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
      list: (input) => call('projects.list', input),
      create: (input) => call('projects.create', input),
      listMembers: (input) => call('projects.listMembers', input),
      addMember: (input) => call('projects.addMember', input),
      removeMember: (input) => call('projects.removeMember', input),
      archive: (input) => call('projects.archive', input),
      unarchive: (input) => call('projects.unarchive', input),
      rename: (input) => call('projects.rename', input),
      definitionOfDone: {
        list: (input) => call('projects.definitionOfDone.list', input),
        add: (input) => call('projects.definitionOfDone.add', input),
        rename: (input) => call('projects.definitionOfDone.rename', input),
        remove: (input) => call('projects.definitionOfDone.remove', input),
        move: (input) => call('projects.definitionOfDone.move', input),
      },
    },
    tasks: {
      listBoard: (input) => call('tasks.listBoard', input),
      getBoardFlow: (input) => call('tasks.getBoardFlow', input),
      listTeamBoard: (input) => call('tasks.listTeamBoard', input),
      get: (input) => call('tasks.get', input),
      create: (input) => call('tasks.create', input),
      update: (input) => call('tasks.update', input),
      move: (input) => call('tasks.move', input),
      block: (input) => call('tasks.block', input),
      unblock: (input) => call('tasks.unblock', input),
      archive: (input) => call('tasks.archive', input),
      unarchive: (input) => call('tasks.unarchive', input),
      checklist: {
        add: (input) => call('tasks.checklist.add', input),
        toggle: (input) => call('tasks.checklist.toggle', input),
        rename: (input) => call('tasks.checklist.rename', input),
        remove: (input) => call('tasks.checklist.remove', input),
        move: (input) => call('tasks.checklist.move', input),
      },
      setEstimate: (input) => call('tasks.setEstimate', input),
      criteria: {
        add: (input) => call('tasks.criteria.add', input),
        toggle: (input) => call('tasks.criteria.toggle', input),
        rename: (input) => call('tasks.criteria.rename', input),
        remove: (input) => call('tasks.criteria.remove', input),
        move: (input) => call('tasks.criteria.move', input),
      },
      comments: {
        add: (input) => call('tasks.comments.add', input),
        edit: (input) => call('tasks.comments.edit', input),
        remove: (input) => call('tasks.comments.remove', input),
      },
      listRecent: () => call('tasks.listRecent', undefined),
      listFrequent: () => call('tasks.listFrequent', undefined),
      search: (input) => call('tasks.search', input),
      recordOpen: (input) => call('tasks.recordOpen', input),
    },
    backlog: {
      list: (input) => call('backlog.list', input),
      add: (input) => call('backlog.add', input),
      reorder: (input) => call('backlog.reorder', input),
      pull: (input) => call('backlog.pull', input),
      sendBack: (input) => call('backlog.sendBack', input),
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
    dashboard: {
      get: () => call('dashboard.get', undefined),
      exportSummary: (input) => call('dashboard.exportSummary', input),
      saveSummary: (input) => call('dashboard.saveSummary', input),
    },
    boardSettings: {
      get: () => call('boardSettings.get', undefined),
      setWipLimits: (input) => call('boardSettings.setWipLimits', input),
    },
    meetings: {
      list: (input) => call('meetings.list', input),
      listUpcoming: () => call('meetings.listUpcoming', undefined),
      create: (input) => call('meetings.create', input),
      update: (input) => call('meetings.update', input),
      delete: (input) => call('meetings.delete', input),
      retroActions: {
        list: (input) => call('meetings.retroActions.list', input),
        add: (input) => call('meetings.retroActions.add', input),
        update: (input) => call('meetings.retroActions.update', input),
        toggle: (input) => call('meetings.retroActions.toggle', input),
        remove: (input) => call('meetings.retroActions.remove', input),
      },
    },
    daily: {
      getToday: (input) => call('daily.getToday', input),
      save: (input) => call('daily.save', input),
      listForDate: (input) => call('daily.listForDate', input),
      getForUser: (input) => call('daily.getForUser', input),
    },
    teamTools: {
      get: () => call('teamTools.get', undefined),
      previewChange: (input) => call('teamTools.previewChange', input),
      applyChange: (input) => call('teamTools.applyChange', input),
      completeWindDown: (input) => call('teamTools.completeWindDown', input),
      setLevel: (input) => call('teamTools.setLevel', input),
      applyPreset: (input) => call('teamTools.applyPreset', input),
    },
    onChanges: bridge.onChanges,
  }
}

export function getIpcClient(): AgileBoxApi {
  return createIpcClient(window.agilebox)
}
