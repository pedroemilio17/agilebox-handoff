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
]
const meetingFieldsMigration = '0007_meeting_fields.sql'

describe('migração 0007: campos de agendamento', () => {
  it('adiciona colunas sobre agendamentos existentes, com padrões, sem recriar a tabela', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyUpTo(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, task_prefix, created_at) VALUES (?, ?, ?, ?)')
      .run('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'Org', 'AB', '2026-01-01T00:00:00.000Z')
    client
      .prepare(
        'INSERT INTO meetings (id, organization_id, title, date, time, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'a',
        '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        'Antiga',
        '2026-11-02',
        '09:00',
        'u',
        '2026-01-01',
        '2026-01-01',
      )

    applyUpTo(client, [meetingFieldsMigration])

    const columns = client.prepare('PRAGMA table_info(meetings)').all() as {
      name: string
      notnull: number
      dflt_value: string | null
    }[]
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'organization_id',
      'title',
      'date',
      'time',
      'created_by',
      'created_at',
      'updated_at',
      'end_time',
      'kind',
      'recurrence',
      'recurrence_until',
    ])
    expect(columns.find((column) => column.name === 'kind')).toMatchObject({
      notnull: 1,
      dflt_value: "'meeting'",
    })
    expect(columns.find((column) => column.name === 'recurrence')).toMatchObject({
      notnull: 1,
      dflt_value: "'none'",
    })
    expect(client.prepare('SELECT * FROM meetings').get()).toMatchObject({
      title: 'Antiga',
      end_time: null,
      kind: 'meeting',
      recurrence: 'none',
      recurrence_until: null,
    })
    client.close()
  })

  it('rejeita tipo e repetição fora dos valores previstos', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyUpTo(client, [...previous, meetingFieldsMigration])
    const insert = client.prepare(
      'INSERT INTO meetings (id, organization_id, title, date, time, kind, recurrence, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    expect(() =>
      insert.run('a', 'org', 'T', '2026-11-02', '09:00', 'prazo', 'none', 'u', 'x', 'x'),
    ).toThrow(/CHECK/)
    expect(() =>
      insert.run('b', 'org', 'T', '2026-11-02', '09:00', 'meeting', 'daily', 'u', 'x', 'x'),
    ).toThrow(/CHECK/)
    expect(() =>
      insert.run('c', 'org', 'T', '2026-11-02', '09:00', 'retro', 'weekly', 'u', 'x', 'x'),
    ).not.toThrow()
    client.close()
  })
})
