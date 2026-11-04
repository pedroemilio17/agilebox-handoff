import type { GetTaskDto, ParticipationSummaryDto, TimelineEventDto } from '@agilebox/contract'

export const TASK_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5BCD'
export const USER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
export const OTHER_USER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
export const CONTRIBUTOR_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5C01'

export function makeParticipation(
  overrides: Partial<ParticipationSummaryDto> = {},
): ParticipationSummaryDto {
  return {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5P01',
    participant: { kind: 'user', userId: USER_ID },
    participantName: 'Ana Souza',
    role: 'responsible',
    hours: 2.5,
    rate: 40,
    ...overrides,
  }
}

export function makeDetail(overrides: Partial<GetTaskDto> = {}): GetTaskDto {
  return {
    id: TASK_ID,
    number: 118,
    key: 'AB-118',
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    projectName: 'Projeto Aurora',
    title: 'Revisar integração',
    description: 'Descrição inicial',
    status: 'in_progress',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    deadline: '2026-11-10',
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    participations: [makeParticipation()],
    total: 100,
    canEdit: true,
    readOnly: false,
    ...overrides,
  }
}

export function makeEvent(overrides: Partial<TimelineEventDto> = {}): TimelineEventDto {
  return {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5E01',
    taskId: TASK_ID,
    at: '2026-10-31T12:00:00.000Z',
    actorUserId: USER_ID,
    asManager: false,
    type: 'status_changed',
    text: 'Status: A fazer → Desenvolvendo',
    ...overrides,
  }
}
