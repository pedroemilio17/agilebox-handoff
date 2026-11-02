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
  createMeetingInputSchema,
  createMeetingOutputSchema,
  deleteMeetingInputSchema,
  deleteMeetingOutputSchema,
  listMeetingsInputSchema,
  listMeetingsOutputSchema,
  listUpcomingMeetingsInputSchema,
  listUpcomingMeetingsOutputSchema,
  updateMeetingInputSchema,
  updateMeetingOutputSchema,
} from './meetings'
import { setDefaultRateInputSchema, setDefaultRateOutputSchema } from './users'
import {
  getCurrentSessionInputSchema,
  getCurrentSessionOutputSchema,
  listSessionUsersInputSchema,
  listSessionUsersOutputSchema,
  switchUserInputSchema,
  switchUserOutputSchema,
} from './session'
import { API_CHANNELS, type ApiChannel } from './channels'

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
  'tasks.listBoard': { input: listBoardInputSchema, output: listBoardOutputSchema },
  'tasks.getBoardFlow': { input: listBoardInputSchema, output: getBoardFlowOutputSchema },
  'tasks.listTeamBoard': { input: listTeamBoardInputSchema, output: listTeamBoardOutputSchema },
  'tasks.get': { input: getTaskInputSchema, output: getTaskOutputSchema },
  'tasks.create': { input: createTaskInputSchema, output: createTaskOutputSchema },
  'tasks.update': { input: taskUpdateInputSchema, output: taskUpdateOutputSchema },
  'tasks.move': { input: moveTaskInputSchema, output: moveTaskOutputSchema },
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
  'meetings.list': { input: listMeetingsInputSchema, output: listMeetingsOutputSchema },
  'meetings.listUpcoming': {
    input: listUpcomingMeetingsInputSchema,
    output: listUpcomingMeetingsOutputSchema,
  },
  'meetings.create': { input: createMeetingInputSchema, output: createMeetingOutputSchema },
  'meetings.update': { input: updateMeetingInputSchema, output: updateMeetingOutputSchema },
  'meetings.delete': { input: deleteMeetingInputSchema, output: deleteMeetingOutputSchema },
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
  }
  tasks: {
    getBoardFlow: Method<'tasks.getBoardFlow'>
    listBoard: Method<'tasks.listBoard'>
    listTeamBoard: Method<'tasks.listTeamBoard'>
    get: Method<'tasks.get'>
    create: Method<'tasks.create'>
    update: Method<'tasks.update'>
    move: Method<'tasks.move'>
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
  meetings: {
    list: Method<'meetings.list'>
    listUpcoming: Method<'meetings.listUpcoming'>
    create: Method<'meetings.create'>
    update: Method<'meetings.update'>
    delete: Method<'meetings.delete'>
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
