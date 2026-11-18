import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))
const journal = JSON.parse(readFileSync(`${migrationsDirectory}/meta/_journal.json`, 'utf8')) as {
  entries: { tag: string }[]
}
const tags = journal.entries.map((entry) => entry.tag)
// Localiza a migração pelo nome: novas migrações depois dela não devem quebrar este teste.
const scheduleMigration = '0021_schedule_dependencies'
const previous = tags.slice(0, tags.indexOf(scheduleMigration))

function statementsOf(tag: string): string[] {
  return readFileSync(`${migrationsDirectory}/${tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function applyAll(client: BetterSqlite3.Database, list: readonly string[]) {
  for (const tag of list) for (const statement of statementsOf(tag)) client.exec(statement)
}

const at = '2026-01-01T00:00:00.000Z'

/** Banco como estava antes do cronograma: organização, usuário, projeto e uma tarefa no quadro. */
function oldDatabase(): BetterSqlite3.Database {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = ON')
  applyAll(client, previous)
  client
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run('ORG', 'Org', at)
  client
    .prepare(
      'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('USER', 'ORG', 'Ana', 'a@x.test', 'A', 'manager', 0, at)
  client
    .prepare(
      'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('PROJECT', 'ORG', 'P', 'p', 'USER', at)
  client
    .prepare(
      'INSERT INTO tasks (id, organization_id, number, project_id, created_by, title, description, status, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('TASK', 'ORG', 1, 'PROJECT', 'USER', 'T', '', 'todo', 't', at, at)
  return client
}

type Column = { name: string; notnull: number; pk: number; dflt_value: string | null }
const columnsOf = (client: BetterSqlite3.Database, table: string) =>
  client.prepare(`PRAGMA table_info(\`${table}\`)`).all() as Column[]
const foreignKeysOf = (client: BetterSqlite3.Database, table: string) =>
  client.prepare(`PRAGMA foreign_key_list(\`${table}\`)`).all() as {
    table: string
    from: string
    to: string
  }[]
const indexesOf = (client: BetterSqlite3.Database, table: string) =>
  (client.prepare(`PRAGMA index_list(\`${table}\`)`).all() as { name: string }[]).map(
    (index) => index.name,
  )

describe('migração do cronograma (início e dependências)', () => {
  it('existe no diário e só cria tabela e índices, com um ADD em `tasks`, sem recriar nada', () => {
    expect(tags).toContain(scheduleMigration)
    const sql = statementsOf(scheduleMigration).join('\n')
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|INSERT INTO `tasks`|__new_tasks/u)
    expect(sql).toMatch(/CREATE TABLE `task_dependencies`/u)
    expect(sql).toMatch(/ALTER TABLE `tasks` ADD `starts_on` text/u)
  })

  it('cria task_dependencies com chave composta, checagem, chaves estrangeiras e índices', () => {
    const client = oldDatabase()
    applyAll(client, [scheduleMigration])

    expect(columnsOf(client, 'task_dependencies').map((column) => column.name)).toEqual([
      'organization_id',
      'predecessor_id',
      'successor_id',
      'created_at',
      'created_by',
    ])
    expect(
      columnsOf(client, 'task_dependencies')
        .filter((column) => column.pk > 0)
        .map((column) => column.name)
        .sort(),
    ).toEqual(['predecessor_id', 'successor_id'])
    expect(foreignKeysOf(client, 'task_dependencies')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'organizations', from: 'organization_id' }),
        expect.objectContaining({ table: 'tasks', from: 'predecessor_id' }),
        expect.objectContaining({ table: 'tasks', from: 'successor_id' }),
        expect.objectContaining({ table: 'users', from: 'created_by' }),
      ]),
    )
    expect(indexesOf(client, 'task_dependencies')).toEqual(
      expect.arrayContaining([
        'task_dependencies_organization_successor_index',
        'task_dependencies_organization_predecessor_index',
      ]),
    )
    const sql = statementsOf(scheduleMigration).join('\n')
    expect(sql).toMatch(
      /CHECK\("task_dependencies"\."predecessor_id" <> "task_dependencies"\."successor_id"\)/u,
    )
  })

  it('recusa dependência de uma tarefa para ela mesma e par repetido', () => {
    const client = oldDatabase()
    applyAll(client, [scheduleMigration])
    expect(() =>
      client
        .prepare(
          'INSERT INTO task_dependencies (organization_id, predecessor_id, successor_id, created_at, created_by) VALUES (?, ?, ?, ?, ?)',
        )
        .run('ORG', 'TASK', 'TASK', at, 'USER'),
    ).toThrow(/CHECK/u)
  })

  it('a tarefa antiga ganha starts_on nulo, e o prazo continua como estava', () => {
    const client = oldDatabase()
    applyAll(client, [scheduleMigration])
    const row = client
      .prepare('SELECT starts_on, deadline FROM tasks WHERE id = ?')
      .get('TASK') as {
      starts_on: string | null
      deadline: string | null
    }
    expect(row).toEqual({ starts_on: null, deadline: null })
  })
})
