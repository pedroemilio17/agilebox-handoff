import {
  canSeeRate,
  canSeeTaskTotal,
  canEditTask,
  describeEvent,
  isReadOnlyFor,
  total as calculateTaskTotal,
} from '@agilebox/core'
import type {
  Actor,
  Contributor,
  Meeting,
  Participation,
  Project,
  Task,
  TimelineEvent,
  TimelineNames,
  User,
} from '@agilebox/core'
import type {
  ContributorDto,
  DashboardDto,
  GetTaskDto,
  MeetingDto,
  ParticipationSummaryDto,
  ProjectDto,
  SessionUserDto,
  TaskDto,
  TimelineEventDto,
  UserDto,
} from '@agilebox/contract'

function rateInReais(rateCents: number): number {
  return rateCents / 100
}

export function toUserSummaryDto(
  user: User,
): Pick<SessionUserDto, 'id' | 'name' | 'initials' | 'role'> {
  return { id: user.id, name: user.name, initials: user.initials, role: user.role }
}

export function toSessionUserDto(user: User, actor: Actor): SessionUserDto {
  return {
    ...toUserSummaryDto(user),
    defaultRate: canSeeRate(actor, {
      organizationId: user.organizationId,
      participant: { kind: 'user', userId: user.id },
    })
      ? rateInReais(user.defaultRateCents)
      : null,
  }
}

export function toUserDto(user: User, actor: Actor): UserDto {
  return {
    ...toSessionUserDto(user, actor),
    email: user.email,
  }
}

export function toContributorDto(contributor: Contributor, actor: Actor): ContributorDto {
  return {
    id: contributor.id,
    name: contributor.name,
    defaultRate: canSeeRate(actor, {
      organizationId: contributor.organizationId,
      participant: { kind: 'contributor', contributorId: contributor.id },
    })
      ? rateInReais(contributor.defaultRateCents)
      : null,
  }
}

export function toProjectDto(project: Project): ProjectDto {
  return { id: project.id, name: project.name, createdAt: project.createdAt }
}

export function toParticipationSummaryDto(
  participation: Participation,
  organizationId: Task['organizationId'],
  actor: Actor,
  names: Pick<TimelineNames, 'user' | 'contributor'>,
): ParticipationSummaryDto {
  const participantName =
    participation.participant.kind === 'user'
      ? names.user(participation.participant.userId)
      : names.contributor(participation.participant.contributorId)

  return {
    id: participation.id,
    participant: participation.participant,
    participantName,
    role: participation.role,
    hours: participation.hoursHundredths / 100,
    rate: canSeeRate(actor, { organizationId, participant: participation.participant })
      ? rateInReais(participation.rateCents)
      : null,
  }
}

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    projectName: task.projectName,
    title: task.title,
    description: task.description,
    status: task.status,
    deadline: task.deadline,
    ticketId: task.ticket?.id ?? null,
    ticketUrl: task.ticket?.url ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

export function toTaskDetailDto(
  task: Task,
  actor: Actor,
  isMember: boolean,
  names: Pick<TimelineNames, 'user' | 'contributor'>,
): GetTaskDto {
  const canEdit = canEditTask(actor, task)
  return {
    ...toTaskDto(task),
    participations: task.participations.map((participation) =>
      toParticipationSummaryDto(participation, task.organizationId, actor, names),
    ),
    total: canSeeTaskTotal(actor, task.organizationId)
      ? rateInReais(calculateTaskTotal(task.participations))
      : null,
    canEdit,
    readOnly: isReadOnlyFor(actor, task, isMember),
  }
}

export function toMeetingDto(meeting: Meeting): MeetingDto {
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    time: meeting.time,
    participants: [...meeting.participants],
    createdBy: meeting.createdBy,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  }
}

export function toTimelineEventDto(
  event: TimelineEvent,
  viewer: Actor,
  names: TimelineNames,
): TimelineEventDto {
  return {
    id: event.id,
    taskId: event.taskId,
    at: event.at,
    actorUserId: event.actorUserId,
    asManager: event.asManager,
    type: event.type,
    text: describeEvent(event, viewer, names),
  }
}

export function toDashboardDto(
  distribution: DashboardDto['distribution'],
  collaborators: readonly {
    user: User
    taskCount: number
    distribution: DashboardDto['distribution']
    completedPercentage: number
  }[],
): DashboardDto {
  return {
    distribution,
    collaborators: collaborators.map((stat) => ({
      user: toUserSummaryDto(stat.user),
      taskCount: stat.taskCount,
      distribution: stat.distribution,
      completedPercentage: stat.completedPercentage,
    })),
  }
}
