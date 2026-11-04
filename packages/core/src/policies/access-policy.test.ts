import { describe, expect, it } from 'vitest'
import type { OrganizationId, ProjectId, TaskId, UserId, ContributorId } from '../shared/ids'
import type { Task } from '../entities/task'
import type { Project } from '../entities/project'
import type { Actor } from './actor'
import * as policy from './access-policy'

const org = 'org' as OrganizationId
const otherOrg = 'other' as OrganizationId
const user = 'user' as UserId
const other = 'other' as UserId
const collaborator: Actor = { userId: user, organizationId: org, role: 'collaborator' }
const manager: Actor = { ...collaborator, role: 'manager' }
const project: Project = {
  id: 'project' as ProjectId,
  organizationId: org,
  createdBy: other,
  name: 'P',
  nameKey: 'p',
  createdAt: '',
}
const task: Task = {
  id: 'task' as TaskId,
  organizationId: org,
  number: 1,
  projectId: project.id,
  projectName: 'P',
  createdBy: other,
  title: 'T',
  description: '',
  status: 'planning',
  deadline: null,
  ticket: null,
  searchText: '',
  createdAt: '',
  updatedAt: '',
  participations: [],
}
const ownTask = { ...task, createdBy: user }
const rate = { organizationId: org, participant: { kind: 'user' as const, userId: user } }

describe('política de acesso', () => {
  it('reconhece criador e envolvimento de usuário, mas não entidade', () => {
    expect(policy.participates(collaborator, ownTask)).toBe(true)
    const participation = {
      id: 'p' as never,
      taskId: task.id,
      role: 'support' as const,
      hoursHundredths: 0,
      rateCents: 0,
      addedAt: '',
    }
    expect(
      policy.participates(collaborator, {
        ...task,
        participations: [{ ...participation, participant: { kind: 'user', userId: user } }],
      }),
    ).toBe(true)
    expect(
      policy.participates(collaborator, {
        ...task,
        participations: [
          {
            ...participation,
            participant: { kind: 'contributor', contributorId: user as unknown as ContributorId },
          },
        ],
      }),
    ).toBe(false)
  })
  it('aplica acesso e somente leitura ao detalhe', () => {
    expect(policy.canViewTask(collaborator, task, true)).toBe(true)
    expect(policy.canViewTask(collaborator, task, false)).toBe(false)
    expect(policy.canViewTask(manager, task, false)).toBe(true)
    expect(policy.canEditTask(collaborator, task)).toBe(false)
    expect(policy.canEditTask(collaborator, ownTask)).toBe(true)
    expect(policy.canEditTask(manager, task)).toBe(true)
    expect(policy.isReadOnlyFor(collaborator, task, true)).toBe(true)
    expect(policy.isReadOnlyFor(collaborator, ownTask, true)).toBe(false)
    expect(policy.isReadOnlyFor(collaborator, task, false)).toBe(false)
    expect(policy.isReadOnlyFor(manager, task, true)).toBe(false)
  })
  it('controla projetos, criação e membros', () => {
    expect(policy.canSeeProject(collaborator, project, true)).toBe(true)
    expect(policy.canSeeProject(collaborator, project, false)).toBe(false)
    expect(policy.canSeeProject(manager, project, false)).toBe(true)
    expect(policy.canCreateTask(collaborator, project, true)).toBe(true)
    expect(policy.canCreateTask(collaborator, project, false)).toBe(false)
    expect(policy.canCreateTask(manager, project, false)).toBe(true)
    expect(policy.canManageMembers(collaborator, project)).toBe(false)
    expect(policy.canManageMembers(collaborator, { ...project, createdBy: user })).toBe(true)
    expect(policy.canManageMembers(manager, project)).toBe(true)
  })
  it('protege valores, total, agenda e dashboard', () => {
    for (const check of [policy.canSeeRate, policy.canEditRate]) {
      expect(check(collaborator, rate)).toBe(true)
      expect(check(collaborator, { ...rate, participant: { kind: 'user', userId: other } })).toBe(
        false,
      )
      expect(
        check(collaborator, {
          ...rate,
          participant: { kind: 'contributor', contributorId: 'c' as ContributorId },
        }),
      ).toBe(false)
      expect(check(manager, rate)).toBe(true)
    }
    for (const check of [
      policy.canSeeTaskTotal,
      policy.canManageMeetings,
      policy.canSeeDashboard,
    ]) {
      expect(check(collaborator, org)).toBe(false)
      expect(check(manager, org)).toBe(true)
      expect(check(manager, otherOrg)).toBe(false)
    }
    expect(policy.isManagerEdit(manager)).toBe(true)
    expect(policy.isManagerEdit(collaborator)).toBe(false)
  })
  it('isola organizações mesmo para gestores e participantes', () => {
    const foreignTask = { ...ownTask, organizationId: otherOrg }
    const foreignProject = { ...project, organizationId: otherOrg, createdBy: user }
    for (const actor of [collaborator, manager]) {
      expect(policy.participates(actor, foreignTask)).toBe(false)
      expect(policy.canViewTask(actor, foreignTask, true)).toBe(false)
      expect(policy.canEditTask(actor, foreignTask)).toBe(false)
      expect(policy.isReadOnlyFor(actor, foreignTask, true)).toBe(false)
      expect(policy.canSeeProject(actor, foreignProject, true)).toBe(false)
      expect(policy.canCreateTask(actor, foreignProject, true)).toBe(false)
      expect(policy.canManageMembers(actor, foreignProject)).toBe(false)
      expect(policy.canSeeRate(actor, { ...rate, organizationId: otherOrg })).toBe(false)
      expect(policy.canEditRate(actor, { ...rate, organizationId: otherOrg })).toBe(false)
    }
  })
})
