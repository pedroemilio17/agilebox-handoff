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
const deliverablesMigration = '0020_deliverables_milestones'
const previous = tags.slice(0, tags.indexOf(deliverablesMigration))

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

/** Banco como estava antes das entregas: organização, usuário, projeto e uma tarefa no quadro. */
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

describe('migração de entregas e marcos', () => {
  it('existe no diário e só cria tabelas e índices, sem recriar `tasks` nem apagar nada', () => {
    expect(tags).toContain(deliverablesMigration)
    const sql = statementsOf(deliverablesMigration).join('\n')
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|INSERT INTO `tasks`|__new_tasks/u)
    expect(sql).toMatch(/CREATE TABLE `deliverables`/u)
    expect(sql).toMatch(/CREATE TABLE `milestones`/u)
    expect(sql).toMatch(
      /ALTER TABLE `tasks` ADD `deliverable_id` text REFERENCES deliverables\(id\)/u,
    )
  })

  it('cria as tabelas com colunas, chaves estrangeiras, checagem e índices', () => {
    const client = oldDatabase()
    applyAll(client, [deliverablesMigration])

    expect(columnsOf(client, 'deliverables').map((column) => column.name)).toEqual([
      'organization_id',
      'id',
      'project_id',
      'parent_id',
      'title',
      'position',
      'created_by',
      'created_at',
    ])
    expect(columnsOf(client, 'deliverables').find((c) => c.name === 'parent_id')?.notnull).toBe(0)
    expect(foreignKeysOf(client, 'deliverables')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'organizations', from: 'organization_id' }),
        expect.objectContaining({ table: 'projects', from: 'project_id' }),
        expect.objectContaining({ table: 'deliverables', from: 'parent_id' }),
        expect.objectContaining({ table: 'users', from: 'created_by' }),
      ]),
    )
    expect(indexesOf(client, 'deliverables')).toContain(
      'deliverables_organization_project_parent_position_index',
    )

    expect(columnsOf(client, 'milestones').map((column) => column.name)).toEqual([
      'organization_id',
      'id',
      'project_id',
      'title',
      'due_on',
      'deliverable_id',
      'criterion',
      'created_by',
      'created_at',
    ])
    expect(foreignKeysOf(client, 'milestones')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'deliverables', from: 'deliverable_id' }),
      ]),
    )
    expect(indexesOf(client, 'milestones')).toContain(
      'milestones_organization_project_due_on_index',
    )

    expect(columnsOf(client, 'tasks').find((c) => c.name === 'deliverable_id')?.notnull).toBe(0)
    expect(foreignKeysOf(client, 'tasks')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'deliverables', from: 'deliverable_id' }),
      ]),
    )
    expect(indexesOf(client, 'tasks')).toContain('tasks_organization_deliverable_index')
    client.close()
  })

  it('a checagem de posição recusa valor negativo', () => {
    const client = oldDatabase()
    applyAll(client, [deliverablesMigration])
    expect(() =>
      client
        .prepare(
          'INSERT INTO deliverables (organization_id, id, project_id, title, position, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run('ORG', 'D1', 'PROJECT', 'Fundação', -1, 'USER', at),
    ).toThrow(/CHECK constraint failed/u)
    client.close()
  })

  it('banco com tarefas existentes não falha e `deliverable_id` fica nulo', () => {
    const client = oldDatabase()
    applyAll(client, [deliverablesMigration])

    expect(client.prepare('SELECT id, title, status, deliverable_id FROM tasks').all()).toEqual([
      { id: 'TASK', title: 'T', status: 'todo', deliverable_id: null },
    ])
    expect(client.prepare('SELECT COUNT(*) AS total FROM deliverables').get()).toEqual({ total: 0 })
    expect(client.prepare('SELECT COUNT(*) AS total FROM milestones').get()).toEqual({ total: 0 })
    client.close()
  })
})
