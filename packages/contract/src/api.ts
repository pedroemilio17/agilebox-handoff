import type { z } from 'zod'
import type { ChangeEvent } from './changes'
import {
  addAcceptanceCriterionInputSchema,
  moveAcceptanceCriterionInputSchema,
  removeAcceptanceCriterionInputSchema,
  renameAcceptanceCriterionInputSchema,
  toggleAcceptanceCriterionInputSchema,
} from './acceptance'
import {
  addProjectMemberInputSchema,
  addProjectMemberOutputSchema,
  createProjectInputSchema,
  createProjectOutputSchema,
  createProjectWithSetupInputSchema,
  createProjectWithSetupOutputSchema,
  listProjectMembersInputSchema,
  listProjectMembersOutputSchema,
  listProjectsInputSchema,
  listProjectsOutputSchema,
  removeProjectMemberInputSchema,
  removeProjectMemberOutputSchema,
  archiveProjectInputSchema,
  archiveProjectOutputSchema,
  unarchiveProjectInputSchema,
  unarchiveProjectOutputSchema,
  renameProjectInputSchema,
  renameProjectOutputSchema,
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
  archiveTaskInputSchema,
  archiveTaskOutputSchema,
  unarchiveTaskInputSchema,
  unarchiveTaskOutputSchema,
  checklistChangeOutputSchema,
  criteriaChangeOutputSchema,
  setTaskEstimateInputSchema,
  setTaskEstimateOutputSchema,
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
import {
  exportDashboardSummaryInputSchema,
  exportDashboardSummaryOutputSchema,
  getDashboardInputSchema,
  getDashboardOutputSchema,
  saveDashboardSummaryInputSchema,
  saveDashboardSummaryOutputSchema,
} from './dashboard'
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
import {
  getDailyForUserInputSchema,
  getDailyForUserOutputSchema,
  getTodayDailyInputSchema,
  getTodayDailyOutputSchema,
  listDailyForDateInputSchema,
  listDailyForDateOutputSchema,
  saveDailyInputSchema,
  saveDailyOutputSchema,
  suggestDailySummaryInputSchema,
  suggestDailySummaryOutputSchema,
} from './daily'
import { setDefaultRateInputSchema, setDefaultRateOutputSchema } from './users'
import {
  applyTeamPresetInputSchema,
  completeTeamWindDownInputSchema,
  getTeamToolsInputSchema,
  previewTeamToolsChangeInputSchema,
  setModuleConfigInputSchema,
  setTeamLevelInputSchema,
  teamToolsChangeInputSchema,
  teamToolsChangeResultDtoSchema,
  teamToolsPreviewDtoSchema,
  teamToolsViewDtoSchema,
} from './team-tools'
import {
  changeProjectModulesInputSchema,
  getProjectModulesInputSchema,
  projectModulesChangeResultDtoSchema,
  projectModulesViewDtoSchema,
} from './project-modules'
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
  addToBacklogInputSchema,
  addToBacklogOutputSchema,
  listBacklogInputSchema,
  listBacklogOutputSchema,
  pullFromBacklogInputSchema,
  pullFromBacklogOutputSchema,
  reorderBacklogInputSchema,
  reorderBacklogOutputSchema,
  sendToBacklogInputSchema,
  sendToBacklogOutputSchema,
} from './backlog'
import {
  addSprintTaskInputSchema,
  addSprintTaskOutputSchema,
  closeSprintInputSchema,
  closeSprintOutputSchema,
  createSprintInputSchema,
  createSprintOutputSchema,
  discardSprintInputSchema,
  discardSprintOutputSchema,
  getSprintInputSchema,
  getSprintOutputSchema,
  listSprintsInputSchema,
  listSprintsOutputSchema,
  removeSprintTaskInputSchema,
  removeSprintTaskOutputSchema,
  startSprintInputSchema,
  startSprintOutputSchema,
  updateSprintInputSchema,
  updateSprintOutputSchema,
} from './sprints'
import {
  assignImpedimentInputSchema,
  assignImpedimentOutputSchema,
  listImpedimentsInputSchema,
  listImpedimentsOutputSchema,
  resolveImpedimentInputSchema,
  resolveImpedimentOutputSchema,
} from './impediments'
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
  'projects.createWithSetup': {
    input: createProjectWithSetupInputSchema,
    output: createProjectWithSetupOutputSchema,
  },
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
  'projects.archive': { input: archiveProjectInputSchema, output: archiveProjectOutputSchema },
  'projects.unarchive': {
    input: unarchiveProjectInputSchema,
    output: unarchiveProjectOutputSchema,
  },
  'projects.rename': { input: renameProjectInputSchema, output: renameProjectOutputSchema },
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
  'impediments.list': { input: listImpedimentsInputSchema, output: listImpedimentsOutputSchema },
  'impediments.assign': {
    input: assignImpedimentInputSchema,
    output: assignImpedimentOutputSchema,
  },
  'impediments.resolve': {
    input: resolveImpedimentInputSchema,
    output: resolveImpedimentOutputSchema,
  },
  'tasks.archive': { input: archiveTaskInputSchema, output: archiveTaskOutputSchema },
  'tasks.unarchive': { input: unarchiveTaskInputSchema, output: unarchiveTaskOutputSchema },
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
  'tasks.setEstimate': {
    input: setTaskEstimateInputSchema,
    output: setTaskEstimateOutputSchema,
  },
  'tasks.criteria.add': {
    input: addAcceptanceCriterionInputSchema,
    output: criteriaChangeOutputSchema,
  },
  'tasks.criteria.toggle': {
    input: toggleAcceptanceCriterionInputSchema,
    output: criteriaChangeOutputSchema,
  },
  'tasks.criteria.rename': {
    input: renameAcceptanceCriterionInputSchema,
    output: criteriaChangeOutputSchema,
  },
  'tasks.criteria.remove': {
    input: removeAcceptanceCriterionInputSchema,
    output: criteriaChangeOutputSchema,
  },
  'tasks.criteria.move': {
    input: moveAcceptanceCriterionInputSchema,
    output: criteriaChangeOutputSchema,
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
  'backlog.list': { input: listBacklogInputSchema, output: listBacklogOutputSchema },
  'backlog.add': { input: addToBacklogInputSchema, output: addToBacklogOutputSchema },
  'backlog.reorder': { input: reorderBacklogInputSchema, output: reorderBacklogOutputSchema },
  'backlog.pull': { input: pullFromBacklogInputSchema, output: pullFromBacklogOutputSchema },
  'backlog.sendBack': { input: sendToBacklogInputSchema, output: sendToBacklogOutputSchema },
  'sprints.list': { input: listSprintsInputSchema, output: listSprintsOutputSchema },
  'sprints.get': { input: getSprintInputSchema, output: getSprintOutputSchema },
  'sprints.create': { input: createSprintInputSchema, output: createSprintOutputSchema },
  'sprints.update': { input: updateSprintInputSchema, output: updateSprintOutputSchema },
  'sprints.start': { input: startSprintInputSchema, output: startSprintOutputSchema },
  'sprints.close': { input: closeSprintInputSchema, output: closeSprintOutputSchema },
  'sprints.discard': { input: discardSprintInputSchema, output: discardSprintOutputSchema },
  'sprints.addTask': { input: addSprintTaskInputSchema, output: addSprintTaskOutputSchema },
  'sprints.removeTask': {
    input: removeSprintTaskInputSchema,
    output: removeSprintTaskOutputSchema,
  },
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
  'dashboard.exportSummary': {
    input: exportDashboardSummaryInputSchema,
    output: exportDashboardSummaryOutputSchema,
  },
  'dashboard.saveSummary': {
    input: saveDashboardSummaryInputSchema,
    output: saveDashboardSummaryOutputSchema,
  },
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
  'daily.getToday': { input: getTodayDailyInputSchema, output: getTodayDailyOutputSchema },
  'daily.save': { input: saveDailyInputSchema, output: saveDailyOutputSchema },
  'daily.listForDate': { input: listDailyForDateInputSchema, output: listDailyForDateOutputSchema },
  'daily.getForUser': { input: getDailyForUserInputSchema, output: getDailyForUserOutputSchema },
  'daily.suggestSummary': {
    input: suggestDailySummaryInputSchema,
    output: suggestDailySummaryOutputSchema,
  },
  'projectModules.get': {
    input: getProjectModulesInputSchema,
    output: projectModulesViewDtoSchema,
  },
  'projectModules.change': {
    input: changeProjectModulesInputSchema,
    output: projectModulesChangeResultDtoSchema,
  },
  'teamTools.get': { input: getTeamToolsInputSchema, output: teamToolsViewDtoSchema },
  'teamTools.previewChange': {
    input: previewTeamToolsChangeInputSchema,
    output: teamToolsPreviewDtoSchema,
  },
  'teamTools.applyChange': {
    input: teamToolsChangeInputSchema,
    output: teamToolsChangeResultDtoSchema,
  },
  'teamTools.completeWindDown': {
    input: completeTeamWindDownInputSchema,
    output: teamToolsChangeResultDtoSchema,
  },
  'teamTools.setLevel': { input: setTeamLevelInputSchema, output: teamToolsChangeResultDtoSchema },
  'teamTools.applyPreset': {
    input: applyTeamPresetInputSchema,
    output: teamToolsChangeResultDtoSchema,
  },
  'teamTools.setModuleConfig': {
    input: setModuleConfigInputSchema,
    output: teamToolsViewDtoSchema,
  },
} satisfies Record<ApiChannel, SchemaPair>

type Method<Channel extends ApiChannel> =
  z.input<(typeof API_SCHEMA_REGISTRY)[Channel]['input']> extends undefined
    ? () => Promise<z.output<(typeof API_SCHEMA_REGISTRY)[Channel]['output']>>
    : undefined extends z.input<(typeof API_SCHEMA_REGISTRY)[Channel]['input']>
      ? (
          input?: z.input<(typeof API_SCHEMA_REGISTRY)[Channel]['input']>,
        ) => Promise<z.output<(typeof API_SCHEMA_REGISTRY)[Channel]['output']>>
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
    createWithSetup: Method<'projects.createWithSetup'>
    listMembers: Method<'projects.listMembers'>
    addMember: Method<'projects.addMember'>
    removeMember: Method<'projects.removeMember'>
    archive: Method<'projects.archive'>
    unarchive: Method<'projects.unarchive'>
    rename: Method<'projects.rename'>
    definitionOfDone: {
      list: Method<'projects.definitionOfDone.list'>
      add: Method<'projects.definitionOfDone.add'>
      rename: Method<'projects.definitionOfDone.rename'>
      remove: Method<'projects.definitionOfDone.remove'>
      move: Method<'projects.definitionOfDone.move'>
    }
  }
  projectModules: {
    get: Method<'projectModules.get'>
    change: Method<'projectModules.change'>
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
    archive: Method<'tasks.archive'>
    unarchive: Method<'tasks.unarchive'>
    setEstimate: Method<'tasks.setEstimate'>
    criteria: {
      add: Method<'tasks.criteria.add'>
      toggle: Method<'tasks.criteria.toggle'>
      rename: Method<'tasks.criteria.rename'>
      remove: Method<'tasks.criteria.remove'>
      move: Method<'tasks.criteria.move'>
    }
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
  dashboard: {
    get: Method<'dashboard.get'>
    exportSummary: Method<'dashboard.exportSummary'>
    saveSummary: Method<'dashboard.saveSummary'>
  }
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
  daily: {
    getToday: Method<'daily.getToday'>
    save: Method<'daily.save'>
    listForDate: Method<'daily.listForDate'>
    getForUser: Method<'daily.getForUser'>
    suggestSummary: Method<'daily.suggestSummary'>
  }
  impediments: {
    list: Method<'impediments.list'>
    assign: Method<'impediments.assign'>
    resolve: Method<'impediments.resolve'>
  }
  sprints: {
    list: Method<'sprints.list'>
    get: Method<'sprints.get'>
    create: Method<'sprints.create'>
    update: Method<'sprints.update'>
    start: Method<'sprints.start'>
    close: Method<'sprints.close'>
    discard: Method<'sprints.discard'>
    addTask: Method<'sprints.addTask'>
    removeTask: Method<'sprints.removeTask'>
  }
  backlog: {
    list: Method<'backlog.list'>
    add: Method<'backlog.add'>
    reorder: Method<'backlog.reorder'>
    pull: Method<'backlog.pull'>
    sendBack: Method<'backlog.sendBack'>
  }
  teamTools: {
    get: Method<'teamTools.get'>
    previewChange: Method<'teamTools.previewChange'>
    applyChange: Method<'teamTools.applyChange'>
    completeWindDown: Method<'teamTools.completeWindDown'>
    setLevel: Method<'teamTools.setLevel'>
    applyPreset: Method<'teamTools.applyPreset'>
    setModuleConfig: Method<'teamTools.setModuleConfig'>
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
