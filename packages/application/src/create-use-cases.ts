import type { Actor } from '@agilebox/core'
import type { AppDeps } from './deps'
import { assertProjectModuleUsable, USE_CASE_MODULES } from './module-guard'
import { GetTracking } from './use-cases/tracking/tracking'
import { GetBaseline, TakeBaseline } from './use-cases/baseline/baseline'
import { GetBurndown } from './use-cases/burndown/burndown'
import { GetFlowMetrics } from './use-cases/flow-metrics/flow-metrics'
import type { ModuleGuardPorts, ModuleUsePolicy, UseCasePath } from './module-guard'
import { assertTenantContext } from './tenant-context'
import type { TenantContext } from './tenant-context'
import {
  ApplyTeamPreset,
  ApplyTeamToolsChange,
  CompleteTeamWindDown,
  GetTeamTools,
  PreviewTeamToolsChange,
  SetTeamLevel,
  SetTeamModuleConfig,
} from './use-cases/team-tools/team-tools'
import {
  ChangeProjectModules,
  SetProjectModuleConfig,
  GetOrganizationModules,
  GetProjectModules,
} from './use-cases/project-modules/project-modules'
import { DismissGuideCard, GetGuide, ResolveWelcome } from './use-cases/guide/guide'
import {
  CreateDeliverable,
  GetWbs,
  MoveDeliverable,
  RemoveDeliverable,
  RenameDeliverable,
} from './use-cases/wbs/wbs'
import {
  CreateMilestone,
  ListMilestones,
  RemoveMilestone,
  UpdateMilestone,
} from './use-cases/milestones/milestones'
import { CreateRisk, ListRisks, RemoveRisk, UpdateRisk } from './use-cases/risks/risks'
import {
  AddTaskDependency,
  GetSchedule,
  RemoveTaskDependency,
  SetTaskStart,
} from './use-cases/schedule/schedule'
import {
  AddSprintTask,
  CloseSprint,
  CreateSprint,
  DiscardSprint,
  GetSprint,
  ListSprints,
  RemoveSprintTask,
  StartSprint,
  UpdateSprint,
} from './use-cases/sprints/sprints'
import { CreateProject } from './use-cases/projects/create-project'
import { CreateProjectWithSetup } from './use-cases/projects/create-project-with-setup'
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
  AddAcceptanceCriterion,
  MoveAcceptanceCriterion,
  RemoveAcceptanceCriterion,
  RenameAcceptanceCriterion,
  ToggleAcceptanceCriterion,
} from './use-cases/tasks/acceptance'
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
  SetTaskDeliverable,
  SetTaskEstimate,
  UnarchiveTask,
  UnblockTask,
  UpdateTask,
} from './use-cases/tasks/tasks'
import {
  AssignImpediment,
  ListImpediments,
  ResolveImpediment,
} from './use-cases/impediments/impediments'
import {
  AddToBacklog,
  ListBacklog,
  PullFromBacklog,
  ReorderBacklogItem,
  SendToBacklog,
} from './use-cases/backlog/backlog'
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
import { SuggestDailySummary } from './use-cases/daily/suggest-summary'
import {
  AddRetroAction,
  ListRetroActions,
  RemoveRetroAction,
  ToggleRetroAction,
  UpdateRetroAction,
} from './use-cases/meetings/retro-actions'

/** Caso de uso que recebe o `Actor` só pelo contexto da fronteira. */
interface UseCaseLike<Input extends unknown[], Output> {
  execute(actor: Actor, ...args: Input): Output
}

/**
 * Monta a fronteira `forTenant`: exige o `TenantContext` da sessão e, depois disso, aplica o guard
 * de módulo declarado em `USE_CASE_MODULES` para o caminho do caso de uso. O caminho é tipado pelas
 * chaves do mapa, então um caso de uso novo sem declaração não compila. Os argumentos do caso de
 * uso são repassados ao guard, que acha o projeto a partir deles (ADR-10).
 */
function tenantScope(ports: ModuleGuardPorts) {
  return function forTenant<Path extends UseCasePath, Input extends unknown[], Output>(
    path: Path,
    useCase: UseCaseLike<Input, Output>,
  ) {
    const policy: ModuleUsePolicy = USE_CASE_MODULES[path]
    return {
      execute(context: TenantContext, ...args: Input): Promise<Awaited<Output>> {
        // Contexto inválido falha antes de qualquer consulta, de forma síncrona.
        assertTenantContext(context)
        return callAfterModuleGuard(ports, context, policy, args, () =>
          useCase.execute(context.actor, ...args),
        )
      },
    }
  }
}

async function callAfterModuleGuard<T>(
  ports: ModuleGuardPorts,
  context: TenantContext,
  policy: ModuleUsePolicy,
  args: readonly unknown[],
  call: () => T,
): Promise<Awaited<T>> {
  await assertProjectModuleUsable(ports, context.tenantId, policy, args)
  const result = await call()
  return result
}

export function createUseCases(deps: AppDeps) {
  const forTenant = tenantScope(deps)
  return {
    // Exceção: estes dois estabelecem a sessão (quem é o ator atual); não há contexto antes deles.
    session: {
      getCurrentActor: new GetCurrentActor(deps.actorSession),
      switchUser: new SwitchUser(deps.actorSession, deps.users, deps.changeNotifier),
      listUsers: forTenant('session.listUsers', new ListSessionUsers(deps.users)),
    },
    users: {
      setDefaultRate: forTenant('users.setDefaultRate', new SetDefaultRate(deps)),
    },
    contributors: {
      list: forTenant('contributors.list', new ListContributors(deps.contributors)),
      create: forTenant('contributors.create', new CreateContributor(deps)),
      setDefaultRate: forTenant('contributors.setDefaultRate', new SetContributorDefaultRate(deps)),
    },
    projects: {
      listProjects: forTenant(
        'projects.listProjects',
        new ListProjects(deps.projects, deps.definitionOfDone),
      ),
      createProject: forTenant('projects.createProject', new CreateProject(deps)),
      createWithSetup: forTenant('projects.createWithSetup', new CreateProjectWithSetup(deps)),
      listMembers: forTenant('projects.listMembers', new ListProjectMembers(deps)),
      addMember: forTenant('projects.addMember', new AddProjectMember(deps)),
      removeMember: forTenant('projects.removeMember', new RemoveProjectMember(deps)),
      archive: forTenant('projects.archive', new ArchiveProject(deps)),
      unarchive: forTenant('projects.unarchive', new UnarchiveProject(deps)),
      rename: forTenant('projects.rename', new RenameProject(deps)),
      definitionOfDone: {
        list: forTenant('projects.definitionOfDone.list', new ListDefinitionOfDone(deps)),
        add: forTenant('projects.definitionOfDone.add', new AddDefinitionOfDoneItem(deps)),
        rename: forTenant('projects.definitionOfDone.rename', new RenameDefinitionOfDoneItem(deps)),
        remove: forTenant('projects.definitionOfDone.remove', new RemoveDefinitionOfDoneItem(deps)),
        move: forTenant('projects.definitionOfDone.move', new MoveDefinitionOfDoneItem(deps)),
      },
    },
    tasks: {
      create: forTenant('tasks.create', new CreateTask(deps)),
      getDetail: forTenant('tasks.getDetail', new GetTaskDetail(deps)),
      update: forTenant('tasks.update', new UpdateTask(deps)),
      move: forTenant('tasks.move', new MoveTask(deps)),
      block: forTenant('tasks.block', new BlockTask(deps)),
      unblock: forTenant('tasks.unblock', new UnblockTask(deps)),
      archive: forTenant('tasks.archive', new ArchiveTask(deps)),
      unarchive: forTenant('tasks.unarchive', new UnarchiveTask(deps)),
      setEstimate: forTenant('tasks.setEstimate', new SetTaskEstimate(deps)),
      setDeliverable: forTenant('tasks.setDeliverable', new SetTaskDeliverable(deps)),
      setStart: forTenant('tasks.setStart', new SetTaskStart(deps)),
      criteria: {
        add: forTenant('tasks.criteria.add', new AddAcceptanceCriterion(deps)),
        toggle: forTenant('tasks.criteria.toggle', new ToggleAcceptanceCriterion(deps)),
        rename: forTenant('tasks.criteria.rename', new RenameAcceptanceCriterion(deps)),
        remove: forTenant('tasks.criteria.remove', new RemoveAcceptanceCriterion(deps)),
        move: forTenant('tasks.criteria.move', new MoveAcceptanceCriterion(deps)),
      },
      checklist: {
        add: forTenant('tasks.checklist.add', new AddChecklistItem(deps)),
        toggle: forTenant('tasks.checklist.toggle', new ToggleChecklistItem(deps)),
        rename: forTenant('tasks.checklist.rename', new RenameChecklistItem(deps)),
        remove: forTenant('tasks.checklist.remove', new RemoveChecklistItem(deps)),
        move: forTenant('tasks.checklist.move', new MoveChecklistItem(deps)),
      },
      comments: {
        add: forTenant('tasks.comments.add', new AddTaskComment(deps)),
        edit: forTenant('tasks.comments.edit', new EditTaskComment(deps)),
        remove: forTenant('tasks.comments.remove', new RemoveTaskComment(deps)),
      },
      listBoard: forTenant('tasks.listBoard', new ListBoard(deps)),
      getBoardFlow: forTenant('tasks.getBoardFlow', new GetBoardFlow(deps)),
      listTeamBoard: forTenant('tasks.listTeamBoard', new ListTeamBoard(deps)),
      listRecent: forTenant('tasks.listRecent', new ListRecentTasks(deps)),
      listFrequent: forTenant('tasks.listFrequent', new ListFrequentTasks(deps)),
      search: forTenant('tasks.search', new SearchTasks(deps)),
      recordOpen: forTenant('tasks.recordOpen', new RecordTaskOpen(deps)),
    },
    participations: {
      add: forTenant('participations.add', new AddParticipation(deps)),
      remove: forTenant('participations.remove', new RemoveParticipation(deps)),
      setHours: forTenant('participations.setHours', new SetParticipationHours(deps)),
      setRate: forTenant('participations.setRate', new SetParticipationRate(deps)),
    },
    timeline: {
      list: forTenant('timeline.list', new ListTimeline(deps)),
    },
    dashboard: {
      get: forTenant('dashboard.get', new GetDashboard(deps)),
      exportSummary: forTenant('dashboard.exportSummary', new ExportDashboardSummary(deps)),
    },
    boardSettings: {
      get: forTenant('boardSettings.get', new GetBoardSettings(deps)),
      setWipLimits: forTenant('boardSettings.setWipLimits', new SetWipLimits(deps)),
    },
    daily: {
      getToday: forTenant('daily.getToday', new GetTodayDaily(deps)),
      save: forTenant('daily.save', new SaveDaily(deps)),
      listForDate: forTenant('daily.listForDate', new ListDailyForDate(deps)),
      getForUser: forTenant('daily.getForUser', new GetDailyForUser(deps)),
      suggestSummary: forTenant('daily.suggestSummary', new SuggestDailySummary(deps)),
    },
    impediments: {
      list: forTenant('impediments.list', new ListImpediments(deps)),
      assign: forTenant('impediments.assign', new AssignImpediment(deps)),
      resolve: forTenant('impediments.resolve', new ResolveImpediment(deps)),
    },
    sprints: {
      list: forTenant('sprints.list', new ListSprints(deps)),
      get: forTenant('sprints.get', new GetSprint(deps)),
      create: forTenant('sprints.create', new CreateSprint(deps)),
      update: forTenant('sprints.update', new UpdateSprint(deps)),
      start: forTenant('sprints.start', new StartSprint(deps)),
      close: forTenant('sprints.close', new CloseSprint(deps)),
      discard: forTenant('sprints.discard', new DiscardSprint(deps)),
      addTask: forTenant('sprints.addTask', new AddSprintTask(deps)),
      removeTask: forTenant('sprints.removeTask', new RemoveSprintTask(deps)),
    },
    wbs: {
      get: forTenant('wbs.get', new GetWbs(deps)),
      createDeliverable: forTenant('wbs.createDeliverable', new CreateDeliverable(deps)),
      renameDeliverable: forTenant('wbs.renameDeliverable', new RenameDeliverable(deps)),
      moveDeliverable: forTenant('wbs.moveDeliverable', new MoveDeliverable(deps)),
      removeDeliverable: forTenant('wbs.removeDeliverable', new RemoveDeliverable(deps)),
    },
    schedule: {
      get: forTenant('schedule.get', new GetSchedule(deps)),
      addDependency: forTenant('schedule.addDependency', new AddTaskDependency(deps)),
      removeDependency: forTenant('schedule.removeDependency', new RemoveTaskDependency(deps)),
    },
    tracking: {
      get: forTenant('tracking.get', new GetTracking(deps)),
    },
    baseline: {
      get: forTenant('baseline.get', new GetBaseline(deps)),
      take: forTenant('baseline.take', new TakeBaseline(deps)),
    },
    burndown: {
      get: forTenant('burndown.get', new GetBurndown(deps)),
    },
    flowMetrics: {
      get: forTenant('flowMetrics.get', new GetFlowMetrics(deps)),
    },
    milestones: {
      list: forTenant('milestones.list', new ListMilestones(deps)),
      create: forTenant('milestones.create', new CreateMilestone(deps)),
      update: forTenant('milestones.update', new UpdateMilestone(deps)),
      remove: forTenant('milestones.remove', new RemoveMilestone(deps)),
    },
    risks: {
      list: forTenant('risks.list', new ListRisks(deps)),
      create: forTenant('risks.create', new CreateRisk(deps)),
      update: forTenant('risks.update', new UpdateRisk(deps)),
      remove: forTenant('risks.remove', new RemoveRisk(deps)),
    },
    backlog: {
      list: forTenant('backlog.list', new ListBacklog(deps)),
      add: forTenant('backlog.add', new AddToBacklog(deps)),
      reorder: forTenant('backlog.reorder', new ReorderBacklogItem(deps)),
      pull: forTenant('backlog.pull', new PullFromBacklog(deps)),
      sendBack: forTenant('backlog.sendBack', new SendToBacklog(deps)),
    },
    teamTools: {
      get: forTenant('teamTools.get', new GetTeamTools(deps)),
      previewChange: forTenant('teamTools.previewChange', new PreviewTeamToolsChange(deps)),
      applyChange: forTenant('teamTools.applyChange', new ApplyTeamToolsChange(deps)),
      completeWindDown: forTenant('teamTools.completeWindDown', new CompleteTeamWindDown(deps)),
      setLevel: forTenant('teamTools.setLevel', new SetTeamLevel(deps)),
      applyPreset: forTenant('teamTools.applyPreset', new ApplyTeamPreset(deps)),
      setModuleConfig: forTenant('teamTools.setModuleConfig', new SetTeamModuleConfig(deps)),
    },
    projectModules: {
      get: forTenant('projectModules.get', new GetProjectModules(deps)),
      change: forTenant('projectModules.change', new ChangeProjectModules(deps)),
      setConfig: forTenant('projectModules.setConfig', new SetProjectModuleConfig(deps)),
      getOrganization: forTenant(
        'projectModules.getOrganization',
        new GetOrganizationModules(deps),
      ),
    },
    guide: {
      get: forTenant('guide.get', new GetGuide(deps)),
      dismissCard: forTenant('guide.dismissCard', new DismissGuideCard(deps)),
      resolveWelcome: forTenant('guide.resolveWelcome', new ResolveWelcome(deps)),
    },
    meetings: {
      listRange: forTenant('meetings.listRange', new ListMeetingOccurrences(deps)),
      listUpcoming: forTenant('meetings.listUpcoming', new ListUpcomingMeetings(deps)),
      create: forTenant('meetings.create', new CreateMeeting(deps)),
      update: forTenant('meetings.update', new UpdateMeeting(deps)),
      delete: forTenant('meetings.delete', new DeleteMeeting(deps)),
      retroActions: {
        list: forTenant('meetings.retroActions.list', new ListRetroActions(deps)),
        add: forTenant('meetings.retroActions.add', new AddRetroAction(deps)),
        update: forTenant('meetings.retroActions.update', new UpdateRetroAction(deps)),
        toggle: forTenant('meetings.retroActions.toggle', new ToggleRetroAction(deps)),
        remove: forTenant('meetings.retroActions.remove', new RemoveRetroAction(deps)),
      },
    },
  }
}
