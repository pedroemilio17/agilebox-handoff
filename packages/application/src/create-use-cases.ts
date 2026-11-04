import type { AppDeps } from './deps'
import { CreateProject } from './use-cases/projects/create-project'
import { ListProjects } from './use-cases/projects/list-projects'
import {
  AddDefinitionOfDoneItem,
  ListDefinitionOfDone,
  MoveDefinitionOfDoneItem,
  RemoveDefinitionOfDoneItem,
  RenameDefinitionOfDoneItem,
} from './use-cases/projects/definition-of-done'
import {
  AddProjectMember,
  ListProjectMembers,
  RemoveProjectMember,
} from './use-cases/projects/project-members'
import { GetCurrentActor } from './use-cases/session/get-current-actor'
import { ListSessionUsers } from './use-cases/session/list-users'
import { SwitchUser } from './use-cases/session/switch-user'
import { SetDefaultRate } from './use-cases/users/set-default-rate'
import { ListContributors } from './use-cases/contributors/list-contributors'
import { SetContributorDefaultRate } from './use-cases/contributors/set-default-rate'
import { CreateContributor } from './use-cases/contributors/create-contributor'
import { AddTaskComment, EditTaskComment, RemoveTaskComment } from './use-cases/tasks/comments'
import { GetBoardSettings, SetWipLimits } from './use-cases/board-settings/board-settings'
import {
  AddChecklistItem,
  MoveChecklistItem,
  RemoveChecklistItem,
  RenameChecklistItem,
  ToggleChecklistItem,
} from './use-cases/tasks/checklist'
import {
  BlockTask,
  CreateTask,
  GetTaskDetail,
  MoveTask,
  UnblockTask,
  UpdateTask,
} from './use-cases/tasks/tasks'
import {
  GetBoardFlow,
  ListBoard,
  ListFrequentTasks,
  ListRecentTasks,
  ListTeamBoard,
  RecordTaskOpen,
  SearchTasks,
} from './use-cases/tasks/list-tasks'
import {
  AddParticipation,
  RemoveParticipation,
  SetParticipationHours,
  SetParticipationRate,
} from './use-cases/participations/participations'
import { GetDashboard } from './use-cases/dashboard/get-dashboard'
import { ExportDashboardSummary } from './use-cases/dashboard/export-summary'
import { ListTimeline } from './use-cases/timeline/list-timeline'
import {
  CreateMeeting,
  DeleteMeeting,
  ListMeetingOccurrences,
  ListUpcomingMeetings,
  UpdateMeeting,
} from './use-cases/meetings/meetings'
import {
  AddRetroAction,
  ListRetroActions,
  RemoveRetroAction,
  ToggleRetroAction,
  UpdateRetroAction,
} from './use-cases/meetings/retro-actions'

export function createUseCases(deps: AppDeps) {
  return {
    session: {
      getCurrentActor: new GetCurrentActor(deps.actorSession),
      switchUser: new SwitchUser(deps.actorSession, deps.users, deps.changeNotifier),
      listUsers: new ListSessionUsers(deps.users),
    },
    users: {
      setDefaultRate: new SetDefaultRate(deps),
    },
    contributors: {
      list: new ListContributors(deps.contributors),
      create: new CreateContributor(deps),
      setDefaultRate: new SetContributorDefaultRate(deps),
    },
    projects: {
      listProjects: new ListProjects(deps.projects, deps.definitionOfDone),
      createProject: new CreateProject(deps),
      listMembers: new ListProjectMembers(deps),
      addMember: new AddProjectMember(deps),
      removeMember: new RemoveProjectMember(deps),
      definitionOfDone: {
        list: new ListDefinitionOfDone(deps),
        add: new AddDefinitionOfDoneItem(deps),
        rename: new RenameDefinitionOfDoneItem(deps),
        remove: new RemoveDefinitionOfDoneItem(deps),
        move: new MoveDefinitionOfDoneItem(deps),
      },
    },
    tasks: {
      create: new CreateTask(deps),
      getDetail: new GetTaskDetail(deps),
      update: new UpdateTask(deps),
      move: new MoveTask(deps),
      block: new BlockTask(deps),
      unblock: new UnblockTask(deps),
      checklist: {
        add: new AddChecklistItem(deps),
        toggle: new ToggleChecklistItem(deps),
        rename: new RenameChecklistItem(deps),
        remove: new RemoveChecklistItem(deps),
        move: new MoveChecklistItem(deps),
      },
      comments: {
        add: new AddTaskComment(deps),
        edit: new EditTaskComment(deps),
        remove: new RemoveTaskComment(deps),
      },
      listBoard: new ListBoard(deps),
      getBoardFlow: new GetBoardFlow(deps),
      listTeamBoard: new ListTeamBoard(deps),
      listRecent: new ListRecentTasks(deps),
      listFrequent: new ListFrequentTasks(deps),
      search: new SearchTasks(deps),
      recordOpen: new RecordTaskOpen(deps),
    },
    participations: {
      add: new AddParticipation(deps),
      remove: new RemoveParticipation(deps),
      setHours: new SetParticipationHours(deps),
      setRate: new SetParticipationRate(deps),
    },
    timeline: {
      list: new ListTimeline(deps),
    },
    dashboard: {
      get: new GetDashboard(deps),
      exportSummary: new ExportDashboardSummary(deps),
    },
    boardSettings: {
      get: new GetBoardSettings(deps),
      setWipLimits: new SetWipLimits(deps),
    },
    meetings: {
      listRange: new ListMeetingOccurrences(deps),
      listUpcoming: new ListUpcomingMeetings(deps),
      create: new CreateMeeting(deps),
      update: new UpdateMeeting(deps),
      delete: new DeleteMeeting(deps),
      retroActions: {
        list: new ListRetroActions(deps),
        add: new AddRetroAction(deps),
        update: new UpdateRetroAction(deps),
        toggle: new ToggleRetroAction(deps),
        remove: new RemoveRetroAction(deps),
      },
    },
  }
}
