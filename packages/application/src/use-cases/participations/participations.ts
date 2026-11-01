import {
  addParticipant,
  canEditRate,
  canEditTask,
  createContributor,
  createParticipation,
  createUser,
  createTimelineEvent,
  diffTask,
  isManagerEdit,
  NotFoundError,
  parseHours,
  PermissionDeniedError,
  removeParticipant,
  toContributorId,
  toEventId,
  toParticipationId,
  toTaskId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  Contributor,
  ContributorId,
  ParticipationRole,
  Task,
  TimelineNames,
  User,
  UserId,
} from '@agilebox/core'
import type { ParticipationSummaryDto } from '@agilebox/contract'
import { toParticipationSummaryDto } from '../../mappers'
import type { AppDeps } from '../../deps'

interface AddParticipationInput {
  readonly taskId: string
  readonly participant:
    | { readonly kind: 'user'; readonly userId: string }
    | { readonly kind: 'contributor'; readonly contributorId: string }
  readonly role: ParticipationRole
}
interface RemoveParticipationInput {
  readonly taskId: string
  readonly participationId: string
}
interface SetParticipationHoursInput extends RemoveParticipationInput {
  readonly hours: string
}
interface SetParticipationRateInput extends RemoveParticipationInput {
  readonly rateCents: number
}

abstract class ChangeParticipation {
  constructor(protected readonly deps: AppDeps) {}

  protected async findEditableTask(actor: Actor, rawTaskId: string): Promise<Task> {
    const task = await this.deps.tasks.findById(actor.organizationId, toTaskId(rawTaskId))
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    if (!canEditTask(actor, task))
      throw new PermissionDeniedError('Sem permissão para editar esta tarefa')
    return task
  }

  protected async recordChange(actor: Actor, before: Task, after: Task): Promise<void> {
    const now = await this.deps.clock.now(actor.organizationId)
    const updated = { ...after, updatedAt: now }
    const drafts = diffTask(before, updated)
    const events = await Promise.all(
      drafts.map(async (draft) =>
        createTimelineEvent({
          ...draft,
          id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
          taskId: before.id,
          at: now,
          actorUserId: actor.userId,
          asManager: isManagerEdit(actor),
        }),
      ),
    )
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.tasks.save(actor.organizationId, updated)
      for (const participation of updated.participations) {
        const previous = before.participations.find((item) => item.id === participation.id)
        if (
          !previous ||
          previous.hoursHundredths !== participation.hoursHundredths ||
          previous.rateCents !== participation.rateCents
        )
          await repositories.participations.save(actor.organizationId, participation)
      }
      for (const participation of before.participations) {
        if (!updated.participations.some((item) => item.id === participation.id))
          await repositories.participations.remove(actor.organizationId, participation.id)
      }
      if (events.length > 0) await repositories.timeline.saveMany(actor.organizationId, events)
    })
    if (events.length > 0)
      await this.deps.changeNotifier.publish(actor.organizationId, {
        kind: 'task',
        ids: [before.id],
      })
  }

  protected async mapParticipation(
    actor: Actor,
    task: Task,
    participationId: string,
  ): Promise<ParticipationSummaryDto> {
    const participation = task.participations.find(
      (item) => item.id === toParticipationId(participationId),
    )
    if (!participation) throw new NotFoundError('Envolvimento não encontrado')
    const [userNames, contributorNames] = await Promise.all([
      Promise.all(
        task.participations.flatMap((item) =>
          item.participant.kind === 'user'
            ? [this.deps.users.findById(actor.organizationId, item.participant.userId)]
            : [],
        ),
      ),
      Promise.all(
        task.participations.flatMap((item) =>
          item.participant.kind === 'contributor'
            ? [
                this.deps.contributors.findById(
                  actor.organizationId,
                  item.participant.contributorId,
                ),
              ]
            : [],
        ),
      ),
    ])
    const users = task.participations.flatMap((item) =>
      item.participant.kind === 'user' ? [item.participant.userId] : [],
    )
    const contributors = task.participations.flatMap((item) =>
      item.participant.kind === 'contributor' ? [item.participant.contributorId] : [],
    )
    const userNameMap = new Map<UserId, string>()
    userNames.forEach((user, index) => {
      const id = users[index]
      if (id && user) userNameMap.set(id, user.name)
    })
    const contributorNameMap = new Map<ContributorId, string>()
    contributorNames.forEach((contributor, index) => {
      const id = contributors[index]
      if (id && contributor) contributorNameMap.set(id, contributor.name)
    })
    const names: Pick<TimelineNames, 'user' | 'contributor'> = {
      user: (id) => userNameMap.get(id) ?? 'Usuário',
      contributor: (id) => contributorNameMap.get(id) ?? 'Entidade',
    }
    return toParticipationSummaryDto(participation, task.organizationId, actor, names)
  }
}

export class AddParticipation extends ChangeParticipation {
  async execute(actor: Actor, input: AddParticipationInput): Promise<ParticipationSummaryDto> {
    const task = await this.findEditableTask(actor, input.taskId)
    let rateCents: number
    if (input.participant.kind === 'user') {
      const user = await this.deps.users.findById(
        actor.organizationId,
        toUserId(input.participant.userId),
      )
      if (!user) throw new NotFoundError('Usuário não encontrado')
      rateCents = user.defaultRateCents
    } else {
      const contributor = await this.deps.contributors.findById(
        actor.organizationId,
        toContributorId(input.participant.contributorId),
      )
      if (!contributor) throw new NotFoundError('Entidade não encontrada')
      rateCents = contributor.defaultRateCents
    }
    const participation = createParticipation({
      id: toParticipationId(await this.deps.idGenerator.generate(actor.organizationId)),
      taskId: task.id,
      participant:
        input.participant.kind === 'user'
          ? { kind: 'user', userId: toUserId(input.participant.userId) }
          : {
              kind: 'contributor',
              contributorId: toContributorId(input.participant.contributorId),
            },
      role: input.role,
      hoursHundredths: 0,
      rateCents,
      addedAt: await this.deps.clock.now(actor.organizationId),
    })
    const updated = addParticipant(task, participation)
    await this.recordChange(actor, task, updated)
    const saved = await this.deps.tasks.findById(actor.organizationId, task.id)
    if (!saved) throw new NotFoundError('Tarefa não encontrada')
    return this.mapParticipation(actor, saved, participation.id)
  }
}

export class RemoveParticipation extends ChangeParticipation {
  async execute(actor: Actor, input: RemoveParticipationInput): Promise<void> {
    const task = await this.findEditableTask(actor, input.taskId)
    const updated = removeParticipant(task, toParticipationId(input.participationId))
    await this.recordChange(actor, task, updated)
  }
}

export class SetParticipationHours extends ChangeParticipation {
  async execute(actor: Actor, input: SetParticipationHoursInput): Promise<ParticipationSummaryDto> {
    const task = await this.findEditableTask(actor, input.taskId)
    const participationId = toParticipationId(input.participationId)
    const participation = task.participations.find((item) => item.id === participationId)
    if (!participation) throw new NotFoundError('Envolvimento não encontrado')
    const updated = {
      ...task,
      participations: task.participations.map((item) =>
        item.id === participationId
          ? createParticipation({ ...item, hoursHundredths: parseHours(input.hours) })
          : item,
      ),
    }
    await this.recordChange(actor, task, updated)
    const saved = await this.deps.tasks.findById(actor.organizationId, task.id)
    if (!saved) throw new NotFoundError('Tarefa não encontrada')
    return this.mapParticipation(actor, saved, participationId)
  }
}

export class SetParticipationRate extends ChangeParticipation {
  async execute(actor: Actor, input: SetParticipationRateInput): Promise<ParticipationSummaryDto> {
    if (input.rateCents <= 0) throw new ValidationError('Valor/hora deve ser maior que zero')
    const task = await this.findEditableTask(actor, input.taskId)
    const participationId = toParticipationId(input.participationId)
    const participation = task.participations.find((item) => item.id === participationId)
    if (!participation) throw new NotFoundError('Envolvimento não encontrado')
    if (
      !canEditRate(actor, {
        organizationId: task.organizationId,
        participant: participation.participant,
      })
    )
      throw new PermissionDeniedError('Sem permissão para alterar este valor/hora')
    const updated = {
      ...task,
      participations: task.participations.map((item) =>
        item.id === participationId
          ? createParticipation({ ...item, rateCents: input.rateCents })
          : item,
      ),
    }
    let updatedUser: User | null = null
    let updatedContributor: Contributor | null = null
    if (participation.participant.kind === 'user') {
      const user = await this.deps.users.findById(
        actor.organizationId,
        participation.participant.userId,
      )
      if (!user) throw new NotFoundError('Usuário não encontrado')
      updatedUser = createUser({ ...user, defaultRateCents: input.rateCents })
    } else {
      const contributor = await this.deps.contributors.findById(
        actor.organizationId,
        participation.participant.contributorId,
      )
      if (!contributor) throw new NotFoundError('Entidade não encontrada')
      updatedContributor = createContributor({ ...contributor, defaultRateCents: input.rateCents })
    }
    const now = await this.deps.clock.now(actor.organizationId)
    const changed = { ...updated, updatedAt: now }
    const drafts = diffTask(task, changed)
    const events = await Promise.all(
      drafts.map(async (draft) =>
        createTimelineEvent({
          ...draft,
          id: toEventId(await this.deps.idGenerator.generate(actor.organizationId)),
          taskId: task.id,
          at: now,
          actorUserId: actor.userId,
          asManager: isManagerEdit(actor),
        }),
      ),
    )
    await this.deps.unitOfWork.run(actor.organizationId, async (repositories) => {
      await repositories.tasks.save(actor.organizationId, changed)
      const updatedParticipation = changed.participations.find(
        (item) => item.id === participationId,
      )
      if (updatedParticipation)
        await repositories.participations.save(actor.organizationId, updatedParticipation)
      if (updatedUser) await repositories.users.save(actor.organizationId, updatedUser)
      if (updatedContributor)
        await repositories.contributors.save(actor.organizationId, updatedContributor)
      if (events.length > 0) await repositories.timeline.saveMany(actor.organizationId, events)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, { kind: 'task', ids: [task.id] })
    const saved = await this.deps.tasks.findById(actor.organizationId, task.id)
    if (!saved) throw new NotFoundError('Tarefa não encontrada')
    return this.mapParticipation(actor, saved, participationId)
  }
}
