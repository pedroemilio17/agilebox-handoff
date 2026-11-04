import {
  canEditComment,
  canRemoveComment,
  canSeeRate,
  canSeeTaskTotal,
  canEditTask,
  canToggleRetroAction,
  checklistProgress,
  describeEvent,
  formatTaskKey,
  isReadOnlyFor,
  total as calculateTaskTotal,
} from '@agilebox/core'
import type {
  Actor,
  BoardSettings,
  ChecklistItem,
  DefinitionOfDoneItem,
  WipLimits,
  Contributor,
  Meeting,
  MeetingOccurrence,
  Participation,
  Project,
  RetroAction,
  Task,
  TaskComment,
  TimelineEvent,
  TimelineNames,
  User,
} from '@agilebox/core'
import type {
  BoardSettingsDto,
  ChecklistItemDto,
  DefinitionOfDoneItemDto,
  WipLimitsDto,
  ContributorDto,
  DashboardDto,
  GetTaskDto,
  MeetingDto,
  MeetingOccurrenceDto,
  ParticipationSummaryDto,
  ProjectDto,
  RetroActionDto,
  TaskCommentDto,
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

export function toProjectDto(project: Project, definitionOfDoneCount: number): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    definitionOfDoneCount,
  }
}

export function toDefinitionOfDoneItemDto(item: DefinitionOfDoneItem): DefinitionOfDoneItemDto {
  return { id: item.id, projectId: item.projectId, title: item.title, position: item.position }
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

export function toChecklistItemDto(item: ChecklistItem): ChecklistItemDto {
  return {
    id: item.id,
    taskId: item.taskId,
    title: item.title,
    done: item.done,
    position: item.position,
    createdAt: item.createdAt,
    doneAt: item.doneAt,
  }
}

/** `checklist` são as subtarefas da tarefa; o progresso do card sai delas. `commentCount` é 0 quando o ator não vê os comentários. */
export function toTaskDto(
  task: Task,
  taskPrefix: string,
  checklist: readonly ChecklistItem[],
  commentCount: number,
): TaskDto {
  return {
    id: task.id,
    number: task.number,
    key: formatTaskKey(taskPrefix, task.number),
    projectId: task.projectId,
    projectName: task.projectName,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    blockedReason: task.blockedReason,
    blockedAt: task.blockedAt,
    deadline: task.deadline,
    ticketId: task.ticket?.id ?? null,
    ticketUrl: task.ticket?.url ?? null,
    checklistProgress: checklistProgress(checklist),
    commentCount,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

export function toTaskDetailDto(
  task: Task,
  taskPrefix: string,
  actor: Actor,
  isMember: boolean,
  names: Pick<TimelineNames, 'user' | 'contributor'>,
  checklist: readonly ChecklistItem[],
  comments: readonly TaskCommentDto[],
  definitionOfDone: readonly DefinitionOfDoneItem[],
): GetTaskDto {
  const canEdit = canEditTask(actor, task)
  return {
    ...toTaskDto(task, taskPrefix, checklist, comments.length),
    checklist: checklist.map(toChecklistItemDto),
    projectDefinitionOfDone: definitionOfDone.map(toDefinitionOfDoneItemDto),
    comments: [...comments],
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

export function toTaskCommentDto(
  comment: TaskComment,
  task: Task,
  actor: Actor,
  names: Pick<TimelineNames, 'user'>,
): TaskCommentDto {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    authorName: names.user(comment.authorId),
    body: comment.body,
    asManager: comment.asManager,
    mentions: comment.mentions.map((id) => ({ id, name: names.user(id) })),
    createdAt: comment.createdAt,
    editedAt: comment.editedAt,
    canEdit: canEditComment(actor, task, comment),
    canRemove: canRemoveComment(actor, task, comment),
  }
}

export function toMeetingDto(meeting: Meeting): MeetingDto {
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    time: meeting.time,
    endTime: meeting.endTime,
    kind: meeting.kind,
    recurrence: meeting.recurrence,
    recurrenceUntil: meeting.recurrenceUntil,
    participants: [...meeting.participants],
    createdBy: meeting.createdBy,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  }
}

export function toMeetingOccurrenceDto(
  occurrence: MeetingOccurrence,
  retroActions: { readonly total: number; readonly done: number } = { total: 0, done: 0 },
): MeetingOccurrenceDto {
  return {
    ...toMeetingDto(occurrence.meeting),
    seriesId: occurrence.seriesId,
    occurrenceDate: occurrence.date,
    occurrenceIndex: occurrence.index,
    occurrenceEndTime: occurrence.endTime,
    retroActionsCount: retroActions.total,
    retroActionsDone: retroActions.done,
  }
}

export function toRetroActionDto(
  action: RetroAction,
  actor: Actor,
  responsibleName: string | null,
): RetroActionDto {
  return {
    id: action.id,
    meetingId: action.meetingId,
    occurrenceDate: action.occurrenceDate,
    title: action.title,
    responsibleId: action.responsibleId,
    responsibleName,
    dueDate: action.dueDate,
    done: action.done,
    doneAt: action.doneAt,
    createdAt: action.createdAt,
    createdBy: action.createdBy,
    canManage: actor.role === 'manager' && actor.organizationId === action.organizationId,
    canToggle: canToggleRetroAction(actor, action),
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

/** Limites em formato de contrato: chave ausente = sem limite naquela coluna. */
export function toWipLimitsDto(limits: WipLimits): WipLimitsDto {
  return {
    ...(limits.in_progress === undefined ? {} : { in_progress: limits.in_progress }),
    ...(limits.review === undefined ? {} : { review: limits.review }),
  }
}

export function toBoardSettingsDto(settings: BoardSettings | null): BoardSettingsDto {
  return {
    wipLimits: toWipLimitsDto(settings?.wipLimits ?? {}),
    updatedAt: settings?.updatedAt ?? null,
    updatedBy: settings?.updatedBy ?? null,
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
