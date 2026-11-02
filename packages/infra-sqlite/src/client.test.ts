import { describe, expect, it } from 'vitest'
import { createSqliteClient } from './client.js'

describe('createSqliteClient', () => {
  it('aplica as migrações e cria todas as tabelas num banco vazio', () => {
    const database = createSqliteClient(':memory:')
    const rows = database.$client
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[]

    expect(rows.map((row) => row.name).sort()).toEqual(
      [
        '__drizzle_migrations',
        'organizations',
        'users',
        'contributors',
        'projects',
        'project_members',
        'tasks',
        'task_participations',
        'task_events',
        'task_opens',
        'meetings',
        'meeting_participants',
        'local_settings',
        'team_modules',
        'team_settings',
      ].sort(),
    )

    database.$client.close()
  })

  it('permite reutilizar o nome de um projeto arquivado, mas não entre projetos ativos', () => {
    const database = createSqliteClient(':memory:')
    const client = database.$client
    const insertProject = client.prepare(
      'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )

    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('org-1', 'AgileBox Demo', '2026-01-01T00:00:00.000Z')
    client
      .prepare(
        'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'user-1',
        'org-1',
        'Pedro',
        'pedro@example.com',
        'PE',
        'manager',
        4500,
        '2026-01-01T00:00:00.000Z',
      )

    insertProject.run(
      'p-1',
      'org-1',
      'Projeto A',
      'projeto a',
      'user-1',
      '2026-01-02T00:00:00.000Z',
      null,
    )
    expect(() =>
      insertProject.run(
        'p-2',
        'org-1',
        'Projeto A',
        'projeto a',
        'user-1',
        '2026-01-03T00:00:00.000Z',
        null,
      ),
    ).toThrow(/UNIQUE/)

    client
      .prepare('UPDATE projects SET archived_at = ? WHERE id = ?')
      .run('2026-01-04T00:00:00.000Z', 'p-1')
    expect(() =>
      insertProject.run(
        'p-3',
        'org-1',
        'Projeto A',
        'projeto a',
        'user-1',
        '2026-01-05T00:00:00.000Z',
        null,
      ),
    ).not.toThrow()

    expect(() =>
      insertProject.run(
        'p-4',
        'org-1',
        'Projeto A',
        'projeto a',
        'user-1',
        '2026-01-06T00:00:00.000Z',
        null,
      ),
    ).toThrow(/UNIQUE/)

    client.close()
  })
})
