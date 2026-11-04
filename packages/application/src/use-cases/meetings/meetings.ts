import {
  addDays,
  canSeeMeeting,
  createMeeting,
  expandMeetingOccurrences,
  NotFoundError,
  parseDateOnly,
  PermissionDeniedError,
  toMeetingId,
  toUserId,
} from '@agilebox/core'
import type { Actor, DateOnly } from '@agilebox/core'
import type {
  CreateMeetingInput,
  MeetingDto,
  MeetingOccurrenceDto,
  UpdateMeetingInput,
} from '@agilebox/contract'
import { toMeetingDto, toMeetingOccurrenceDto } from '../../mappers'
import type { AppDeps } from '../../deps'

interface ListRangeInput {
  readonly rangeStart: string
  readonly rangeEnd: string
}

interface MeetingIdInput {
  readonly meetingId: string
}

/** Horizonte de "Próximos": 52 semanas, o mesmo limite das séries sem data final. */
const UPCOMING_HORIZON_DAYS = 52 * 7

function requireManager(actor: Actor): void {
  if (actor.role !== 'manager')
    throw new PermissionDeniedError('Só o gestor cria e edita agendamentos')
}

function optionalDate(value: string | null | undefined): DateOnly | null {
  return value ? parseDateOnly(value) : null
}

/** Ocorrências do intervalo, só dos agendamentos que o ator pode ver. */
async function occurrencesInRange(
  deps: AppDeps,
  actor: Actor,
  rangeStart: DateOnly,
  rangeEnd: DateOnly,
): Promise<readonly MeetingOccurrenceDto[]> {
  const candidates = await deps.meetings.listOverlapping(actor.organizationId, rangeStart, rangeEnd)
  const visible = candidates.filter((meeting) => canSeeMeeting(actor, meeting))
  return expandMeetingOccurrences(visible, rangeStart, rangeEnd).map(toMeetingOccurrenceDto)
}

export class ListMeetingOccurrences {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ListRangeInput): Promise<readonly MeetingOccurrenceDto[]> {
    return occurrencesInRange(
      this.deps,
      actor,
      parseDateOnly(input.rangeStart),
      parseDateOnly(input.rangeEnd),
    )
  }
}

export class ListUpcomingMeetings {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<readonly MeetingOccurrenceDto[]> {
    const today = parseDateOnly((await this.deps.clock.now(actor.organizationId)).slice(0, 10))
    return occurrencesInRange(this.deps, actor, today, addDays(today, UPCOMING_HORIZON_DAYS))
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
      endTime: input.endTime ?? null,
      kind: input.kind ?? 'meeting',
      recurrence: input.recurrence ?? 'none',
      recurrenceUntil: optionalDate(input.recurrenceUntil),
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

  /** Edita a série inteira: não há exceções por ocorrência nesta fase. */
  async execute(actor: Actor, input: UpdateMeetingInput): Promise<MeetingDto> {
    requireManager(actor)
    const meetingId = toMeetingId(input.meetingId)
    const existing = await this.deps.meetings.findById(actor.organizationId, meetingId)
    if (!existing) throw new NotFoundError('Agendamento não encontrado')
    const { changes } = input
    const meeting = createMeeting({
      ...existing,
      title: changes.title ?? existing.title,
      date: changes.date ? parseDateOnly(changes.date) : existing.date,
      time: changes.time ?? existing.time,
      endTime: changes.endTime !== undefined ? changes.endTime : existing.endTime,
      kind: changes.kind ?? existing.kind,
      recurrence: changes.recurrence ?? existing.recurrence,
      recurrenceUntil:
        changes.recurrenceUntil !== undefined
          ? optionalDate(changes.recurrenceUntil)
          : existing.recurrenceUntil,
      participants: changes.participants?.map(toUserId) ?? existing.participants,
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

  /** Exclui a série inteira. */
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
