import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createTimelineEvent,
  diffTask,
  renameTask,
  setStatus,
  toEventId,
  toOrganizationId,
} from '@agilebox/core'
import type { Task, TimelineEvent } from '@agilebox/core'
import { aProject, aTask, aUser } from '@agilebox/application/testing'
import { createSqliteAdapters } from './create-sqlite-adapters.js'

describe('createSqliteAdapters', () => {
  it('monta todas as portas usando o mesmo banco', async () => {
    const adapters = createSqliteAdapters(':memory:')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')

    try {
      await expect(
        adapters.unitOfWork.run(organizationId, (repositories) =>
          repositories.users.list(organizationId),
        ),
      ).resolves.toEqual([])
      expect(adapters.meetings).toBeDefined()
      expect(adapters.tasks).toBeDefined()
      expect(adapters.timeline).toBeDefined()
    } finally {
      adapters.close()
    }
  })

  it('persiste criação, edição e mudança de estado após fechar e reabrir o banco', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'agilebox-persistencia-'))
    const filename = join(directory, 'agilebox.sqlite')
    const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const user = aUser().with({ organizationId }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    const createdTask = aTask()
      .with({ organizationId, projectId: project.id, projectName: project.name })
      .build()
    const renamedTask: Task = renameTask(createdTask, 'Tarefa revisada')
    const movedTask: Task = setStatus(renamedTask, 'in_progress')
    const renamedAt = '2026-01-02T10:00:00.000Z'
    const movedAt = '2026-01-03T10:00:00.000Z'
    const edited: Task = { ...renamedTask, updatedAt: renamedAt }
    const moved: Task = { ...movedTask, updatedAt: movedAt }
    const eventBase = (id: string, at: string) => ({
      id: toEventId(id),
      taskId: createdTask.id,
      at,
      actorUserId: user.id,
      asManager: false,
    })
    const createdEvent: TimelineEvent = createTimelineEvent({
      ...eventBase('01ARZ3NDEKTSV4RRFFQ69G5FB1', createdTask.createdAt),
      type: 'task_created',
      payload: {},
    })
    const renamedEvent = createTimelineEvent({
      ...diffTask(createdTask, edited)[0]!,
      ...eventBase('01ARZ3NDEKTSV4RRFFQ69G5FB2', renamedAt),
    })
    const movedEvent = createTimelineEvent({
      ...diffTask(edited, moved)[0]!,
      ...eventBase('01ARZ3NDEKTSV4RRFFQ69G5FB3', movedAt),
    })

    const first = createSqliteAdapters(filename)
    try {
      await first.saveOrganization({
        id: organizationId,
        name: 'AgileBox',
        createdAt: user.createdAt,
      })
      await first.users.save(organizationId, user)
      await first.projects.save(organizationId, project)
      await first.unitOfWork.run(organizationId, async (repositories) => {
        await repositories.tasks.save(organizationId, createdTask)
        await repositories.timeline.saveMany(organizationId, [createdEvent])
      })
      await first.unitOfWork.run(organizationId, async (repositories) => {
        await repositories.tasks.save(organizationId, edited)
        await repositories.timeline.saveMany(organizationId, [renamedEvent])
      })
      await first.unitOfWork.run(organizationId, async (repositories) => {
        await repositories.tasks.save(organizationId, moved)
        await repositories.timeline.saveMany(organizationId, [movedEvent])
      })
    } finally {
      first.close()
    }

    const second = createSqliteAdapters(filename)
    try {
      await expect(second.tasks.findById(organizationId, createdTask.id)).resolves.toEqual(moved)
      await expect(second.timeline.listByTask(organizationId, createdTask.id)).resolves.toEqual([
        movedEvent,
        renamedEvent,
        createdEvent,
      ])
    } finally {
      second.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
