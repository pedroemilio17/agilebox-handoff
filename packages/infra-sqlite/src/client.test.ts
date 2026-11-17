import { describe, expect, it } from 'vitest'
import { createSqliteClient } from './client.js'

describe('createSqliteClient', () => {
  it('aplica as migrações e cria todas as tabelas num banco vazio', () => {
    const database = createSqliteClient(':memory:')
    const rows = database.$client
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
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
        'task_acceptance_criteria',
        'task_checklist_items',
        'task_comments',
        'task_events',
        'task_impediments',
        'task_opens',
        'definition_of_done_items',
        'retro_actions',
        'daily_entries',
        'meetings',
        'meeting_participants',
        'local_settings',
        'board_settings',
        'team_modules',
        'team_preferences',
        'team_tools_audit',
        'project_modules',
        'project_setup',
        'guide_progress',
        'sprints',
        'deliverables',
        'milestones',
        'sprint_tasks',
        'task_dependencies',
      ].sort(),
    )

    database.$client.close()
  })
})
