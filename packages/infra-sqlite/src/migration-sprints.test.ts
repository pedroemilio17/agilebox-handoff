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
const sprintsMigration = '0015_sprints'
const previous = tags.slice(0, tags.indexOf(sprintsMigration))

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

/** Banco como estava antes das sprints: organização, usuário, projeto e uma tarefa no quadro. */
function oldDatabase(): BetterSqlite3.Database {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = OFF')
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

describe('migração de sprints', () => {
  it('existe no diário e só cria tabelas e índices (não recria `tasks` nem apaga nada)', () => {
    expect(tags).toContain(sprintsMigration)
    const sql = statementsOf(sprintsMigration).join('\n')
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|ALTER TABLE `tasks`|INSERT INTO `tasks`/u)
    expect(sql).toMatch(/CREATE TABLE `sprints`/u)
    expect(sql).toMatch(/CREATE TABLE `sprint_tasks`/u)
    expect(sql).toMatch(/CREATE UNIQUE INDEX `sprints_organization_project_number_unique`/u)
    expect(sql).toMatch(/CREATE UNIQUE INDEX `sprint_tasks_one_open_per_task_unique`/u)
  })

  it('banco antigo recebe as tabelas e a tarefa existente continua intacta', () => {
    const client = oldDatabase()
    applyAll(client, [sprintsMigration])

    expect(client.prepare('SELECT id, title, status, backlog_rank FROM tasks').all()).toEqual([
      { id: 'TASK', title: 'T', status: 'todo', backlog_rank: null },
    ])
    expect(client.prepare('SELECT COUNT(*) AS total FROM sprints').get()).toEqual({ total: 0 })
    expect(client.prepare('SELECT COUNT(*) AS total FROM sprint_tasks').get()).toEqual({ total: 0 })
    client.close()
  })

  it('recusa uma segunda linha aberta para a mesma tarefa (índice parcial), mas aceita depois de fechar', () => {
    const client = oldDatabase()
    applyAll(client, [sprintsMigration])
    client
      .prepare(
        'INSERT INTO sprints (organization_id, id, project_id, number, name, planned_start, planned_end, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('ORG', 'S1', 'PROJECT', 1, 'Sprint 1', '2026-03-02', '2026-03-13', 'draft', 'USER', at)
    client
      .prepare(
        'INSERT INTO sprints (organization_id, id, project_id, number, name, planned_start, planned_end, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('ORG', 'S2', 'PROJECT', 2, 'Sprint 2', '2026-03-16', '2026-03-27', 'draft', 'USER', at)
    const insertRow = client.prepare(
      'INSERT INTO sprint_tasks (organization_id, sprint_id, task_id, added_at, added_by, removed_at, removed_by, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    insertRow.run('ORG', 'S1', 'TASK', at, 'USER', null, null, 'open')
    expect(() => insertRow.run('ORG', 'S2', 'TASK', at, 'USER', null, null, 'open')).toThrow(
      /UNIQUE constraint failed/u,
    )
    client
      .prepare(
        'UPDATE sprint_tasks SET removed_at = ?, removed_by = ?, outcome = ? WHERE sprint_id = ?',
      )
      .run(at, 'USER', 'removed', 'S1')
    expect(() => insertRow.run('ORG', 'S2', 'TASK', at, 'USER', null, null, 'open')).not.toThrow()
    client.close()
  })

  it('o desfecho e o par de datas de saída são checados no banco', () => {
    const client = oldDatabase()
    applyAll(client, [sprintsMigration])
    client
      .prepare(
        'INSERT INTO sprints (organization_id, id, project_id, number, name, planned_start, planned_end, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('ORG', 'S1', 'PROJECT', 1, 'Sprint 1', '2026-03-02', '2026-03-13', 'draft', 'USER', at)
    const insertRow = client.prepare(
      'INSERT INTO sprint_tasks (organization_id, sprint_id, task_id, added_at, added_by, removed_at, removed_by, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    // Linha aberta com desfecho que não é `open` é recusada.
    expect(() => insertRow.run('ORG', 'S1', 'TASK', at, 'USER', null, null, 'removed')).toThrow(
      /CHECK constraint failed/u,
    )
    // Número sequencial único por projeto.
    expect(() =>
      client
        .prepare(
          'INSERT INTO sprints (organization_id, id, project_id, number, name, planned_start, planned_end, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          'ORG',
          'S9',
          'PROJECT',
          1,
          'Repetida',
          '2026-03-02',
          '2026-03-13',
          'draft',
          'USER',
          at,
        ),
    ).toThrow(/UNIQUE constraint failed/u)
    client.close()
  })
})
