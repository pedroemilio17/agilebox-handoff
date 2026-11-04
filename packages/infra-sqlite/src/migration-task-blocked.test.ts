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

const previous = [
  '0000_harsh_miek.sql',
  '0001_gorgeous_bill_hollister.sql',
  '0002_funny_rictor.sql',
]
const blockedMigration = '0003_flippant_infant_terrible.sql'

function insertTask(client: BetterSqlite3.Database, id: string, blockedReason?: string) {
  const { next } = client
    .prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM tasks')
    .get() as { next: number }
  const columns = blockedReason === undefined ? '' : ', blocked_reason, blocked_at'
  const values = blockedReason === undefined ? '' : ', ?, ?'
  const params: unknown[] = [
    id,
    'ORG',
    next,
    'PROJECT',
    'USER',
    'Tarefa',
    '',
    'in_progress',
    'tarefa',
    'x',
    'x',
  ]
  if (blockedReason !== undefined) params.push(blockedReason, '2026-01-02T00:00:00.000Z')
  client
    .prepare(
      `INSERT INTO tasks (id, organization_id, number, project_id, created_by, title, description, status, search_text, created_at, updated_at${columns})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${values})`,
    )
    .run(...params)
}

function openDatabase() {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = OFF')
  applyUpTo(client, previous)
  client
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run('ORG', 'Org', '2026-01-01T00:00:00.000Z')
  return client
}

describe('migração 0003: bloqueio da tarefa', () => {
  it('deixa tarefas antigas sem bloqueio', () => {
    const client = openDatabase()
    insertTask(client, 'OLD_TASK')
    applyUpTo(client, [blockedMigration])

    expect(client.prepare('SELECT id, blocked_reason, blocked_at FROM tasks').all()).toEqual([
      { id: 'OLD_TASK', blocked_reason: null, blocked_at: null },
    ])
    client.close()
  })

  it('aceita motivo de 1 a 280 caracteres e recusa motivo vazio ou longo demais', () => {
    const client = openDatabase()
    applyUpTo(client, [blockedMigration])
    insertTask(client, 'BLOCKED_TASK', 'Aguardando credenciais')
    insertTask(client, 'LIMIT_TASK', 'x'.repeat(280))
    expect(() => insertTask(client, 'EMPTY_TASK', '')).toThrow(/CHECK constraint failed/u)
    expect(() => insertTask(client, 'LONG_TASK', 'x'.repeat(281))).toThrow(
      /CHECK constraint failed/u,
    )
    client.close()
  })
})
