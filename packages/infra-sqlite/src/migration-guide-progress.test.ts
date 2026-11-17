import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))
const journal = JSON.parse(readFileSync(`${migrationsDirectory}/meta/_journal.json`, 'utf8')) as {
  entries: { tag: string }[]
}
const tags = journal.entries.map((entry) => entry.tag)
// Localiza a migração pelo nome: migrações depois dela não devem quebrar este teste.
const guideProgressMigration = '0019_overconfident_wendell_rand'
const previous = tags.slice(0, tags.indexOf(guideProgressMigration))

function statementsOf(tag: string): string[] {
  return readFileSync(`${migrationsDirectory}/${tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function applyAll(client: BetterSqlite3.Database, list: readonly string[]) {
  for (const tag of list) for (const statement of statementsOf(tag)) client.exec(statement)
}

const createdAt = '2026-01-01T00:00:00.000Z'

/** Banco na migração anterior à 0019, com uma organização, uma pessoa e um projeto. */
function seedBeforeMigration(): BetterSqlite3.Database {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = ON')
  applyAll(client, previous)
  client
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run('ORG_A', 'Equipe A', createdAt)
  client
    .prepare(
      'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('USER_A', 'ORG_A', 'Ana', 'ana@example.com', 'AN', 'manager', 0, createdAt)
  client
    .prepare(
      'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('PROJ_A1', 'ORG_A', 'Projeto A1', 'a1', 'USER_A', createdAt)
  return client
}

interface ColumnInfo {
  name: string
  notnull: number
  pk: number
  dflt_value: string | null
}

describe('migração do progresso do guia (0019)', () => {
  it('existe no diário, só cria a tabela e o índice (sem recriar nem apagar nada)', () => {
    expect(tags).toContain(guideProgressMigration)
    const sql = statementsOf(guideProgressMigration).join('\n')
    expect(sql).toMatch(/CREATE TABLE `guide_progress`/u)
    expect(sql).toMatch(/CREATE INDEX `guide_progress_organization_project_user_idx`/u)
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|ALTER TABLE|INSERT INTO/iu)
  })

  it('cria as colunas, com dispensa falsa por padrão e sem backfill nos projetos existentes', () => {
    const client = seedBeforeMigration()
    applyAll(client, [guideProgressMigration])

    const columns = client.prepare('PRAGMA table_info(guide_progress)').all() as ColumnInfo[]
    expect(columns.map((column) => column.name)).toEqual([
      'organization_id',
      'project_id',
      'user_id',
      'step_key',
      'done_at',
      'dismissed',
    ])
    expect(columns.find((column) => column.name === 'done_at')?.notnull).toBe(0)
    expect(columns.find((column) => column.name === 'dismissed')?.dflt_value).toBe('false')
    expect(client.prepare('SELECT COUNT(*) AS total FROM guide_progress').get()).toEqual({
      total: 0,
    })
  })

  it('chave primária composta (projeto, pessoa, passo)', () => {
    const client = seedBeforeMigration()
    applyAll(client, [guideProgressMigration])

    const columns = client.prepare('PRAGMA table_info(guide_progress)').all() as ColumnInfo[]
    const primaryKey = columns
      .filter((column) => column.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((column) => column.name)
    expect(primaryKey).toEqual(['project_id', 'user_id', 'step_key'])
  })

  it('chaves estrangeiras para organizations, projects e users', () => {
    const client = seedBeforeMigration()
    applyAll(client, [guideProgressMigration])

    const foreignKeys = client.prepare('PRAGMA foreign_key_list(guide_progress)').all() as {
      from: string
      table: string
    }[]
    expect(
      foreignKeys
        .map((fk) => [fk.from, fk.table])
        .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? '')),
    ).toEqual([
      ['organization_id', 'organizations'],
      ['project_id', 'projects'],
      ['user_id', 'users'],
    ])
  })

  it('CHECK recusa dispensa fora de 0 e 1', () => {
    const client = seedBeforeMigration()
    applyAll(client, [guideProgressMigration])

    expect(() =>
      client
        .prepare(
          'INSERT INTO guide_progress (organization_id, project_id, user_id, step_key, done_at, dismissed) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('ORG_A', 'PROJ_A1', 'USER_A', 'agil.backlog', createdAt, 2),
    ).toThrow(/CHECK constraint failed/u)
  })

  it('a chave composta impede duas linhas para o mesmo passo da mesma pessoa no projeto', () => {
    const client = seedBeforeMigration()
    applyAll(client, [guideProgressMigration])
    const insert = client.prepare(
      'INSERT INTO guide_progress (organization_id, project_id, user_id, step_key, done_at, dismissed) VALUES (?, ?, ?, ?, ?, ?)',
    )
    insert.run('ORG_A', 'PROJ_A1', 'USER_A', 'agil.backlog', createdAt, 0)

    expect(() => insert.run('ORG_A', 'PROJ_A1', 'USER_A', 'agil.backlog', createdAt, 0)).toThrow(
      /UNIQUE constraint failed/u,
    )
  })

  it('a chave estrangeira recusa projeto ou pessoa inexistentes', () => {
    const client = seedBeforeMigration()
    applyAll(client, [guideProgressMigration])
    const insert = client.prepare(
      'INSERT INTO guide_progress (organization_id, project_id, user_id, step_key, done_at, dismissed) VALUES (?, ?, ?, ?, ?, ?)',
    )

    expect(() => insert.run('ORG_A', 'PROJ_X', 'USER_A', 'agil.backlog', createdAt, 0)).toThrow(
      /FOREIGN KEY constraint failed/u,
    )
    expect(() => insert.run('ORG_A', 'PROJ_A1', 'USER_X', 'agil.backlog', createdAt, 0)).toThrow(
      /FOREIGN KEY constraint failed/u,
    )
  })
})
