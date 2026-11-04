import type { z } from 'zod'
import type { ChangeEvent } from './changes'
import {
  addProjectMemberInputSchema,
  addProjectMemberOutputSchema,
  createProjectInputSchema,
  createProjectOutputSchema,
  listProjectMembersInputSchema,
  listProjectMembersOutputSchema,
  listProjectsInputSchema,
  listProjectsOutputSchema,
  removeProjectMemberInputSchema,
  removeProjectMemberOutputSchema,
} from './projects'
import {
  addParticipationInputSchema,
  addParticipationOutputSchema,
  removeParticipationInputSchema,
  removeParticipationOutputSchema,
  setParticipationHoursInputSchema,
  setParticipationHoursOutputSchema,
  setParticipationRateInputSchema,
  setParticipationRateOutputSchema,
} from './participations'
import {
  addTaskCommentInputSchema,
  addTaskCommentOutputSchema,
  editTaskCommentInputSchema,
  editTaskCommentOutputSchema,
  removeTaskCommentInputSchema,
  removeTaskCommentOutputSchema,
} from './comments'
import {
  addChecklistItemInputSchema,
  moveChecklistItemInputSchema,
  removeChecklistItemInputSchema,
  renameChecklistItemInputSchema,
  toggleChecklistItemInputSchema,
} from './checklist'
import {
  createTaskInputSchema,
  createTaskOutputSchema,
  getTaskInputSchema,
  getTaskOutputSchema,
  getBoardFlowOutputSchema,
  listBoardInputSchema,
  listBoardOutputSchema,
  listFrequentTasksInputSchema,
  listFrequentTasksOutputSchema,
  listRecentTasksInputSchema,
  listRecentTasksOutputSchema,
  listTeamBoardInputSchema,
  listTeamBoardOutputSchema,
  moveTaskInputSchema,
  moveTaskOutputSchema,
  blockTaskInputSchema,
  blockTaskOutputSchema,
  unblockTaskInputSchema,
  unblockTaskOutputSchema,
  checklistChangeOutputSchema,
  recordTaskOpenInputSchema,
  recordTaskOpenOutputSchema,
  searchTasksInputSchema,
  searchTasksOutputSchema,
  taskUpdateInputSchema,
  taskUpdateOutputSchema,
} from './tasks'
import {
  createContributorInputSchema,
  createContributorOutputSchema,
  listContributorsInputSchema,
  listContributorsOutputSchema,
  setContributorDefaultRateInputSchema,
  setContributorDefaultRateOutputSchema,
} from './contributors'
import { listTimelineInputSchema, listTimelineOutputSchema } from './timeline'
import { getDashboardInputSchema, getDashboardOutputSchema } from './dashboard'
import {
  getBoardSettingsInputSchema,
  getBoardSettingsOutputSchema,
  setWipLimitsInputSchema,
  setWipLimitsOutputSchema,
} from './board-settings'
import {
  createMeetingInputSchema,
  createMeetingOutputSchema,
  addRetroActionInputSchema,
  addRetroActionOutputSchema,
  deleteMeetingInputSchema,
  deleteMeetingOutputSchema,
  listRetroActionsInputSchema,
  listRetroActionsOutputSchema,
  removeRetroActionInputSchema,
  removeRetroActionOutputSchema,
  toggleRetroActionInputSchema,
  toggleRetroActionOutputSchema,
  updateRetroActionInputSchema,
  updateRetroActionOutputSchema,
  listMeetingsInputSchema,
  listMeetingsOutputSchema,
  listUpcomingMeetingsInputSchema,
  listUpcomingMeetingsOutputSchema,
  updateMeetingInputSchema,
  updateMeetingOutputSchema,
} from './meetings'
import { setDefaultRateInputSchema, setDefaultRateOutputSchema } from './users'
import {
  addDefinitionOfDoneItemInputSchema,
  definitionOfDoneChangeOutputSchema,
  listDefinitionOfDoneInputSchema,
  listDefinitionOfDoneOutputSchema,
  moveDefinitionOfDoneItemInputSchema,
  removeDefinitionOfDoneItemInputSchema,
  renameDefinitionOfDoneItemInputSchema,
} from './definition-of-done'
import { API_CHANNELS, type ApiChannel } from './channels'
import {
  getCurrentSessionInputSchema,
  getCurrentSessionOutputSchema,
  listSessionUsersInputSchema,
  listSessionUsersOutputSchema,
  switchUserInputSchema,
  switchUserOutputSchema,
} from './session'

type SchemaPair = { input: z.ZodType; output: z.ZodType }

export const API_SCHEMA_REGISTRY = {
  'session.getCurrent': {
    input: getCurrentSessionInputSchema,
    output: getCurrentSessionOutputSchema,
  },
  'session.switchUser': { input: switchUserInputSchema, output: switchUserOutputSchema },
  'session.listUsers': { input: listSessionUsersInputSchema, output: listSessionUsersOutputSchema },
  'users.setDefaultRate': { input: setDefaultRateInputSchema, output: setDefaultRateOutputSchema },
  'projects.list': { input: listProjectsInputSchema, output: listProjectsOutputSchema },
  'projects.create': { input: createProjectInputSchema, output: createProjectOutputSchema },
  'projects.listMembers': {
    input: listProjectMembersInputSchema,
    output: listProjectMembersOutputSchema,
  },
  'projects.addMember': {
    input: addProjectMemberInputSchema,
    output: addProjectMemberOutputSchema,
  },
  'projects.removeMember': {
    input: removeProjectMemberInputSchema,
    output: removeProjectMemberOutputSchema,
  },
  'projects.definitionOfDone.list': {
    input: listDefinitionOfDoneInputSchema,
    output: listDefinitionOfDoneOutputSchema,
  },
  'projects.definitionOfDone.add': {
    input: addDefinitionOfDoneItemInputSchema,
    output: definitionOfDoneChangeOutputSchema,
  },
  'projects.definitionOfDone.rename': {
    input: renameDefinitionOfDoneItemInputSchema,
    output: definitionOfDoneChangeOutputSchema,
  },
  'projects.definitionOfDone.remove': {
    input: removeDefinitionOfDoneItemInputSchema,
    output: definitionOfDoneChangeOutputSchema,
  },
  'projects.definitionOfDone.move': {
    input: moveDefinitionOfDoneItemInputSchema,
    output: definitionOfDoneChangeOutputSchema,
  },
  'tasks.listBoard': { input: listBoardInputSchema, output: listBoardOutputSchema },
  'tasks.getBoardFlow': { input: listBoardInputSchema, output: getBoardFlowOutputSchema },
  'tasks.listTeamBoard': { input: listTeamBoardInputSchema, output: listTeamBoardOutputSchema },
  'tasks.get': { input: getTaskInputSchema, output: getTaskOutputSchema },
  'tasks.create': { input: createTaskInputSchema, output: createTaskOutputSchema },
  'tasks.update': { input: taskUpdateInputSchema, output: taskUpdateOutputSchema },
  'tasks.move': { input: moveTaskInputSchema, output: moveTaskOutputSchema },
  'tasks.block': { input: blockTaskInputSchema, output: blockTaskOutputSchema },
  'tasks.unblock': { input: unblockTaskInputSchema, output: unblockTaskOutputSchema },
  'tasks.checklist.add': {
    input: addChecklistItemInputSchema,
    output: checklistChangeOutputSchema,
  },
  'tasks.checklist.toggle': {
    input: toggleChecklistItemInputSchema,
    output: checklistChangeOutputSchema,
  },
  'tasks.checklist.rename': {
    input: renameChecklistItemInputSchema,
    output: checklistChangeOutputSchema,
  },
  'tasks.checklist.remove': {
    input: removeChecklistItemInputSchema,
    output: checklistChangeOutputSchema,
  },
  'tasks.checklist.move': {
    input: moveChecklistItemInputSchema,
    output: checklistChangeOutputSchema,
  },
  'tasks.comments.add': {
    input: addTaskCommentInputSchema,
    output: addTaskCommentOutputSchema,
  },
  'tasks.comments.edit': {
    input: editTaskCommentInputSchema,
    output: editTaskCommentOutputSchema,
  },
  'tasks.comments.remove': {
    input: removeTaskCommentInputSchema,
    output: removeTaskCommentOutputSchema,
  },
  'tasks.listRecent': { input: listRecentTasksInputSchema, output: listRecentTasksOutputSchema },
  'tasks.listFrequent': {
    input: listFrequentTasksInputSchema,
    output: listFrequentTasksOutputSchema,
  },
  'tasks.search': { input: searchTasksInputSchema, output: searchTasksOutputSchema },
  'tasks.recordOpen': { input: recordTaskOpenInputSchema, output: recordTaskOpenOutputSchema },
  'participations.add': {
    input: addParticipationInputSchema,
    output: addParticipationOutputSchema,
  },
  'participations.remove': {
    input: removeParticipationInputSchema,
    output: removeParticipationOutputSchema,
  },
  'participations.setHours': {
    input: setParticipationHoursInputSchema,
    output: setParticipationHoursOutputSchema,
  },
  'participations.setRate': {
    input: setParticipationRateInputSchema,
    output: setParticipationRateOutputSchema,
  },
  'contributors.list': { input: listContributorsInputSchema, output: listContributorsOutputSchema },
  'contributors.create': {
    input: createContributorInputSchema,
    output: createContributorOutputSchema,
  },
  'contributors.setDefaultRate': {
    input: setContributorDefaultRateInputSchema,
    output: setContributorDefaultRateOutputSchema,
  },
  'timeline.list': { input: listTimelineInputSchema, output: listTimelineOutputSchema },
  'dashboard.get': { input: getDashboardInputSchema, output: getDashboardOutputSchema },
  'boardSettings.get': { input: getBoardSettingsInputSchema, output: getBoardSettingsOutputSchema },
  'boardSettings.setWipLimits': {
    input: setWipLimitsInputSchema,
    output: setWipLimitsOutputSchema,
  },
  'meetings.list': { input: listMeetingsInputSchema, output: listMeetingsOutputSchema },
  'meetings.listUpcoming': {
    input: listUpcomingMeetingsInputSchema,
    output: listUpcomingMeetingsOutputSchema,
  },
  'meetings.create': { input: createMeetingInputSchema, output: createMeetingOutputSchema },
  'meetings.update': { input: updateMeetingInputSchema, output: updateMeetingOutputSchema },
  'meetings.delete': { input: deleteMeetingInputSchema, output: deleteMeetingOutputSchema },
  'meetings.retroActions.list': {
    input: listRetroActionsInputSchema,
    output: listRetroActionsOutputSchema,
  },
  'meetings.retroActions.add': {
    input: addRetroActionInputSchema,
    output: addRetroActionOutputSchema,
  },
  'meetings.retroActions.update': {
    input: updateRetroActionInputSchema,
    output: updateRetroActionOutputSchema,
  },
  'meetings.retroActions.toggle': {
    input: toggleRetroActionInputSchema,
    output: toggleRetroActionOutputSchema,
  },
  'meetings.retroActions.remove': {
    input: removeRetroActionInputSchema,
    output: removeRetroActionOutputSchema,
  },
} satisfies Record<ApiChannel, SchemaPair>

type Method<Channel extends ApiChannel> =
  z.input<(typeof API_SCHEMA_REGISTRY)[Channel]['input']> extends undefined
    ? () => Promise<z.output<(typeof API_SCHEMA_REGISTRY)[Channel]['output']>>
    : (
        input: z.input<(typeof API_SCHEMA_REGISTRY)[Channel]['input']>,
      ) => Promise<z.output<(typeof API_SCHEMA_REGISTRY)[Channel]['output']>>

export interface AgileBoxApi {
  session: {
    getCurrent: Method<'session.getCurrent'>
    switchUser: Method<'session.switchUser'>
    listUsers: Method<'session.listUsers'>
  }
  users: { setDefaultRate: Method<'users.setDefaultRate'> }
  projects: {
    list: Method<'projects.list'>
    create: Method<'projects.create'>
    listMembers: Method<'projects.listMembers'>
    addMember: Method<'projects.addMember'>
    removeMember: Method<'projects.removeMember'>
    definitionOfDone: {
      list: Method<'projects.definitionOfDone.list'>
      add: Method<'projects.definitionOfDone.add'>
      rename: Method<'projects.definitionOfDone.rename'>
      remove: Method<'projects.definitionOfDone.remove'>
      move: Method<'projects.definitionOfDone.move'>
    }
  }
  tasks: {
    getBoardFlow: Method<'tasks.getBoardFlow'>
    listBoard: Method<'tasks.listBoard'>
    listTeamBoard: Method<'tasks.listTeamBoard'>
    get: Method<'tasks.get'>
    create: Method<'tasks.create'>
    update: Method<'tasks.update'>
    move: Method<'tasks.move'>
    block: Method<'tasks.block'>
    unblock: Method<'tasks.unblock'>
    checklist: {
      add: Method<'tasks.checklist.add'>
      toggle: Method<'tasks.checklist.toggle'>
      rename: Method<'tasks.checklist.rename'>
      remove: Method<'tasks.checklist.remove'>
      move: Method<'tasks.checklist.move'>
    }
    comments: {
      add: Method<'tasks.comments.add'>
      edit: Method<'tasks.comments.edit'>
      remove: Method<'tasks.comments.remove'>
    }
    listRecent: Method<'tasks.listRecent'>
    listFrequent: Method<'tasks.listFrequent'>
    search: Method<'tasks.search'>
    recordOpen: Method<'tasks.recordOpen'>
  }
  participations: {
    add: Method<'participations.add'>
    remove: Method<'participations.remove'>
    setHours: Method<'participations.setHours'>
    setRate: Method<'participations.setRate'>
  }
  contributors: {
    list: Method<'contributors.list'>
    create: Method<'contributors.create'>
    setDefaultRate: Method<'contributors.setDefaultRate'>
  }
  timeline: { list: Method<'timeline.list'> }
  dashboard: { get: Method<'dashboard.get'> }
  boardSettings: {
    get: Method<'boardSettings.get'>
    setWipLimits: Method<'boardSettings.setWipLimits'>
  }
  meetings: {
    list: Method<'meetings.list'>
    listUpcoming: Method<'meetings.listUpcoming'>
    create: Method<'meetings.create'>
    update: Method<'meetings.update'>
    delete: Method<'meetings.delete'>
    retroActions: {
      list: Method<'meetings.retroActions.list'>
      add: Method<'meetings.retroActions.add'>
      update: Method<'meetings.retroActions.update'>
      toggle: Method<'meetings.retroActions.toggle'>
      remove: Method<'meetings.retroActions.remove'>
    }
  }
  onChanges(callback: (change: ChangeEvent) => void): () => void
}

export type ApiInput<Channel extends ApiChannel> = z.input<
  (typeof API_SCHEMA_REGISTRY)[Channel]['input']
>
export type ApiOutput<Channel extends ApiChannel> = z.output<
  (typeof API_SCHEMA_REGISTRY)[Channel]['output']
>

export const agileBoxApiChannels: readonly ApiChannel[] = API_CHANNELS
