import type { Actor } from '@agilebox/core'
import type { AppDeps } from './deps'
import { assertTenantContext } from './tenant-context'
import type { TenantContext } from './tenant-context'
import { CreateProject } from './use-cases/projects/create-project'
import { ArchiveProject, UnarchiveProject } from './use-cases/projects/archive-projects'
import { RenameProject } from './use-cases/projects/rename-project'
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
  ArchiveTask,
  BlockTask,
  CreateTask,
  GetTaskDetail,
  MoveTask,
  UnarchiveTask,
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
  GetDailyForUser,
  GetTodayDaily,
  ListDailyForDate,
  SaveDaily,
} from './use-cases/daily/daily'
import {
  AddRetroAction,
  ListRetroActions,
  RemoveRetroAction,
  ToggleRetroAction,
  UpdateRetroAction,
} from './use-cases/meetings/retro-actions'

/**
 * Expõe um caso de uso que recebe o `Actor` só pelo contexto da fronteira: sem `TenantContext`,
 * a chamada nem chega ao caso de uso.
 */
function forTenant<Input extends unknown[], Output>(useCase: {
  execute(actor: Actor, ...args: Input): Output
}) {
  return {
    execute(context: TenantContext, ...args: Input): Output {
      assertTenantContext(context)
      return useCase.execute(context.actor, ...args)
    },
  }
}

export function createUseCases(deps: AppDeps) {
  return {
    // Exceção: estes dois estabelecem a sessão (quem é o ator atual); não há contexto antes deles.
    session: {
      getCurrentActor: new GetCurrentActor(deps.actorSession),
      switchUser: new SwitchUser(deps.actorSession, deps.users, deps.changeNotifier),
      listUsers: forTenant(new ListSessionUsers(deps.users)),
    },
    users: {
      setDefaultRate: forTenant(new SetDefaultRate(deps)),
    },
    contributors: {
      list: forTenant(new ListContributors(deps.contributors)),
      create: forTenant(new CreateContributor(deps)),
      setDefaultRate: forTenant(new SetContributorDefaultRate(deps)),
    },
    projects: {
      listProjects: forTenant(new ListProjects(deps.projects, deps.definitionOfDone)),
      createProject: forTenant(new CreateProject(deps)),
      listMembers: forTenant(new ListProjectMembers(deps)),
      addMember: forTenant(new AddProjectMember(deps)),
      removeMember: forTenant(new RemoveProjectMember(deps)),
      archive: forTenant(new ArchiveProject(deps)),
      unarchive: forTenant(new UnarchiveProject(deps)),
      rename: forTenant(new RenameProject(deps)),
      definitionOfDone: {
        list: forTenant(new ListDefinitionOfDone(deps)),
        add: forTenant(new AddDefinitionOfDoneItem(deps)),
        rename: forTenant(new RenameDefinitionOfDoneItem(deps)),
        remove: forTenant(new RemoveDefinitionOfDoneItem(deps)),
        move: forTenant(new MoveDefinitionOfDoneItem(deps)),
      },
    },
    tasks: {
      create: forTenant(new CreateTask(deps)),
      getDetail: forTenant(new GetTaskDetail(deps)),
      update: forTenant(new UpdateTask(deps)),
      move: forTenant(new MoveTask(deps)),
      block: forTenant(new BlockTask(deps)),
      unblock: forTenant(new UnblockTask(deps)),
      archive: forTenant(new ArchiveTask(deps)),
      unarchive: forTenant(new UnarchiveTask(deps)),
      checklist: {
        add: forTenant(new AddChecklistItem(deps)),
        toggle: forTenant(new ToggleChecklistItem(deps)),
        rename: forTenant(new RenameChecklistItem(deps)),
        remove: forTenant(new RemoveChecklistItem(deps)),
        move: forTenant(new MoveChecklistItem(deps)),
      },
      comments: {
        add: forTenant(new AddTaskComment(deps)),
        edit: forTenant(new EditTaskComment(deps)),
        remove: forTenant(new RemoveTaskComment(deps)),
      },
      listBoard: forTenant(new ListBoard(deps)),
      getBoardFlow: forTenant(new GetBoardFlow(deps)),
      listTeamBoard: forTenant(new ListTeamBoard(deps)),
      listRecent: forTenant(new ListRecentTasks(deps)),
      listFrequent: forTenant(new ListFrequentTasks(deps)),
      search: forTenant(new SearchTasks(deps)),
      recordOpen: forTenant(new RecordTaskOpen(deps)),
    },
    participations: {
      add: forTenant(new AddParticipation(deps)),
      remove: forTenant(new RemoveParticipation(deps)),
      setHours: forTenant(new SetParticipationHours(deps)),
      setRate: forTenant(new SetParticipationRate(deps)),
    },
    timeline: {
      list: forTenant(new ListTimeline(deps)),
    },
    dashboard: {
      get: forTenant(new GetDashboard(deps)),
      exportSummary: forTenant(new ExportDashboardSummary(deps)),
    },
    boardSettings: {
      get: forTenant(new GetBoardSettings(deps)),
      setWipLimits: forTenant(new SetWipLimits(deps)),
    },
    daily: {
      getToday: forTenant(new GetTodayDaily(deps)),
      save: forTenant(new SaveDaily(deps)),
      listForDate: forTenant(new ListDailyForDate(deps)),
      getForUser: forTenant(new GetDailyForUser(deps)),
    },
    meetings: {
      listRange: forTenant(new ListMeetingOccurrences(deps)),
      listUpcoming: forTenant(new ListUpcomingMeetings(deps)),
      create: forTenant(new CreateMeeting(deps)),
      update: forTenant(new UpdateMeeting(deps)),
      delete: forTenant(new DeleteMeeting(deps)),
      retroActions: {
        list: forTenant(new ListRetroActions(deps)),
        add: forTenant(new AddRetroAction(deps)),
        update: forTenant(new UpdateRetroAction(deps)),
        toggle: forTenant(new ToggleRetroAction(deps)),
        remove: forTenant(new RemoveRetroAction(deps)),
      },
    },
  }
}
