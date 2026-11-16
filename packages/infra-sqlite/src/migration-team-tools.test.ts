import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { defaultTeamTools, toOrganizationId } from '@agilebox/core'
import { createSqliteClient } from './client.js'
import { organizations } from './schema/index.js'
import { createSqliteTeamToolsRepository } from './repositories/team-tools-repository.js'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))
const journal = JSON.parse(readFileSync(`${migrationsDirectory}/meta/_journal.json`, 'utf8')) as {
  entries: { tag: string }[]
}
const tags = journal.entries.map((entry) => entry.tag)
// Localiza a migração pelo nome: novas migrações depois dela não devem quebrar este teste.
const teamToolsMigration = '0012_team_tools'
const previous = tags.slice(0, tags.indexOf(teamToolsMigration))

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
const backfillOrganizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const defaults = defaultTeamTools(backfillOrganizationId)
const defaultModuleIds = defaults.modules.map((module) => module.moduleId)

/** Lista de módulos que o backfill grava, lida do próprio SQL da migração. */
function backfillModuleIdsFromSql(): string[] {
  const sql = statementsOf(teamToolsMigration).join('\n')
  const match = /json_each\('(\[[^']*\])'\)/u.exec(sql)
  if (!match) throw new Error('backfill de team_modules não encontrado na migração')
  return JSON.parse(match[1]!) as string[]
}

describe('migração de ferramentas da equipe', () => {
  it('existe no diário, cria só as tabelas novas e não apaga dados', () => {
    expect(tags).toContain(teamToolsMigration)
    const sql = statementsOf(teamToolsMigration).join('\n')
    expect(sql).toMatch(/CREATE TABLE `team_modules`/u)
    expect(sql).toMatch(/CREATE TABLE `team_preferences`/u)
    expect(sql).toMatch(/CREATE TABLE `team_tools_audit`/u)
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|ALTER TABLE `(tasks|projects|users)`/iu)
  })

  it('organizações existentes recebem o padrão de defaultTeamTools (nível Avançado); as criadas depois caem nele também', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyAll(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG', 'Org antiga', createdAt)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG2', 'Outra antiga', createdAt)

    applyAll(client, [teamToolsMigration])

    expect(
      client
        .prepare(
          'SELECT organization_id, experience_level, changed_by, changed_at FROM team_preferences ORDER BY organization_id',
        )
        .all(),
    ).toEqual([
      {
        organization_id: 'ORG',
        experience_level: defaults.level,
        changed_by: null,
        changed_at: null,
      },
      {
        organization_id: 'ORG2',
        experience_level: defaults.level,
        changed_by: null,
        changed_at: null,
      },
    ])
    const modules = client
      .prepare(
        "SELECT module_id, state, config, changed_by, changed_at FROM team_modules WHERE organization_id = 'ORG' ORDER BY module_id",
      )
      .all() as {
      module_id: string
      state: string
      config: unknown
      changed_by: unknown
      changed_at: unknown
    }[]
    expect(modules.map((row) => row.module_id).sort()).toEqual([...defaultModuleIds].sort())
    expect(modules.every((row) => row.state === 'active' && row.config === null)).toBe(true)
    expect(modules.every((row) => row.changed_by === null && row.changed_at === null)).toBe(true)
    client.close()
  })

  it('o backfill grava exatamente a lista e o nível de defaultTeamTools, sem divergir do código', () => {
    expect(backfillModuleIdsFromSql()).toEqual(defaultModuleIds)
    expect(defaults.level).toBe('advanced')
    const sql = statementsOf(teamToolsMigration).join('\n')
    expect(sql).toMatch(/'advanced', NULL, NULL/u)
    expect(defaultModuleIds).not.toContain('estimates.points')
    expect(defaultModuleIds).not.toContain('integrations')
  })

  it('organização criada depois da migração não tem linha e lê o padrão de código', async () => {
    const database = createSqliteClient(':memory:')
    try {
      const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAW')
      database.insert(organizations).values({ id: organizationId, name: 'Nova', createdAt }).run()

      expect(
        database.$client
          .prepare('SELECT COUNT(*) AS total FROM team_preferences WHERE organization_id = ?')
          .get(organizationId),
      ).toEqual({ total: 0 })
      const repository = createSqliteTeamToolsRepository(database)
      await expect(repository.getSettings(organizationId)).resolves.toEqual(
        defaultTeamTools(organizationId),
      )
    } finally {
      database.$client.close()
    }
  })
})
