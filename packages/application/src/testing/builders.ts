import {
  createContributor,
  createMeeting,
  createParticipation,
  createProject,
  createTask,
  createUser,
} from '@agilebox/core'
import type { Contributor, Meeting, Participation, Project, Task, User } from '@agilebox/core'
import {
  toContributorId,
  toMeetingId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import { parseDateOnly } from '@agilebox/core'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const projectId = toProjectId('00000000000000000000000003')
const taskId = toTaskId('00000000000000000000000004')
const timestamp = '2026-01-01T00:00:00.000Z'

export function aUser() {
  let value = {
    id: userId,
    organizationId,
    name: 'Ana Silva',
    email: 'ana@example.com',
    role: 'collaborator' as const,
    defaultRateCents: 4500,
    createdAt: timestamp,
  }
  return {
    with(changes: Partial<typeof value>) {
      value = { ...value, ...changes }
      return this
    },
    build(): User {
      return createUser(value)
    },
  }
}

export function aProject() {
  let value = {
    id: projectId,
    organizationId,
    name: 'Projeto AgileBox',
    createdBy: userId,
    createdAt: timestamp,
  }
  return {
    with(changes: Partial<typeof value>) {
      value = { ...value, ...changes }
      return this
    },
    build(): Project {
      return createProject(value)
    },
  }
}

export function aContributor() {
  let value = {
    id: toContributorId('00000000000000000000000005'),
    organizationId,
    name: 'Cliente',
    source: 'manual' as const,
    defaultRateCents: 2000,
    createdBy: userId,
    createdAt: timestamp,
  }
  return {
    with(changes: Partial<typeof value>) {
      value = { ...value, ...changes }
      return this
    },
    build(): Contributor {
      return createContributor(value)
    },
  }
}

export function aTask() {
  let taskProjectId = projectId
  let projectName = 'Projeto AgileBox'
  let createdBy = userId
  let value = {
    id: taskId,
    organizationId,
    projectId: taskProjectId,
    projectName,
    createdBy,
    title: 'Tarefa de exemplo',
    createdAt: timestamp,
    responsibleParticipationId: toParticipationId('00000000000000000000000006'),
    responsibleRateCents: 4500,
  }
  return {
    inProject(project: Project) {
      taskProjectId = project.id
      projectName = project.name
      value = { ...value, projectId: taskProjectId, projectName }
      return this
    },
    ownedBy(user: User) {
      createdBy = user.id
      value = { ...value, createdBy }
      return this
    },
    with(changes: Partial<typeof value>) {
      value = { ...value, ...changes }
      return this
    },
    build(): Task {
      return createTask(value)
    },
  }
}

export function aParticipation(task: Task) {
  let value: Participation = {
    id: toParticipationId('00000000000000000000000007'),
    taskId: task.id,
    participant: { kind: 'user', userId },
    role: 'support',
    hoursHundredths: 100,
    rateCents: 4500,
    addedAt: timestamp,
  }
  return {
    with(changes: Partial<Participation>) {
      value = { ...value, ...changes }
      return this
    },
    build(): Participation {
      return createParticipation(value)
    },
  }
}

export function aMeeting() {
  let value: Meeting = {
    id: toMeetingId('00000000000000000000000008'),
    organizationId,
    title: 'Reunião de exemplo',
    date: parseDateOnly('2026-01-15'),
    time: '09:00',
    participants: [userId],
    createdBy: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return {
    with(changes: Partial<Meeting>) {
      value = { ...value, ...changes }
      return this
    },
    build(): Meeting {
      return createMeeting(value)
    },
  }
}
