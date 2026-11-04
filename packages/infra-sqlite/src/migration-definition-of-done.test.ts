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
  '0006_board_settings.sql',
  '0007_meeting_fields.sql',
]
const definitionOfDoneMigration = '0008_definition_of_done.sql'

describe('migração 0008: definição de pronto', () => {
  it('cria definition_of_done_items e o índice por projeto, sem recriar tabelas', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = ON')
    applyUpTo(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, task_prefix, created_at) VALUES (?, ?, ?, ?)')
      .run('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'Org', 'AB', '2026-01-01T00:00:00.000Z')

    applyUpTo(client, [definitionOfDoneMigration])

    const columns = client.prepare('PRAGMA table_info(definition_of_done_items)').all() as {
      name: string
      notnull: number
    }[]
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'organization_id',
      'project_id',
      'title',
      'position',
    ])
    expect(columns.filter((column) => column.notnull === 1)).toHaveLength(5)
    const indexes = client.prepare("PRAGMA index_list('definition_of_done_items')").all() as {
      name: string
    }[]
    expect(indexes.map((index) => index.name)).toContain(
      'definition_of_done_items_project_position_index',
    )
    expect(
      client.prepare('SELECT COUNT(*) AS total FROM organizations').get() as { total: number },
    ).toEqual({ total: 1 })
    client.close()
  })

  it('rejeita título vazio ou com mais de 200 caracteres', () => {
    const client = new BetterSqlite3(':memory:')
    applyUpTo(client, [...previous, definitionOfDoneMigration])
    const insert = client.prepare(
      'INSERT INTO definition_of_done_items (id, organization_id, project_id, title, position) VALUES (?, ?, ?, ?, ?)',
    )
    expect(() => insert.run('a', 'org', 'project', '', 0)).toThrow(/CHECK/)
    expect(() => insert.run('b', 'org', 'project', 'x'.repeat(201), 0)).toThrow(/CHECK/)
    expect(() => insert.run('c', 'org', 'project', 'Testes', -1)).toThrow(/CHECK/)
    client.close()
  })
})
