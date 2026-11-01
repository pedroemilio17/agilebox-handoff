import {
  createMeeting,
  NotFoundError,
  parseDateOnly,
  PermissionDeniedError,
  toMeetingId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import type { CreateMeetingInput, MeetingDto, UpdateMeetingInput } from '@agilebox/contract'
import { toMeetingDto } from '../../mappers'
import type { AppDeps } from '../../deps'

interface ListMonthInput {
  readonly month: string
}

interface MeetingIdInput {
  readonly meetingId: string
}

function requireManager(actor: Actor): void {
  if (actor.role !== 'manager')
    throw new PermissionDeniedError('Só o gestor cria e edita agendamentos')
}

export class ListMonthMeetings {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListMonthInput): Promise<readonly MeetingDto[]> {
    const meetings = await this.deps.meetings.listByMonth(actor.organizationId, input.month)
    return meetings.map(toMeetingDto)
  }
}

export class ListUpcomingMeetings {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly MeetingDto[]> {
    const today = (await this.deps.clock.now(actor.organizationId)).slice(0, 10)
    const meetings = await this.deps.meetings.listUpcoming(
      actor.organizationId,
      parseDateOnly(today),
    )
    return meetings.map(toMeetingDto)
  }
}

export class CreateMeeting {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CreateMeetingInput): Promise<MeetingDto> {
    requireManager(actor)
    const now = await this.deps.clock.now(actor.organizationId)
    const meeting = createMeeting({
      id: toMeetingId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
      title: input.title,
      date: parseDateOnly(input.date),
      time: input.time,
      participants: input.participants.map(toUserId),
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    await this.deps.unitOfWork.run(actor.organizationId, async ({ meetings }) => {
      await meetings.save(actor.organizationId, meeting)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'meeting',
      ids: [meeting.id],
    })
    return toMeetingDto(meeting)
  }
}

export class UpdateMeeting {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: UpdateMeetingInput): Promise<MeetingDto> {
    requireManager(actor)
    const meetingId = toMeetingId(input.meetingId)
    const existing = await this.deps.meetings.findById(actor.organizationId, meetingId)
    if (!existing) throw new NotFoundError('Agendamento não encontrado')
    const meeting = createMeeting({
      ...existing,
      title: input.changes.title ?? existing.title,
      date: input.changes.date ? parseDateOnly(input.changes.date) : existing.date,
      time: input.changes.time ?? existing.time,
      participants: input.changes.participants?.map(toUserId) ?? existing.participants,
      updatedAt: await this.deps.clock.now(actor.organizationId),
    })
    await this.deps.unitOfWork.run(actor.organizationId, async ({ meetings }) => {
      await meetings.save(actor.organizationId, meeting)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'meeting',
      ids: [meeting.id],
    })
    return toMeetingDto(meeting)
  }
}

export class DeleteMeeting {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: MeetingIdInput): Promise<void> {
    requireManager(actor)
    const meetingId = toMeetingId(input.meetingId)
    const existing = await this.deps.meetings.findById(actor.organizationId, meetingId)
    if (!existing) throw new NotFoundError('Agendamento não encontrado')
    await this.deps.unitOfWork.run(actor.organizationId, async ({ meetings }) => {
      await meetings.remove(actor.organizationId, meetingId)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'meeting',
      ids: [meetingId],
    })
  }
}
