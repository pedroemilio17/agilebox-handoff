import {
  canSeeEstimatedCost,
  estimatedCostOf,
  hundredthsToHours,
  isInBacklog,
  spentHundredths,
  canChangeTaskArchive,
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
  sprintLabel,
  total as calculateTaskTotal,
} from '@agilebox/core'
import type {
  AcceptanceCriterion,
  Actor,
  BoardSettings,
  ChecklistItem,
  DefinitionOfDoneItem,
  WipLimits,
  Contributor,
  DailyEntry,
  Meeting,
  MeetingOccurrence,
  Participation,
  Project,
  RetroAction,
  Impediment,
  Sprint,
  SprintTask,
  Task,
  TaskComment,
  TimelineEvent,
  TimelineNames,
  User,
} from '@agilebox/core'
import type {
  AcceptanceCriterionDto,
  ImpedimentDto,
  ImpedimentListItemDto,
  ImpedimentRefDto,
  BoardSettingsDto,
  ChecklistItemDto,
  DailyEntryDto,
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
  SprintDto,
  SprintHistoryRowDto,
  SprintRefDto,
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
    archivedAt: project.archivedAt,
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

/**
 * `checklist` são as subtarefas da tarefa; o progresso do card sai delas. `commentCount` é 0 quando o ator não vê os comentários. `criteria` são os critérios de aceitação, dos quais sai o x/y.
 * `sprint` é a sprint aberta da tarefa (M4.2), carregada em lote por `loadSprintRefs`; nulo sem sprint.
 */
export function toTaskDto(
  task: Task,
  taskPrefix: string,
  checklist: readonly ChecklistItem[],
  commentCount: number,
  criteria: readonly AcceptanceCriterion[],
  sprint: SprintRefDto | null,
  impediment: ImpedimentRefDto | null,
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
    archivedAt: task.archivedAt,
    backlogRank: task.backlogRank,
    inBacklog: isInBacklog(task),
    // Horas, não dinheiro: a comparação estimado × realizado é visível a quem vê a tarefa.
    estimatedHours: hundredthsToHours(task.estimatedHoursHundredths),
    actualHours: spentHundredths(task.participations) / 100,
    deadline: task.deadline,
    ticketId: task.ticket?.id ?? null,
    ticketUrl: task.ticket?.url ?? null,
    checklistProgress: checklistProgress(checklist),
    criteriaProgress: {
      done: criteria.filter((criterion) => criterion.done).length,
      total: criteria.length,
    },
    commentCount,
    sprint,
    impediment,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

/** Impedimento como a interface o mostra. `ownerName` vem do usuário responsável (nulo sem responsável). */
export function toImpedimentDto(impediment: Impediment, ownerName: string | null): ImpedimentDto {
  return {
    id: impediment.id,
    taskId: impediment.taskId,
    status: impediment.status,
    reason: impediment.reason,
    ownerId: impediment.ownerId,
    ownerName: impediment.ownerId === null ? null : ownerName,
    openedBy: impediment.openedBy,
    openedAt: impediment.openedAt,
    resolvedBy: impediment.resolvedBy,
    resolvedAt: impediment.resolvedAt,
    resolution: impediment.resolution,
  }
}

/** Resumo do impedimento aberto, para o cartão e o detalhe da tarefa. */
export function toImpedimentRefDto(
  impediment: Impediment,
  ownerName: string | null,
): ImpedimentRefDto {
  return {
    id: impediment.id,
    status: impediment.status,
    reason: impediment.reason,
    ownerId: impediment.ownerId,
    ownerName: impediment.ownerId === null ? null : ownerName,
    openedAt: impediment.openedAt,
  }
}

/** Item da lista de impedimentos: o impedimento e a tarefa dele. */
export function toImpedimentListItemDto(
  impediment: Impediment,
  ownerName: string | null,
  task: {
    readonly key: string
    readonly title: string
    readonly projectId: string
    readonly projectName: string
  },
): ImpedimentListItemDto {
  return {
    ...toImpedimentDto(impediment, ownerName),
    taskKey: task.key,
    taskTitle: task.title,
    projectId: task.projectId,
    projectName: task.projectName,
  }
}

/** Sprint como o card e o detalhe a mostram: "Sprint N" pelo número, com o nome e o estado. */
export function toSprintRefDto(sprint: Sprint): SprintRefDto {
  return { id: sprint.id, number: sprint.number, name: sprint.name, status: sprint.status }
}

export function toSprintDto(sprint: Sprint): SprintDto {
  return {
    id: sprint.id,
    projectId: sprint.projectId,
    number: sprint.number,
    label: sprintLabel(sprint.number),
    name: sprint.name,
    goal: sprint.goal,
    plannedStart: sprint.plannedStart,
    plannedEnd: sprint.plannedEnd,
    status: sprint.status,
    startedAt: sprint.startedAt,
    closedAt: sprint.closedAt,
    closePolicy: sprint.closePolicy?.kind ?? null,
    createdBy: sprint.createdBy,
    createdAt: sprint.createdAt,
  }
}

/** Uma linha do histórico. `taskKey` e `taskTitle` vêm da tarefa, que o chamador carrega. */
export function toSprintHistoryRowDto(
  row: SprintTask,
  task: { readonly key: string; readonly title: string },
): SprintHistoryRowDto {
  return {
    taskId: row.taskId,
    taskKey: task.key,
    taskTitle: task.title,
    addedAt: row.addedAt,
    addedBy: row.addedBy,
    removedAt: row.removedAt,
    removedBy: row.removedBy,
    outcome: row.outcome,
  }
}

export function toAcceptanceCriterionDto(criterion: AcceptanceCriterion): AcceptanceCriterionDto {
  return {
    id: criterion.id,
    taskId: criterion.taskId,
    text: criterion.text,
    done: criterion.done,
    position: criterion.position,
    createdAt: criterion.createdAt,
    updatedAt: criterion.updatedAt,
  }
}

/**
 * `responsibleDefaultRateCents` é o padrão do Responsável, usado no custo estimado quando o envolvimento
 * dele está sem valor. O custo estimado só sai para quem vê o valor/hora do Responsável (`canSeeEstimatedCost`).
 */
export function toTaskDetailDto(
  task: Task,
  taskPrefix: string,
  actor: Actor,
  isMember: boolean,
  names: Pick<TimelineNames, 'user' | 'contributor'>,
  checklist: readonly ChecklistItem[],
  comments: readonly TaskCommentDto[],
  definitionOfDone: readonly DefinitionOfDoneItem[],
  criteria: readonly AcceptanceCriterion[],
  responsibleDefaultRateCents: number,
  sprint: SprintRefDto | null,
  impediment: ImpedimentRefDto | null,
  impedimentHistory: readonly ImpedimentDto[],
): GetTaskDto {
  const canEdit = canEditTask(actor, task)
  const cost = canSeeEstimatedCost(actor, task)
    ? estimatedCostOf(task, responsibleDefaultRateCents)
    : null
  return {
    ...toTaskDto(task, taskPrefix, checklist, comments.length, criteria, sprint, impediment),
    impedimentHistory: [...impedimentHistory],
    checklist: checklist.map(toChecklistItemDto),
    criteria: criteria.map(toAcceptanceCriterionDto),
    estimatedCost: cost === null ? null : rateInReais(cost),
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
    canArchive: canChangeTaskArchive(actor, task),
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

/** Daily para quem tem acesso a ela (o próprio usuário ou o gestor). O nome vem do usuário dono. */
export function toDailyEntryDto(entry: DailyEntry, userName: string): DailyEntryDto {
  return {
    id: entry.id,
    userId: entry.userId,
    userName,
    date: entry.date,
    answers: { ...entry.answers },
    noNews: entry.noNews,
    taskRefs: [...entry.taskRefs],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
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
