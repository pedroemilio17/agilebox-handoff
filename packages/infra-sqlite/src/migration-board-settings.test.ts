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
  '0003_flippant_infant_terrible.sql',
  '0004_familiar_zeigeist.sql',
  '0005_task_comments.sql',
]
const boardSettingsMigration = '0006_board_settings.sql'

describe('migração 0006: limites de WIP', () => {
  it('cria board_settings sobre um banco já com dados, sem recriar tabelas', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = ON')
    applyUpTo(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, task_prefix, created_at) VALUES (?, ?, ?, ?)')
      .run('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'Org', 'AB', '2026-01-01T00:00:00.000Z')

    applyUpTo(client, [boardSettingsMigration])

    const columns = client.prepare('PRAGMA table_info(board_settings)').all() as {
      name: string
      notnull: number
      dflt_value: string | null
    }[]
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'organization_id',
      'wip_limits',
      'updated_at',
      'updated_by',
    ])
    expect(columns.find((column) => column.name === 'wip_limits')).toMatchObject({
      notnull: 1,
      dflt_value: "'{}'",
    })
    expect(
      client.prepare('SELECT COUNT(*) AS total FROM organizations').get() as { total: number },
    ).toEqual({ total: 1 })
    client.close()
  })

  it('rejeita JSON inválido em wip_limits', () => {
    const client = new BetterSqlite3(':memory:')
    applyUpTo(client, [...previous, boardSettingsMigration])
    expect(() =>
      client
        .prepare(
          'INSERT INTO board_settings (id, organization_id, wip_limits, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)',
        )
        .run('a', 'org', '{nao-json', '2026-01-01', 'user'),
    ).toThrow(/CHECK/)
    client.close()
  })
})
