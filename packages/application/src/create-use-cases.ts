import type { AppDeps } from './deps'
import { ArchiveProject, UnarchiveProject } from './use-cases/projects/archive-project'
import { RenameProject } from './use-cases/projects/rename-project'
import { CreateProject } from './use-cases/projects/create-project'
import { ListProjects } from './use-cases/projects/list-projects'
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
import {
  ArchiveTask,
  CreateTask,
  GetTaskDetail,
  MoveTask,
  UnarchiveTask,
  UpdateTask,
} from './use-cases/tasks/tasks'
import {
  AddCriterion,
  EditCriterion,
  ListTaskCriteria,
  RemoveCriterion,
  ReorderCriterion,
  SetCriterionDone,
} from './use-cases/tasks/acceptance'
import { SetTaskEstimate } from './use-cases/tasks/estimate'
import {
  GetBoardFlow,
  ListArchivedTasks,
  ListBoard,
  ListFrequentTasks,
  ListRecentTasks,
  ListTeamBoard,
  RecordTaskOpen,
  SearchTasks,
} from './use-cases/tasks/list-tasks'
import {
  ListBacklog,
  ReorderBacklog,
  SendToBacklog,
  TakeToBoard,
} from './use-cases/backlog/backlog'
import {
  AddParticipation,
  RemoveParticipation,
  SetParticipationHours,
  SetParticipationRate,
} from './use-cases/participations/participations'
import { GetDashboard } from './use-cases/dashboard/get-dashboard'
import { ListTimeline } from './use-cases/timeline/list-timeline'
import {
  ChangeTeamModules,
  FinishTeamModuleWindingDown,
  GetTeamModules,
  PreviewTeamModuleImpact,
} from './use-cases/team-modules/team-modules'
import {
  GetTeamCapabilities,
  GetTeamLevel,
  SetTeamLevel,
} from './use-cases/team-settings/team-settings'
import {
  CreateMeeting,
  DeleteMeeting,
  ListMonthMeetings,
  ListUpcomingMeetings,
  UpdateMeeting,
} from './use-cases/meetings/meetings'

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
      listProjects: new ListProjects(deps.projects),
      createProject: new CreateProject(deps),
      listMembers: new ListProjectMembers(deps),
      addMember: new AddProjectMember(deps),
      removeMember: new RemoveProjectMember(deps),
      archiveProject: new ArchiveProject(deps),
      unarchiveProject: new UnarchiveProject(deps),
      renameProject: new RenameProject(deps),
    },
    tasks: {
      create: new CreateTask(deps),
      getDetail: new GetTaskDetail(deps),
      update: new UpdateTask(deps),
      move: new MoveTask(deps),
      archive: new ArchiveTask(deps),
      unarchive: new UnarchiveTask(deps),
      listBoard: new ListBoard(deps),
      getBoardFlow: new GetBoardFlow(deps),
      listTeamBoard: new ListTeamBoard(deps),
      listArchived: new ListArchivedTasks(deps),
      listRecent: new ListRecentTasks(deps),
      listFrequent: new ListFrequentTasks(deps),
      search: new SearchTasks(deps),
      recordOpen: new RecordTaskOpen(deps),
    },
    acceptance: {
      list: new ListTaskCriteria(deps),
      add: new AddCriterion(deps),
      edit: new EditCriterion(deps),
      setDone: new SetCriterionDone(deps),
      remove: new RemoveCriterion(deps),
      reorder: new ReorderCriterion(deps),
    },
    estimates: {
      set: new SetTaskEstimate(deps),
    },
    backlog: {
      list: new ListBacklog(deps),
      reorder: new ReorderBacklog(deps),
      takeToBoard: new TakeToBoard(deps),
      sendToBacklog: new SendToBacklog(deps),
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
    },
    teamModules: {
      get: new GetTeamModules(deps),
      change: new ChangeTeamModules(deps),
      previewImpact: new PreviewTeamModuleImpact(deps),
      finishWindingDown: new FinishTeamModuleWindingDown(deps),
      capabilities: new GetTeamCapabilities(deps),
    },
    teamSettings: {
      getLevel: new GetTeamLevel(deps),
      setLevel: new SetTeamLevel(deps),
    },
    meetings: {
      listMonth: new ListMonthMeetings(deps),
      listUpcoming: new ListUpcomingMeetings(deps),
      create: new CreateMeeting(deps),
      update: new UpdateMeeting(deps),
      delete: new DeleteMeeting(deps),
    },
  }
}
