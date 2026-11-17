import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { reorderInBacklog, toOrganizationId, toParticipationId, toTaskId } from '@agilebox/core'
import { aProject, aTask, aUser } from '@agilebox/application/testing'
import { createSqliteClient } from '../client.js'
import { organizations } from '../schema/organizations.js'
import { createSqliteCoreRepositories } from './core-repositories.js'
import { createSqliteTaskRepositories } from './task-repositories.js'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')

/** Banco em arquivo: a ordem do backlog precisa sobreviver a fechar e reabrir o banco. */
function fileDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'agilebox-backlog-'))
  dirs.push(dir)
  return join(dir, 'agilebox.db')
}

describe('persistência da posição no backlog', () => {
  it('reordenar grava a posição e a ordem sobrevive a reabrir o banco', async () => {
    const file = fileDatabase()
    const user = aUser().with({ organizationId }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    const first = aTask()
      .with({
        id: taskIdOf('5CA1'),
        responsibleParticipationId: participationIdOf('5CA1'),
        organizationId,
        projectId: project.id,
        projectName: project.name,
        createdBy: user.id,
        number: 1,
      })
      .build()
    const second = aTask()
      .with({
        id: taskIdOf('5CA2'),
        responsibleParticipationId: participationIdOf('5CA2'),
        organizationId,
        projectId: project.id,
        projectName: project.name,
        createdBy: user.id,
        number: 2,
      })
      .build()
    const third = aTask()
      .with({
        id: taskIdOf('5CA3'),
        responsibleParticipationId: participationIdOf('5CA3'),
        organizationId,
        projectId: project.id,
        projectName: project.name,
        createdBy: user.id,
        number: 3,
      })
      .build()

    const database = createSqliteClient(file)
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    const tasks = createSqliteTaskRepositories(database)
    await core.users.save(organizationId, user)
    await core.projects.save(organizationId, project)
    await tasks.tasks.save(organizationId, { ...first, backlogRank: 1024 })
    await tasks.tasks.save(organizationId, { ...second, backlogRank: 2048 })
    await tasks.tasks.save(organizationId, { ...third, backlogRank: 3072 })

    // Leva a terceira para o topo e grava só o que mudou.
    const backlog = await tasks.tasks.listBacklog(organizationId, project.id)
    const move = reorderInBacklog(backlog, third.id, { to: 'top' })
    await tasks.tasks.updateBacklogRanks(organizationId, move.changes)
    database.$client.close()

    const reopened = createSqliteClient(file)
    const again = createSqliteTaskRepositories(reopened)
    const order = await again.tasks.listBacklog(organizationId, project.id)
    expect(order.map((task) => task.id)).toEqual([third.id, first.id, second.id])
    await expect(again.tasks.findById(organizationId, third.id)).resolves.toMatchObject({
      backlogRank: move.changes.find((change) => change.taskId === third.id)?.backlogRank,
    })
    reopened.$client.close()
  })

  it('salvar uma tarefa sem posição a tira do backlog', async () => {
    const file = fileDatabase()
    const user = aUser().with({ organizationId }).build()
    const project = aProject().with({ organizationId, createdBy: user.id }).build()
    const task = aTask()
      .with({
        id: taskIdOf('5CB1'),
        responsibleParticipationId: participationIdOf('5CB1'),
        organizationId,
        projectId: project.id,
        projectName: project.name,
        createdBy: user.id,
        number: 4,
      })
      .build()
    const database = createSqliteClient(file)
    await database
      .insert(organizations)
      .values({ id: organizationId, name: 'AgileBox', createdAt: user.createdAt })
    const core = createSqliteCoreRepositories(database)
    const tasks = createSqliteTaskRepositories(database)
    await core.users.save(organizationId, user)
    await core.projects.save(organizationId, project)
    await tasks.tasks.save(organizationId, { ...task, backlogRank: 1024 })
    await tasks.tasks.save(organizationId, { ...task, backlogRank: null })
    await expect(tasks.tasks.listBacklog(organizationId, project.id)).resolves.toEqual([])
    await expect(tasks.tasks.findById(organizationId, task.id)).resolves.toEqual(task)
    database.$client.close()
  })
})

function taskIdOf(suffix: string) {
  return toTaskId(`01ARZ3NDEKTSV4RRFFQ69G${suffix}`)
}

function participationIdOf(suffix: string) {
  return toParticipationId(`01ARZ3NDEKTSV4RRFFQ69G${suffix.replace(/^./u, 'D')}`)
}
