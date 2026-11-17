import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createOrganization, createUser, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor, OrganizationId, UserId } from '@agilebox/core'
import {
  createTenantContext,
  createUseCases,
  type ActorSession,
  type Clock,
  type IdGenerator,
  type TenantContext,
} from '@agilebox/application'
import { aUser } from '@agilebox/application/testing'
import { createSqliteAdapters } from './create-sqlite-adapters.js'

/**
 * Critério do M0: criar, editar, mover e reabrir tarefa persistem. Usa os casos de uso reais sobre
 * SQLite de arquivo: o banco é fechado e reaberto entre as sessões, sem nada em memória.
 */

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const orgA = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const orgB = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
const managerA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX')
const anaA = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAY')
const managerB = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAZ')

const ctx = (actor: Actor): TenantContext => createTenantContext(actor)
const managerContext = ctx({ userId: managerA, organizationId: orgA, role: 'manager' })
const anaContext = ctx({ userId: anaA, organizationId: orgA, role: 'collaborator' })
const managerBContext = ctx({ userId: managerB, organizationId: orgB, role: 'manager' })

function fileDatabase() {
  const dir = mkdtempSync(join(tmpdir(), 'agilebox-task-lifecycle-'))
  dirs.push(dir)
  return join(dir, 'agilebox.db')
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/**
 * Ids de 26 caracteres. Cada sessão começa numa faixa própria, então a segunda não reaproveita ids
 * da primeira (o SequentialIdGenerator recomeçaria do zero e colidiria com o que já está gravado).
 */
function idsFrom(start: number): IdGenerator {
  let next = start
  return {
    generate() {
      let value = next
      next += 1
      let tail = ''
      for (let index = 0; index < 8; index += 1) {
        tail = CROCKFORD[value % 32]! + tail
        value = Math.floor(value / 32)
      }
      return Promise.resolve(`01ARZ3NDEKTSV4RRFF${tail}`)
    },
  }
}

/** Relógio que avança a cada leitura, para a linha do tempo ter ordem estável. */
function clockFrom(second: number): Clock {
  let current = second
  return {
    now() {
      current += 1
      return Promise.resolve(new Date(Date.UTC(2026, 10, 16, 10, 0, current)).toISOString())
    },
  }
}

function useCasesFor(
  adapters: ReturnType<typeof createSqliteAdapters>,
  actor: Actor,
  clock: Clock,
  ids: IdGenerator,
) {
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  return createUseCases({
    ...adapters,
    actorSession,
    changeNotifier: { publish: () => Promise.resolve() },
    clock,
    idGenerator: ids,
  })
}

async function seed(adapters: ReturnType<typeof createSqliteAdapters>) {
  const createdAt = '2026-01-01T00:00:00.000Z'
  await adapters.saveOrganization(
    createOrganization({ id: orgA, name: 'Time A', taskPrefix: 'AAA', createdAt }),
  )
  await adapters.saveOrganization(
    createOrganization({ id: orgB, name: 'Time B', taskPrefix: 'BBB', createdAt }),
  )
  const people: [OrganizationId, UserId, string, 'manager' | 'collaborator'][] = [
    [orgA, managerA, 'Gestora A', 'manager'],
    [orgA, anaA, 'Ana', 'collaborator'],
    [orgB, managerB, 'Gestor B', 'manager'],
  ]
  for (const [organizationId, id, name, role] of people)
    await adapters.users.save(
      organizationId,
      createUser({
        ...aUser().build(),
        id,
        organizationId,
        name,
        role,
        email: `${id}@example.com`,
      }),
    )
}

describe('persistência do ciclo da tarefa em SQLite de arquivo', () => {
  it('criar, editar, mover, concluir e reabrir persistem depois de fechar e reabrir o banco', async () => {
    const file = fileDatabase()

    // Sessão 1: tudo é gravado pelos casos de uso e o banco é fechado.
    const first = createSqliteAdapters(file)
    await seed(first)
    // Um relógio e um gerador de ids por sessão, como no app: todos os atores compartilham os dois.
    const clock = clockFrom(0)
    const ids = idsFrom(0)
    const session1 = useCasesFor(first, managerContext.actor, clock, ids)
    const project = await session1.projects.createProject.execute(managerContext, {
      name: 'Projeto Aurora',
    })
    await session1.projects.addMember.execute(managerContext, {
      projectId: project.id,
      userId: anaA,
    })
    const ana = useCasesFor(first, anaContext.actor, clock, ids)
    const created = await ana.tasks.create.execute(anaContext, {
      projectId: project.id,
      title: 'Revisar contrato',
    })
    await ana.tasks.update.execute(anaContext, {
      taskId: created.id,
      changes: { title: 'Revisar contrato com o jurídico', description: 'Versão 2 do texto' },
    })
    await ana.tasks.move.execute(anaContext, { taskId: created.id, status: 'todo' })
    await ana.tasks.move.execute(anaContext, { taskId: created.id, status: 'in_progress' })
    const manager = useCasesFor(first, managerContext.actor, clock, ids)
    await manager.tasks.update.execute(managerContext, {
      taskId: created.id,
      changes: { priority: 'high' },
    })
    await ana.tasks.move.execute(anaContext, { taskId: created.id, status: 'review' })
    const done = await ana.tasks.move.execute(anaContext, { taskId: created.id, status: 'done' })
    expect(done.status).toBe('done')
    // Reabrir a concluída: volta para Desenvolvendo.
    await ana.tasks.move.execute(anaContext, { taskId: created.id, status: 'in_progress' })
    first.close()

    // Sessão 2: banco reaberto, sem nenhum estado em memória.
    const second = createSqliteAdapters(file)
    try {
      const reopened = useCasesFor(second, anaContext.actor, clockFrom(1000), idsFrom(1_000_000))
      const detail = await reopened.tasks.getDetail.execute(anaContext, { taskId: created.id })
      expect(detail).toMatchObject({
        title: 'Revisar contrato com o jurídico',
        description: 'Versão 2 do texto',
        priority: 'high',
        status: 'in_progress',
      })

      const events = await reopened.timeline.list.execute(anaContext, { taskId: created.id })
      // A linha do tempo vem da mais recente para a mais antiga.
      expect(events.map((event) => [event.type, event.asManager])).toEqual([
        ['status_changed', false],
        ['status_changed', false],
        ['status_changed', false],
        ['priority_changed', true],
        ['status_changed', false],
        ['status_changed', false],
        ['description_edited', false],
        ['renamed', false],
        ['task_created', false],
      ])
      expect(events.find((event) => event.type === 'priority_changed')).toMatchObject({
        actorUserId: managerA,
        asManager: true,
      })

      const board = await reopened.tasks.listBoard.execute(anaContext, { projectId: project.id })
      expect(board.tasks.find((task) => task.id === created.id)?.status).toBe('in_progress')
    } finally {
      second.close()
    }
  })

  it('o isolamento por organização vale depois de reabrir: o time B não lê nem vê a tarefa do time A', async () => {
    const file = fileDatabase()
    const first = createSqliteAdapters(file)
    await seed(first)
    const session1 = useCasesFor(first, managerContext.actor, clockFrom(0), idsFrom(0))
    const project = await session1.projects.createProject.execute(managerContext, {
      name: 'Projeto Aurora',
    })
    const task = await session1.tasks.create.execute(managerContext, {
      projectId: project.id,
      title: 'Tarefa do time A',
    })
    first.close()

    const second = createSqliteAdapters(file)
    try {
      const other = useCasesFor(second, managerBContext.actor, clockFrom(1000), idsFrom(2_000_000))
      await expect(
        other.tasks.getDetail.execute(managerBContext, { taskId: task.id }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(
        other.timeline.list.execute(managerBContext, { taskId: task.id }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      const board = await other.tasks.listBoard.execute(managerBContext, {})
      expect(board.tasks.map((item) => item.id)).not.toContain(task.id)
    } finally {
      second.close()
    }
  })
})
