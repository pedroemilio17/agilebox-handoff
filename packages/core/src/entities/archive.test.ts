import { describe, expect, it } from 'vitest'
import { ConflictError } from '../shared/errors'
import type { OrganizationId, ProjectId, TaskId, UserId } from '../shared/ids'
import { createProject, archiveProject, unarchiveProject } from './project'
import { createTask, archiveTask, unarchiveTask } from './task'
import { diffTask, describeEvent } from '../rules/timeline'
import { isHiddenByArchive } from '../rules/archive'

const org = 'org' as OrganizationId
const user = 'user' as UserId
const at = '2026-03-01T10:00:00.000Z'

function aTask() {
  return createTask({
    id: 'task' as TaskId,
    organizationId: org,
    number: 1,
    projectId: 'project' as ProjectId,
    projectName: 'Projeto',
    createdBy: user,
    title: 'Tarefa',
    createdAt: '2026-01-01T00:00:00.000Z',
    responsibleParticipationId: 'p1' as never,
    responsibleRateCents: 0,
  })
}

describe('arquivar tarefa', () => {
  it('nasce ativa e arquivar grava quando e quem, sem apagar nada', () => {
    const task = aTask()
    expect(task.archivedAt).toBeNull()
    expect(task.archivedBy).toBeNull()
    const archived = archiveTask(task, user, at)
    expect(archived).toMatchObject({ archivedAt: at, archivedBy: user, title: 'Tarefa' })
    expect(archived.participations).toEqual(task.participations)
  })
  it('desarquivar limpa os campos e volta a tarefa como estava', () => {
    const task = aTask()
    expect(unarchiveTask(archiveTask(task, user, at))).toEqual(task)
  })
  it('não arquiva de novo nem desarquiva uma tarefa ativa', () => {
    const archived = archiveTask(aTask(), user, at)
    expect(() => archiveTask(archived, user, at)).toThrow(ConflictError)
    expect(() => unarchiveTask(aTask())).toThrow(ConflictError)
  })
  it('a linha do tempo registra arquivar e desarquivar em pt-BR', () => {
    const before = aTask()
    const after = archiveTask(before, user, at)
    expect(diffTask(before, after)).toEqual([])
    const names = { organizationId: org, user: () => 'Ana', contributor: () => 'X' }
    const event = (type: 'task_archived' | 'task_unarchived') => ({
      id: 'e' as never,
      taskId: before.id,
      at,
      actorUserId: user,
      asManager: false,
      type,
      payload: {},
    })
    const viewer = { userId: user, organizationId: org, role: 'collaborator' as const }
    expect(describeEvent(event('task_archived'), viewer, names)).toBe('arquivou a tarefa')
    expect(describeEvent(event('task_unarchived'), viewer, names)).toBe('desarquivou a tarefa')
  })
  it('esconde a tarefa arquivada ou a de projeto arquivado', () => {
    const active = aTask()
    expect(isHiddenByArchive(active, false)).toBe(false)
    expect(isHiddenByArchive(active, true)).toBe(true)
    expect(isHiddenByArchive(archiveTask(active, user, at), false)).toBe(true)
  })
})

describe('arquivar projeto', () => {
  const project = createProject({
    id: 'project' as ProjectId,
    organizationId: org,
    name: 'Projeto A',
    createdBy: user,
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  it('nasce ativo, arquiva com quando e quem, e desarquivar devolve o original', () => {
    expect(project.archivedAt).toBeNull()
    const archived = archiveProject(project, user, at)
    expect(archived).toMatchObject({ archivedAt: at, archivedBy: user })
    expect(unarchiveProject(archived)).toEqual(project)
  })
  it('não arquiva de novo nem desarquiva projeto ativo', () => {
    expect(() => archiveProject(archiveProject(project, user, at), user, at)).toThrow(ConflictError)
    expect(() => unarchiveProject(project)).toThrow(ConflictError)
  })
})
