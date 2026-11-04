import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))

function statementsOf(file: string): string[] {
  return readFileSync(`${migrationsDirectory}/${file}`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function insertTask(
  client: BetterSqlite3.Database,
  row: { id: string; organizationId: string; createdAt: string },
) {
  client
    .prepare(
      `INSERT INTO tasks (id, organization_id, project_id, created_by, title, description, status, search_text, created_at, updated_at)
       VALUES (@id, @organizationId, 'PROJECT', 'USER', 'Tarefa', '', 'planning', 'tarefa', @createdAt, @createdAt)`,
    )
    .run(row)
}

describe('migração 0001: número da tarefa e prefixo da organização', () => {
  it('numera as tarefas antigas por organização, na ordem de criação', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    for (const statement of statementsOf('0000_harsh_miek.sql')) client.exec(statement)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG_A', 'A', '2026-01-01T00:00:00.000Z')
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG_B', 'B', '2026-01-01T00:00:00.000Z')
    insertTask(client, {
      id: 'TASK_C',
      organizationId: 'ORG_A',
      createdAt: '2026-01-03T00:00:00.000Z',
    })
    insertTask(client, {
      id: 'TASK_A',
      organizationId: 'ORG_A',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    insertTask(client, {
      id: 'TASK_B',
      organizationId: 'ORG_A',
      createdAt: '2026-01-02T00:00:00.000Z',
    })
    insertTask(client, {
      id: 'OTHER_1',
      organizationId: 'ORG_B',
      createdAt: '2026-01-02T00:00:00.000Z',
    })

    for (const statement of statementsOf('0001_gorgeous_bill_hollister.sql')) client.exec(statement)

    const numbers = client
      .prepare('SELECT id, number FROM tasks ORDER BY organization_id, number')
      .all()
    expect(numbers).toEqual([
      { id: 'TASK_A', number: 1 },
      { id: 'TASK_B', number: 2 },
      { id: 'TASK_C', number: 3 },
      { id: 'OTHER_1', number: 1 },
    ])
    expect(
      client.prepare('SELECT task_prefix AS prefix FROM organizations WHERE id = ?').get('ORG_A'),
    ).toEqual({ prefix: 'AB' })
    client.close()
  })

  it('impede dois números iguais na mesma organização', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    for (const statement of statementsOf('0000_harsh_miek.sql')) client.exec(statement)
    for (const statement of statementsOf('0001_gorgeous_bill_hollister.sql')) client.exec(statement)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG_A', 'A', '2026-01-01T00:00:00.000Z')
    client
      .prepare(
        `INSERT INTO tasks (id, organization_id, project_id, created_by, title, description, status, search_text, created_at, updated_at, number)
         VALUES ('T1', 'ORG_A', 'P', 'U', 't', '', 'planning', 't', 'x', 'x', 1)`,
      )
      .run()

    expect(() =>
      client
        .prepare(
          `INSERT INTO tasks (id, organization_id, project_id, created_by, title, description, status, search_text, created_at, updated_at, number)
           VALUES ('T2', 'ORG_A', 'P', 'U', 't', '', 'planning', 't', 'x', 'x', 1)`,
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/u)
    client.close()
  })
})
