import { API_SCHEMA_REGISTRY } from '@agilebox/contract'
import type {
  ApiChannel,
  SaveDashboardSummaryInput,
  SaveDashboardSummaryOutput,
} from '@agilebox/contract'
import type { ActorSession, TenantContext } from '@agilebox/application'
import type { createUseCases } from '@agilebox/application'
import { createIpcHandler } from './handle'
import type { InputSchema } from './handle'

type UseCases = ReturnType<typeof createUseCases>
type InputFor<Channel extends ApiChannel> = ReturnType<
  (typeof API_SCHEMA_REGISTRY)[Channel]['input']['parse']
>

export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, input: unknown) => Promise<unknown>): void
}

export function registerHandlers(
  ipcMain: IpcMainLike,
  useCases: UseCases,
  actorSession: ActorSession,
  saveDashboardSummary: (
    context: TenantContext,
    input: SaveDashboardSummaryInput,
  ) => Promise<SaveDashboardSummaryOutput>,
): void {
  const register = <Channel extends ApiChannel>(
    channel: Channel,
    execute: (context: TenantContext, input: InputFor<Channel>) => unknown,
  ) => {
    ipcMain.handle(
      channel,
      createIpcHandler(
        API_SCHEMA_REGISTRY[channel].input as unknown as InputSchema<InputFor<Channel>>,
        actorSession,
        execute,
      ),
    )
  }

  register('session.getCurrent', () => useCases.session.getCurrentActor.execute())
  register('session.switchUser', (_context, input) => useCases.session.switchUser.execute(input))
  register('session.listUsers', (context) => useCases.session.listUsers.execute(context))
  register('users.setDefaultRate', (context, input) =>
    useCases.users.setDefaultRate.execute(context, input),
  )
  register('projects.list', (context, input) =>
    useCases.projects.listProjects.execute(context, input),
  )
  register('projects.create', (context, input) =>
    useCases.projects.createProject.execute(context, input),
  )
  register('projects.listMembers', (context, input) =>
    useCases.projects.listMembers.execute(context, input),
  )
  register('projects.addMember', (context, input) =>
    useCases.projects.addMember.execute(context, input),
  )
  register('projects.removeMember', (context, input) =>
    useCases.projects.removeMember.execute(context, input),
  )
  register('projects.archive', (context, input) =>
    useCases.projects.archive.execute(context, input),
  )
  register('projects.unarchive', (context, input) =>
    useCases.projects.unarchive.execute(context, input),
  )
  register('projects.rename', (context, input) => useCases.projects.rename.execute(context, input))
  register('tasks.getBoardFlow', (context, input) =>
    useCases.tasks.getBoardFlow.execute(context, {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.forUserId === undefined ? {} : { forUserId: input.forUserId }),
      ...(input.includeArchived === undefined ? {} : { includeArchived: input.includeArchived }),
    }),
  )
  register('tasks.listBoard', (context, input) =>
    useCases.tasks.listBoard.execute(context, {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.forUserId === undefined ? {} : { forUserId: input.forUserId }),
      ...(input.includeArchived === undefined ? {} : { includeArchived: input.includeArchived }),
    }),
  )
  register('tasks.listTeamBoard', (context, input) =>
    useCases.tasks.listTeamBoard.execute(context, {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.includeArchived === undefined ? {} : { includeArchived: input.includeArchived }),
    }),
  )
  register('tasks.get', (context, input) => useCases.tasks.getDetail.execute(context, input))
  register('tasks.create', (context, input) => useCases.tasks.create.execute(context, input))
  register('tasks.update', (context, input) => useCases.tasks.update.execute(context, input))
  register('tasks.move', (context, input) => useCases.tasks.move.execute(context, input))
  register('tasks.block', (context, input) => useCases.tasks.block.execute(context, input))
  register('tasks.unblock', (context, input) => useCases.tasks.unblock.execute(context, input))
  register('tasks.archive', (context, input) => useCases.tasks.archive.execute(context, input))
  register('tasks.unarchive', (context, input) => useCases.tasks.unarchive.execute(context, input))
  register('tasks.checklist.add', (context, input) =>
    useCases.tasks.checklist.add.execute(context, input),
  )
  register('tasks.checklist.toggle', (context, input) =>
    useCases.tasks.checklist.toggle.execute(context, input),
  )
  register('tasks.checklist.rename', (context, input) =>
    useCases.tasks.checklist.rename.execute(context, input),
  )
  register('tasks.checklist.remove', (context, input) =>
    useCases.tasks.checklist.remove.execute(context, input),
  )
  register('tasks.checklist.move', (context, input) =>
    useCases.tasks.checklist.move.execute(context, input),
  )
  register('tasks.comments.add', (context, input) =>
    useCases.tasks.comments.add.execute(context, input),
  )
  register('tasks.comments.edit', (context, input) =>
    useCases.tasks.comments.edit.execute(context, input),
  )
  register('tasks.comments.remove', (context, input) =>
    useCases.tasks.comments.remove.execute(context, input),
  )
  register('tasks.listRecent', (context) => useCases.tasks.listRecent.execute(context))
  register('tasks.listFrequent', (context) => useCases.tasks.listFrequent.execute(context))
  register('tasks.search', (context, input) => useCases.tasks.search.execute(context, input))
  register('tasks.recordOpen', (context, input) =>
    useCases.tasks.recordOpen.execute(context, input),
  )
  register('backlog.list', (context, input) => useCases.backlog.list.execute(context, input))
  register('backlog.add', (context, input) => useCases.backlog.add.execute(context, input))
  register('backlog.reorder', (context, input) => useCases.backlog.reorder.execute(context, input))
  register('backlog.pull', (context, input) => useCases.backlog.pull.execute(context, input))
  register('backlog.sendBack', (context, input) =>
    useCases.backlog.sendBack.execute(context, input),
  )
  register('participations.add', (context, input) =>
    useCases.participations.add.execute(context, input),
  )
  register('participations.remove', (context, input) =>
    useCases.participations.remove.execute(context, input),
  )
  register('participations.setHours', (context, input) =>
    useCases.participations.setHours.execute(context, input),
  )
  register('participations.setRate', (context, input) =>
    useCases.participations.setRate.execute(context, input),
  )
  register('projects.definitionOfDone.list', (context, input) =>
    useCases.projects.definitionOfDone.list.execute(context, input),
  )
  register('projects.definitionOfDone.add', (context, input) =>
    useCases.projects.definitionOfDone.add.execute(context, input),
  )
  register('projects.definitionOfDone.rename', (context, input) =>
    useCases.projects.definitionOfDone.rename.execute(context, input),
  )
  register('projects.definitionOfDone.remove', (context, input) =>
    useCases.projects.definitionOfDone.remove.execute(context, input),
  )
  register('projects.definitionOfDone.move', (context, input) =>
    useCases.projects.definitionOfDone.move.execute(context, input),
  )
  register('contributors.list', (context) => useCases.contributors.list.execute(context))
  register('contributors.create', (context, input) =>
    useCases.contributors.create.execute(context, input),
  )
  register('contributors.setDefaultRate', (context, input) =>
    useCases.contributors.setDefaultRate.execute(context, input),
  )
  register('timeline.list', (context, input) => useCases.timeline.list.execute(context, input))
  register('dashboard.get', (context) => useCases.dashboard.get.execute(context))
  register('dashboard.exportSummary', (context, input) =>
    useCases.dashboard.exportSummary.execute(context, input),
  )
  register('dashboard.saveSummary', (context, input) => saveDashboardSummary(context, input))
  register('boardSettings.get', (context) => useCases.boardSettings.get.execute(context))
  register('boardSettings.setWipLimits', (context, input) =>
    useCases.boardSettings.setWipLimits.execute(context, input),
  )
  register('meetings.list', (context, input) => useCases.meetings.listRange.execute(context, input))
  register('meetings.listUpcoming', (context) => useCases.meetings.listUpcoming.execute(context))
  register('meetings.create', (context, input) => useCases.meetings.create.execute(context, input))
  register('meetings.update', (context, input) => useCases.meetings.update.execute(context, input))
  register('meetings.delete', (context, input) => useCases.meetings.delete.execute(context, input))
  register('meetings.retroActions.list', (context, input) =>
    useCases.meetings.retroActions.list.execute(context, input),
  )
  register('meetings.retroActions.add', (context, input) =>
    useCases.meetings.retroActions.add.execute(context, input),
  )
  register('meetings.retroActions.update', (context, input) =>
    useCases.meetings.retroActions.update.execute(context, input),
  )
  register('meetings.retroActions.toggle', (context, input) =>
    useCases.meetings.retroActions.toggle.execute(context, input),
  )
  register('meetings.retroActions.remove', (context, input) =>
    useCases.meetings.retroActions.remove.execute(context, input),
  )
  register('daily.getToday', (context, input) => useCases.daily.getToday.execute(context, input))
  register('daily.save', (context, input) => useCases.daily.save.execute(context, input))
  register('daily.listForDate', (context, input) =>
    useCases.daily.listForDate.execute(context, input),
  )
  register('daily.getForUser', (context, input) =>
    useCases.daily.getForUser.execute(context, input),
  )
  register('teamTools.get', (context) => useCases.teamTools.get.execute(context))
  register('teamTools.previewChange', (context, input) =>
    useCases.teamTools.previewChange.execute(context, input),
  )
  register('teamTools.applyChange', (context, input) =>
    useCases.teamTools.applyChange.execute(context, input),
  )
  register('teamTools.completeWindDown', (context, input) =>
    useCases.teamTools.completeWindDown.execute(context, input),
  )
  register('teamTools.setLevel', (context, input) =>
    useCases.teamTools.setLevel.execute(context, input),
  )
  register('teamTools.applyPreset', (context, input) =>
    useCases.teamTools.applyPreset.execute(context, input),
  )
}
