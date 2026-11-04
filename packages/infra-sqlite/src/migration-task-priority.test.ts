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

function applyUpTo(client: BetterSqlite3.Database, files: readonly string[]) {
  for (const file of files) {
    for (const statement of statementsOf(file)) client.exec(statement)
  }
}

const previous = ['0000_harsh_miek.sql', '0001_gorgeous_bill_hollister.sql']
const priorityMigration = '0002_funny_rictor.sql'

function insertTask(client: BetterSqlite3.Database, id: string, priority?: string) {
  const { next } = client
    .prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM tasks')
    .get() as { next: number }
  const columns = priority === undefined ? '' : ', priority'
  const values = priority === undefined ? '' : ', ?'
  const params: unknown[] = [
    id,
    'ORG',
    next,
    'PROJECT',
    'USER',
    'Tarefa',
    '',
    'planning',
    'tarefa',
    'x',
    'x',
  ]
  if (priority !== undefined) params.push(priority)
  client
    .prepare(
      `INSERT INTO tasks (id, organization_id, number, project_id, created_by, title, description, status, search_text, created_at, updated_at${columns})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${values})`,
    )
    .run(...params)
}

describe('migração 0002: prioridade da tarefa', () => {
  it('preenche tarefas antigas com normal', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyUpTo(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG', 'Org', '2026-01-01T00:00:00.000Z')
    insertTask(client, 'OLD_TASK')
    applyUpTo(client, [priorityMigration])

    expect(client.prepare('SELECT id, priority FROM tasks').all()).toEqual([
      { id: 'OLD_TASK', priority: 'normal' },
    ])
    client.close()
  })

  it('aceita normal e high e recusa outros valores', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyUpTo(client, [...previous, priorityMigration])
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG', 'Org', '2026-01-01T00:00:00.000Z')
    insertTask(client, 'HIGH_TASK', 'high')
    insertTask(client, 'NORMAL_TASK', 'normal')
    expect(() => insertTask(client, 'URGENT_TASK', 'urgent')).toThrow(/CHECK constraint failed/u)
    client.close()
  })
})
