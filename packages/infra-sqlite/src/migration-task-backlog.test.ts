import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))
const journal = JSON.parse(readFileSync(`${migrationsDirectory}/meta/_journal.json`, 'utf8')) as {
  entries: { tag: string }[]
}
const tags = journal.entries.map((entry) => entry.tag)
// Localiza a migração pelo nome: novas migrações entram depois dela e não devem quebrar este teste.
const backlogMigration = '0013_task_backlog'
const previous = tags.slice(0, tags.indexOf(backlogMigration))

function statementsOf(tag: string): string[] {
  return readFileSync(`${migrationsDirectory}/${tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function applyAll(client: BetterSqlite3.Database, list: readonly string[]) {
  for (const tag of list) for (const statement of statementsOf(tag)) client.exec(statement)
}

describe('migração de posição de backlog', () => {
  it('existe no diário e só adiciona a coluna e o índice (não recria tabelas)', () => {
    expect(tags).toContain(backlogMigration)
    const sql = statementsOf(backlogMigration).join('\n')
    expect(sql).not.toMatch(/CREATE TABLE|DROP TABLE|DELETE FROM/iu)
    expect(sql).toMatch(/ALTER TABLE `tasks` ADD `backlog_rank` integer/u)
    expect(sql).toMatch(/CREATE INDEX `tasks_organization_project_backlog_index`/u)
    expect(sql).toMatch(/\(`organization_id`,`project_id`,`backlog_rank`\)/u)
  })

  it('tarefas antigas ficam no quadro (posição nula) e aceitam posição de backlog depois', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyAll(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG', 'Org', '2026-01-01T00:00:00.000Z')
    client
      .prepare(
        'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('USER', 'ORG', 'Ana', 'a@x.test', 'A', 'manager', 0, '2026-01-01T00:00:00.000Z')
    client
      .prepare(
        'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('PROJECT', 'ORG', 'P', 'p', 'USER', '2026-01-01T00:00:00.000Z')
    client
      .prepare(
        'INSERT INTO tasks (id, organization_id, number, project_id, created_by, title, description, status, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'TASK',
        'ORG',
        1,
        'PROJECT',
        'USER',
        'T',
        '',
        'todo',
        't',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      )

    applyAll(client, [backlogMigration])

    expect(client.prepare('SELECT backlog_rank FROM tasks').all()).toEqual([{ backlog_rank: null }])
    client.prepare('UPDATE tasks SET backlog_rank = ?').run(1024)
    expect(client.prepare('SELECT backlog_rank FROM tasks').get()).toEqual({ backlog_rank: 1024 })
    client.close()
  })
})
