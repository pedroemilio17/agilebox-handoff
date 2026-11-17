import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))
const journal = JSON.parse(readFileSync(`${migrationsDirectory}/meta/_journal.json`, 'utf8')) as {
  entries: { tag: string }[]
}
const tags = journal.entries.map((entry) => entry.tag)
// Localiza pela tag: migrações novas depois dela não devem quebrar este teste.
const criteriaMigration = '0014_acceptance_criteria_estimates'
const previous = tags.slice(0, tags.indexOf(criteriaMigration))

function statementsOf(tag: string): string[] {
  return readFileSync(`${migrationsDirectory}/${tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function applyAll(client: BetterSqlite3.Database, list: readonly string[]) {
  for (const tag of list) for (const statement of statementsOf(tag)) client.exec(statement)
}

const ORG = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const OTHER_ORG = '01ARZ3NDEKTSV4RRFFQ69G5FAW'
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FD0'
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FD2'
const TASK = '01ARZ3NDEKTSV4RRFFQ69G5FD4'
const CRITERION = '01ARZ3NDEKTSV4RRFFQ69G5FC0'
const at = '2026-01-01T00:00:00.000Z'

/** Banco como estava antes da migração: uma organização, um gestor, um projeto, uma tarefa com subtarefa. */
function oldDatabase() {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = OFF')
  applyAll(client, previous)
  client
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run(ORG, 'Org', at)
  client
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run(OTHER_ORG, 'Outra', at)
  client
    .prepare(
      'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(USER, ORG, 'Ana', 'a@x.test', 'A', 'manager', 0, at)
  client
    .prepare(
      'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(PROJECT, ORG, 'P', 'p', USER, at)
  client
    .prepare(
      'INSERT INTO tasks (id, organization_id, number, project_id, created_by, title, description, status, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(TASK, ORG, 1, PROJECT, USER, 'T', '', 'todo', 't', at, at)
  client
    .prepare(
      'INSERT INTO task_checklist_items (id, organization_id, task_id, title, done, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run('01ARZ3NDEKTSV4RRFFQ69G5FD8', ORG, TASK, 'Subtarefa antiga', 0, 0, at)
  return client
}

describe('migração de critérios de aceitação e estimativa (0014)', () => {
  it('existe no diário e só cria a tabela, os índices e adiciona a coluna (sem recriar `tasks`)', () => {
    expect(tags).toContain(criteriaMigration)
    const sql = statementsOf(criteriaMigration).join('\n')
    expect(sql).not.toMatch(/DROP TABLE|__new_|DELETE FROM/iu)
    expect(sql).not.toMatch(/CREATE TABLE `tasks`/u)
    expect(sql).toMatch(/CREATE TABLE `task_acceptance_criteria`/u)
    expect(sql).toMatch(/ALTER TABLE `tasks` ADD `estimated_hours_hundredths` integer/u)
  })

  it('não apaga dados antigos: tarefas e subtarefas continuam, com estimativa nula', () => {
    const client = oldDatabase()
    applyAll(client, [criteriaMigration])
    expect(
      client.prepare('SELECT title, estimated_hours_hundredths AS h FROM tasks').all(),
    ).toEqual([{ title: 'T', h: null }])
    expect(client.prepare('SELECT title FROM task_checklist_items').all()).toEqual([
      { title: 'Subtarefa antiga' },
    ])
    client.close()
  })

  it('aceita critérios novos e recusa texto vazio, texto longo e posição negativa', () => {
    const client = oldDatabase()
    applyAll(client, [criteriaMigration])
    const insert = client.prepare(
      'INSERT INTO task_acceptance_criteria (id, organization_id, task_id, text, done, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    insert.run(CRITERION, ORG, TASK, 'Pode ser usado', 0, 0, at, at)
    expect(() => insert.run('01ARZ3NDEKTSV4RRFFQ69G5FC1', ORG, TASK, '', 0, 1, at, at)).toThrow(
      /CHECK/u,
    )
    expect(() =>
      insert.run('01ARZ3NDEKTSV4RRFFQ69G5FC2', ORG, TASK, 'x'.repeat(201), 0, 1, at, at),
    ).toThrow(/CHECK/u)
    expect(() => insert.run('01ARZ3NDEKTSV4RRFFQ69G5FC3', ORG, TASK, 'Ok', 0, -1, at, at)).toThrow(
      /CHECK/u,
    )
    client.close()
  })

  it('apaga os critérios junto com a tarefa (cascade) e não toca nas tarefas de outra organização', () => {
    const client = oldDatabase()
    applyAll(client, [criteriaMigration])
    client.pragma('foreign_keys = ON')
    client
      .prepare(
        'INSERT INTO task_acceptance_criteria (id, organization_id, task_id, text, done, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(CRITERION, ORG, TASK, 'Critério', 0, 0, at, at)
    client.prepare('DELETE FROM tasks WHERE id = ?').run(TASK)
    expect(client.prepare('SELECT COUNT(*) AS n FROM task_acceptance_criteria').get()).toEqual({
      n: 0,
    })
    client.close()
  })

  it('grava a estimativa em centésimos, como inteiro, na coluna nova', () => {
    const client = oldDatabase()
    applyAll(client, [criteriaMigration])
    client.prepare('UPDATE tasks SET estimated_hours_hundredths = ? WHERE id = ?').run(250, TASK)
    expect(client.prepare('SELECT estimated_hours_hundredths AS h FROM tasks').get()).toEqual({
      h: 250,
    })
    client.close()
  })
})
