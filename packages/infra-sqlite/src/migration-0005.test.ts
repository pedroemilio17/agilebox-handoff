import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toOrganizationId, toTaskId } from '@agilebox/core'
import { createSqliteClient } from './client.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))
const newMigrationTag = '0005_backlog_criterios_estimativa'

interface JournalEntry {
  readonly idx: number
  readonly tag: string
}

/**
 * Pasta de migrações como estava antes da 0005: as mesmas entradas do diário, sem a nova. Assim o
 * banco é criado no estado do M3.0b, com dados, e a 0005 é aplicada por cima pelo caminho normal.
 */
function legacyMigrationsFolder(directory: string): string {
  const folder = join(directory, 'legacy-migrations')
  mkdirSync(join(folder, 'meta'), { recursive: true })
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: JournalEntry[] }
  const newIndex = journal.entries.findIndex((entry) => entry.tag === newMigrationTag)
  const entries = journal.entries.slice(0, newIndex)
  for (const entry of entries) {
    copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`))
  }
  writeFileSync(
    join(folder, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries }, null, 2),
  )
  return folder
}

const organizationId = toOrganizationId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
const taskOpenId = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FAZ')
const taskArchivedId = toTaskId('01ARZ3NDEKTSV4RRFFQ69G5FB0')

function columnNames(client: ReturnType<typeof createSqliteClient>['$client'], table: string) {
  const rows = client.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.map((row) => row.name)
}

describe('migração 0005 (backlog, estimativa e critérios)', () => {
  it('acrescenta as colunas de backlog e estimativa e cria a tabela de critérios, sem apagar dados', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'agilebox-migracao-0005-'))
    const filename = join(directory, 'agilebox.sqlite')
    try {
      const legacy = createSqliteClient(filename, legacyMigrationsFolder(directory))
      const client = legacy.$client
      const timestamp = '2026-01-01T00:00:00.000Z'
      client
        .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
        .run(organizationId, 'AgileBox Demo', timestamp)
      client
        .prepare(
          'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          organizationId,
          'Pedro',
          'pedro@example.com',
          'PE',
          'manager',
          4500,
          timestamp,
        )
      client
        .prepare(
          'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          '01ARZ3NDEKTSV4RRFFQ69G5FAY',
          organizationId,
          'Projeto A',
          'projeto a',
          '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          timestamp,
          null,
        )
      const insertTask = client.prepare(
        'INSERT INTO tasks (id, organization_id, project_id, created_by, title, description, status, deadline, ticket_id, ticket_url, search_text, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      insertTask.run(
        taskOpenId,
        organizationId,
        '01ARZ3NDEKTSV4RRFFQ69G5FAY',
        '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        'Tarefa antiga',
        '',
        'todo',
        null,
        null,
        null,
        'tarefa antiga projeto a',
        timestamp,
        timestamp,
        null,
      )
      insertTask.run(
        taskArchivedId,
        organizationId,
        '01ARZ3NDEKTSV4RRFFQ69G5FAY',
        '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        'Tarefa arquivada antiga',
        '',
        'done',
        null,
        null,
        null,
        'tarefa arquivada antiga projeto a',
        timestamp,
        timestamp,
        '2026-01-02T00:00:00.000Z',
      )
      client
        .prepare(
          'INSERT INTO task_participations (id, task_id, user_id, contributor_id, role, hours_hundredths, rate_cents, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          '01ARZ3NDEKTSV4RRFFQ69G5FB1',
          taskOpenId,
          '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          null,
          'responsible',
          150,
          4500,
          timestamp,
        )
      legacy.$client.close()

      const upgraded = createSqliteClient(filename)
      try {
        const upgradedClient = upgraded.$client

        expect(columnNames(upgradedClient, 'tasks')).toEqual(
          expect.arrayContaining(['backlog_rank', 'on_board', 'estimated_hours']),
        )
        expect(columnNames(upgradedClient, 'task_criteria')).toEqual([
          'id',
          'organization_id',
          'task_id',
          'text',
          'done',
          'position',
        ])
        const applied = upgradedClient.prepare('SELECT hash FROM __drizzle_migrations').all()
        expect(applied).toHaveLength(7)

        // Tarefas existentes ficam no quadro, sem posição de backlog e sem estimativa.
        const rows = upgradedClient
          .prepare(
            'SELECT id, title, backlog_rank, on_board, estimated_hours, archived_at FROM tasks ORDER BY id',
          )
          .all() as {
          id: string
          title: string
          backlog_rank: number | null
          on_board: number
          estimated_hours: number | null
          archived_at: string | null
        }[]
        expect(rows.map((row) => row.title)).toEqual(['Tarefa antiga', 'Tarefa arquivada antiga'])
        expect(rows.every((row) => row.backlog_rank === null)).toBe(true)
        expect(rows.every((row) => row.on_board === 1)).toBe(true)
        expect(rows.every((row) => row.estimated_hours === null)).toBe(true)
        expect(rows[1]?.archived_at).toBe('2026-01-02T00:00:00.000Z')

        // Pelo repositório: a tarefa aparece no quadro e o envolvimento antigo continua lá.
        const repositories = createSqliteTaskRepositories(upgraded)
        const task = await repositories.tasks.findById(organizationId, taskOpenId)
        expect(task).toMatchObject({
          title: 'Tarefa antiga',
          backlogRank: null,
          onBoard: true,
          estimatedHours: null,
        })
        expect(task?.participations).toHaveLength(1)
        await expect(repositories.tasks.listBacklog(organizationId)).resolves.toEqual([])
      } finally {
        upgraded.$client.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
