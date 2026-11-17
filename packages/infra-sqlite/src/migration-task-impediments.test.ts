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
const impedimentsMigration = '0016_task_impediments'
const previous = tags.slice(0, tags.indexOf(impedimentsMigration))

function statementsOf(tag: string): string[] {
  return readFileSync(`${migrationsDirectory}/${tag}.sql`, 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function applyAll(client: BetterSqlite3.Database, list: readonly string[]) {
  for (const tag of list) for (const statement of statementsOf(tag)) client.exec(statement)
}

const at = '2026-01-01T00:00:00.000Z'
const ANA = '00000000000000000000000010'
const BIA = '00000000000000000000000011'

/** Banco como estava antes dos impedimentos: duas pessoas, um projeto e tarefas bloqueada ou não. */
function oldDatabase(): BetterSqlite3.Database {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = OFF')
  applyAll(client, previous)
  client
    .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run('ORG', 'Org', at)
  const user = client.prepare(
    'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  user.run(ANA, 'ORG', 'Ana', 'a@x.test', 'A', 'manager', 0, at)
  user.run(BIA, 'ORG', 'Bia', 'b@x.test', 'B', 'collaborator', 0, at)
  client
    .prepare(
      'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('PROJECT', 'ORG', 'P', 'p', ANA, at)
  return client
}

function insertTask(
  client: BetterSqlite3.Database,
  id: string,
  number: number,
  blocked?: { reason: string; at: string },
) {
  const columns = blocked ? ', blocked_reason, blocked_at' : ''
  const values = blocked ? ', ?, ?' : ''
  const params: unknown[] = [id, 'ORG', number, 'PROJECT', ANA, 'T', '', 'in_progress', 't', at, at]
  if (blocked) params.push(blocked.reason, blocked.at)
  client
    .prepare(
      `INSERT INTO tasks (id, organization_id, number, project_id, created_by, title, description, status, search_text, created_at, updated_at${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${values})`,
    )
    .run(...params)
}

function insertBlockedEvent(
  client: BetterSqlite3.Database,
  id: string,
  taskId: string,
  actor: string,
  eventAt: string,
) {
  client
    .prepare(
      'INSERT INTO task_events (id, task_id, at, actor_user_id, as_manager, type, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, taskId, eventAt, actor, 0, 'blocked', '{"reason":"x"}')
}

describe('migração 0016: impedimentos', () => {
  it('existe no diário, só cria a tabela e os índices, e não recria `tasks`', () => {
    expect(tags).toContain(impedimentsMigration)
    const sql = statementsOf(impedimentsMigration).join('\n')
    expect(sql).not.toMatch(
      /DROP TABLE|ALTER TABLE `tasks`|INSERT INTO `tasks`|DELETE FROM `tasks`/u,
    )
    expect(sql).toMatch(/CREATE TABLE `task_impediments`/u)
    expect(sql).toMatch(/CREATE UNIQUE INDEX `task_impediments_one_open_per_task_unique`/u)
    expect(sql).toMatch(/WHERE "task_impediments"\."status" = 'open'/u)
  })

  it('backfill: tarefa bloqueada vira impedimento aberto, com o autor do último bloqueio e sem responsável', () => {
    const client = oldDatabase()
    insertTask(client, 'BLOCKED_BY_BIA', 1, {
      reason: 'Aguardando acesso',
      at: '2026-01-05T10:00:00.000Z',
    })
    insertBlockedEvent(client, 'E1', 'BLOCKED_BY_BIA', ANA, '2026-01-02T10:00:00.000Z')
    insertBlockedEvent(client, 'E2', 'BLOCKED_BY_BIA', BIA, '2026-01-04T10:00:00.000Z')
    insertTask(client, 'NOT_BLOCKED', 2)
    applyAll(client, [impedimentsMigration])

    expect(
      client
        .prepare(
          'SELECT id, task_id, reason, status, owner_id, opened_by, opened_at, resolved_by, resolved_at, resolution FROM task_impediments',
        )
        .all(),
    ).toEqual([
      {
        id: 'BLOCKED_BY_BIA',
        task_id: 'BLOCKED_BY_BIA',
        reason: 'Aguardando acesso',
        status: 'open',
        owner_id: null,
        opened_by: BIA,
        opened_at: '2026-01-05T10:00:00.000Z',
        resolved_by: null,
        resolved_at: null,
        resolution: null,
      },
    ])
    client.close()
  })

  it('backfill: sem evento de bloqueio, o autor é o criador da tarefa; tarefas antigas continuam intactas', () => {
    const client = oldDatabase()
    insertTask(client, 'NO_EVENT', 1, { reason: 'Rede', at: '2026-01-06T10:00:00.000Z' })
    applyAll(client, [impedimentsMigration])

    expect(
      client
        .prepare('SELECT opened_by, opened_at FROM task_impediments WHERE task_id = ?')
        .get('NO_EVENT'),
    ).toEqual({ opened_by: ANA, opened_at: '2026-01-06T10:00:00.000Z' })
    expect(client.prepare('SELECT id, blocked_reason FROM tasks').all()).toEqual([
      { id: 'NO_EVENT', blocked_reason: 'Rede' },
    ])
    client.close()
  })

  it('depois da migração, um segundo impedimento aberto na mesma tarefa é recusado pelo banco', () => {
    const client = oldDatabase()
    insertTask(client, 'T', 1, { reason: 'Rede', at: at })
    applyAll(client, [impedimentsMigration])
    const insert = client.prepare(
      'INSERT INTO task_impediments (organization_id, id, task_id, reason, status, owner_id, opened_by, opened_at, resolved_by, resolved_at, resolution) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    expect(() =>
      insert.run('ORG', 'NEW', 'T', 'Outro', 'open', null, ANA, at, null, null, null),
    ).toThrow(/UNIQUE constraint failed/u)
    // Resolver o aberto libera a vaga para um novo registro aberto.
    client
      .prepare(
        "UPDATE task_impediments SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolution = ? WHERE id = 'T'",
      )
      .run(ANA, at, 'Ok')
    expect(() =>
      insert.run('ORG', 'NEW', 'T', 'Outro', 'open', null, ANA, at, null, null, null),
    ).not.toThrow()
    client.close()
  })

  it('o estado e o par de datas de resolução são checados no banco', () => {
    const client = oldDatabase()
    applyAll(client, [impedimentsMigration])
    const insert = client.prepare(
      'INSERT INTO task_impediments (organization_id, id, task_id, reason, status, owner_id, opened_by, opened_at, resolved_by, resolved_at, resolution) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    insertTask(client, 'T', 1)
    // Aberto com data de resolução, ou resolvido sem data, é recusado.
    expect(() => insert.run('ORG', 'A', 'T', 'x', 'open', null, ANA, at, ANA, at, null)).toThrow(
      /CHECK constraint failed/u,
    )
    expect(() =>
      insert.run('ORG', 'B', 'T', 'x', 'resolved', null, ANA, at, null, null, null),
    ).toThrow(/CHECK constraint failed/u)
    // Motivo vazio e nota longa demais também.
    expect(() => insert.run('ORG', 'C', 'T', '', 'open', null, ANA, at, null, null, null)).toThrow(
      /CHECK constraint failed/u,
    )
    expect(() =>
      insert.run('ORG', 'D', 'T', 'x', 'resolved', null, ANA, at, ANA, at, 'x'.repeat(281)),
    ).toThrow(/CHECK constraint failed/u)
    client.close()
  })
})
