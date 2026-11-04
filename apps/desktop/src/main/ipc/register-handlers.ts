import type { Actor } from '@agilebox/core'
import { API_SCHEMA_REGISTRY } from '@agilebox/contract'
import type {
  ApiChannel,
  SaveDashboardSummaryInput,
  SaveDashboardSummaryOutput,
} from '@agilebox/contract'
import type { ActorSession } from '@agilebox/application'
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
    actor: Actor,
    input: SaveDashboardSummaryInput,
  ) => Promise<SaveDashboardSummaryOutput>,
): void {
  const register = <Channel extends ApiChannel>(
    channel: Channel,
    execute: (actor: Actor, input: InputFor<Channel>) => unknown,
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
  register('session.switchUser', (_actor, input) => useCases.session.switchUser.execute(input))
  register('session.listUsers', (actor) => useCases.session.listUsers.execute(actor))
  register('users.setDefaultRate', (actor, input) =>
    useCases.users.setDefaultRate.execute(actor, input),
  )
  register('projects.list', (actor) => useCases.projects.listProjects.execute(actor))
  register('projects.create', (actor, input) =>
    useCases.projects.createProject.execute(actor, input),
  )
  register('projects.listMembers', (actor, input) =>
    useCases.projects.listMembers.execute(actor, input),
  )
  register('projects.addMember', (actor, input) =>
    useCases.projects.addMember.execute(actor, input),
  )
  register('projects.removeMember', (actor, input) =>
    useCases.projects.removeMember.execute(actor, input),
  )
  register('tasks.getBoardFlow', (actor, input) =>
    useCases.tasks.getBoardFlow.execute(actor, {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.forUserId === undefined ? {} : { forUserId: input.forUserId }),
    }),
  )
  register('tasks.listBoard', (actor, input) =>
    useCases.tasks.listBoard.execute(actor, {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
      ...(input.forUserId === undefined ? {} : { forUserId: input.forUserId }),
    }),
  )
  register('tasks.listTeamBoard', (actor, input) =>
    useCases.tasks.listTeamBoard.execute(actor, {
      ...(input.projectId === undefined ? {} : { projectId: input.projectId }),
    }),
  )
  register('tasks.get', (actor, input) => useCases.tasks.getDetail.execute(actor, input))
  register('tasks.create', (actor, input) => useCases.tasks.create.execute(actor, input))
  register('tasks.update', (actor, input) => useCases.tasks.update.execute(actor, input))
  register('tasks.move', (actor, input) => useCases.tasks.move.execute(actor, input))
  register('tasks.block', (actor, input) => useCases.tasks.block.execute(actor, input))
  register('tasks.unblock', (actor, input) => useCases.tasks.unblock.execute(actor, input))
  register('tasks.checklist.add', (actor, input) =>
    useCases.tasks.checklist.add.execute(actor, input),
  )
  register('tasks.checklist.toggle', (actor, input) =>
    useCases.tasks.checklist.toggle.execute(actor, input),
  )
  register('tasks.checklist.rename', (actor, input) =>
    useCases.tasks.checklist.rename.execute(actor, input),
  )
  register('tasks.checklist.remove', (actor, input) =>
    useCases.tasks.checklist.remove.execute(actor, input),
  )
  register('tasks.checklist.move', (actor, input) =>
    useCases.tasks.checklist.move.execute(actor, input),
  )
  register('tasks.comments.add', (actor, input) =>
    useCases.tasks.comments.add.execute(actor, input),
  )
  register('tasks.comments.edit', (actor, input) =>
    useCases.tasks.comments.edit.execute(actor, input),
  )
  register('tasks.comments.remove', (actor, input) =>
    useCases.tasks.comments.remove.execute(actor, input),
  )
  register('tasks.listRecent', (actor) => useCases.tasks.listRecent.execute(actor))
  register('tasks.listFrequent', (actor) => useCases.tasks.listFrequent.execute(actor))
  register('tasks.search', (actor, input) => useCases.tasks.search.execute(actor, input))
  register('tasks.recordOpen', (actor, input) => useCases.tasks.recordOpen.execute(actor, input))
  register('participations.add', (actor, input) =>
    useCases.participations.add.execute(actor, input),
  )
  register('participations.remove', (actor, input) =>
    useCases.participations.remove.execute(actor, input),
  )
  register('participations.setHours', (actor, input) =>
    useCases.participations.setHours.execute(actor, input),
  )
  register('participations.setRate', (actor, input) =>
    useCases.participations.setRate.execute(actor, input),
  )
  register('projects.definitionOfDone.list', (actor, input) =>
    useCases.projects.definitionOfDone.list.execute(actor, input),
  )
  register('projects.definitionOfDone.add', (actor, input) =>
    useCases.projects.definitionOfDone.add.execute(actor, input),
  )
  register('projects.definitionOfDone.rename', (actor, input) =>
    useCases.projects.definitionOfDone.rename.execute(actor, input),
  )
  register('projects.definitionOfDone.remove', (actor, input) =>
    useCases.projects.definitionOfDone.remove.execute(actor, input),
  )
  register('projects.definitionOfDone.move', (actor, input) =>
    useCases.projects.definitionOfDone.move.execute(actor, input),
  )
  register('contributors.list', (actor) => useCases.contributors.list.execute(actor))
  register('contributors.create', (actor, input) =>
    useCases.contributors.create.execute(actor, input),
  )
  register('contributors.setDefaultRate', (actor, input) =>
    useCases.contributors.setDefaultRate.execute(actor, input),
  )
  register('timeline.list', (actor, input) => useCases.timeline.list.execute(actor, input))
  register('dashboard.get', (actor) => useCases.dashboard.get.execute(actor))
  register('dashboard.exportSummary', (actor, input) =>
    useCases.dashboard.exportSummary.execute(actor, input),
  )
  register('dashboard.saveSummary', (actor, input) => saveDashboardSummary(actor, input))
  register('boardSettings.get', (actor) => useCases.boardSettings.get.execute(actor))
  register('boardSettings.setWipLimits', (actor, input) =>
    useCases.boardSettings.setWipLimits.execute(actor, input),
  )
  register('meetings.list', (actor, input) => useCases.meetings.listRange.execute(actor, input))
  register('meetings.listUpcoming', (actor) => useCases.meetings.listUpcoming.execute(actor))
  register('meetings.create', (actor, input) => useCases.meetings.create.execute(actor, input))
  register('meetings.update', (actor, input) => useCases.meetings.update.execute(actor, input))
  register('meetings.delete', (actor, input) => useCases.meetings.delete.execute(actor, input))
  register('meetings.retroActions.list', (actor, input) =>
    useCases.meetings.retroActions.list.execute(actor, input),
  )
  register('meetings.retroActions.add', (actor, input) =>
    useCases.meetings.retroActions.add.execute(actor, input),
  )
  register('meetings.retroActions.update', (actor, input) =>
    useCases.meetings.retroActions.update.execute(actor, input),
  )
  register('meetings.retroActions.toggle', (actor, input) =>
    useCases.meetings.retroActions.toggle.execute(actor, input),
  )
  register('meetings.retroActions.remove', (actor, input) =>
    useCases.meetings.retroActions.remove.execute(actor, input),
  )
}
