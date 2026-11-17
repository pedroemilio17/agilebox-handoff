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
const auditConfigMigration = '0017_team_tools_audit_config'
const previous = tags.slice(0, tags.indexOf(auditConfigMigration))

function statementsOf(tag: string): string[] {
  return readFileSync(`${migrationsDirectory}/${tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function applyAll(client: BetterSqlite3.Database, list: readonly string[]) {
  for (const tag of list) for (const statement of statementsOf(tag)) client.exec(statement)
}

const createdAt = '2026-11-16T10:00:00.000Z'

describe('migração da auditoria de configuração (regra 7)', () => {
  it('está no diário, recria só team_tools_audit e não toca em tarefas', () => {
    expect(tags).toContain(auditConfigMigration)
    const sql = statementsOf(auditConfigMigration).join('\n')
    expect(sql).toMatch(/CREATE TABLE `__new_team_tools_audit`/u)
    expect(sql).toMatch(/'config'/u)
    expect(sql).not.toMatch(
      /(DROP TABLE|ALTER TABLE) `(tasks|projects|users|organizations|team_modules|team_preferences)`/u,
    )
    expect(sql).not.toMatch(/DELETE FROM/iu)
  })

  it('banco antigo: as linhas de auditoria existentes sobrevivem, com os mesmos dados', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    try {
      applyAll(client, previous)
      client
        .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
        .run('ORG', 'Time', createdAt)
      const insert = client.prepare(
        'INSERT INTO team_tools_audit (organization_id, actor_id, kind, module_id, before, after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      insert.run('ORG', 'MGR', 'module_state', 'impediments', 'active', 'disabled', createdAt)
      insert.run('ORG', 'MGR', 'level', null, 'advanced', 'basic', createdAt)
      insert.run('ORG', 'MGR', 'preset', null, null, 'kanban', createdAt)
      const before = client.prepare('SELECT * FROM team_tools_audit ORDER BY id').all()

      applyAll(client, [auditConfigMigration])

      expect(client.prepare('SELECT * FROM team_tools_audit ORDER BY id').all()).toEqual(before)
      expect(before).toHaveLength(3)
    } finally {
      client.close()
    }
  })

  it('depois da migração aceita config com módulo e recusa config sem módulo e kind desconhecido', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    try {
      applyAll(client, [...previous, auditConfigMigration])
      // A migração liga as chaves estrangeiras de novo; este teste não grava usuários, então desliga.
      client.pragma('foreign_keys = OFF')
      client
        .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
        .run('ORG', 'Time', createdAt)
      const insert = client.prepare(
        'INSERT INTO team_tools_audit (organization_id, actor_id, kind, module_id, before, after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )

      expect(() =>
        insert.run('ORG', 'MGR', 'config', 'sprints', null, '{"maxActiveSprints":3}', createdAt),
      ).not.toThrow()
      expect(() =>
        insert.run('ORG', 'MGR', 'config', null, null, '{"maxActiveSprints":3}', createdAt),
      ).toThrow(/CHECK constraint/u)
      expect(() =>
        insert.run('ORG', 'MGR', 'module_state', null, 'active', 'disabled', createdAt),
      ).toThrow(/CHECK constraint/u)
      expect(() => insert.run('ORG', 'MGR', 'bogus', null, null, null, createdAt)).toThrow(
        /CHECK constraint/u,
      )
      expect(
        client.prepare("SELECT kind, module_id FROM team_tools_audit WHERE kind = 'config'").all(),
      ).toEqual([{ kind: 'config', module_id: 'sprints' }])
    } finally {
      client.close()
    }
  })
})
