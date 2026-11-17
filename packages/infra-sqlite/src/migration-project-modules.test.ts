import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TEAM_MODULE_IDS } from '@agilebox/core'

const migrationsDirectory = fileURLToPath(new URL('../migrations', import.meta.url))
const journal = JSON.parse(readFileSync(`${migrationsDirectory}/meta/_journal.json`, 'utf8')) as {
  entries: { tag: string }[]
}
const tags = journal.entries.map((entry) => entry.tag)
// Localiza a migração pelo nome: novas migrações depois dela não devem quebrar este teste.
const projectModulesMigration = '0018_fluffy_prima'
const previous = tags.slice(0, tags.indexOf(projectModulesMigration))

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

/** Banco na migração anterior à 0018, com duas organizações com equipe e uma sem linhas. */
function seedBeforeMigration(): BetterSqlite3.Database {
  const client = new BetterSqlite3(':memory:')
  client.pragma('foreign_keys = OFF')
  applyAll(client, previous)

  const insertOrganization = client.prepare(
    'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)',
  )
  insertOrganization.run('ORG_A', 'Equipe com ferramentas', createdAt)
  insertOrganization.run('ORG_B', 'Equipe sem estimativa', createdAt)
  insertOrganization.run('ORG_C', 'Sem linhas gravadas', createdAt)

  client
    .prepare(
      'INSERT INTO users (id, organization_id, name, email, initials, role, default_rate_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('USER_A', 'ORG_A', 'Ana', 'ana@example.com', 'AN', 'manager', 0, createdAt)

  const insertProject = client.prepare(
    'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  insertProject.run('PROJ_A1', 'ORG_A', 'Projeto A1', 'a1', 'USER_A', createdAt)
  insertProject.run('PROJ_A2', 'ORG_A', 'Projeto A2', 'a2', 'USER_A', createdAt)
  insertProject.run('PROJ_B1', 'ORG_B', 'Projeto B1', 'b1', 'USER_A', createdAt)
  insertProject.run('PROJ_C1', 'ORG_C', 'Projeto C1', 'c1', 'USER_A', createdAt)

  // ORG_A: estimates.hours desligado e wip com configuração; ORG_B: sem linha de estimates.hours.
  const insertTeamModule = client.prepare(
    'INSERT INTO team_modules (organization_id, module_id, state, config, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  insertTeamModule.run('ORG_A', 'core', 'active', null, null, null)
  insertTeamModule.run('ORG_A', 'agenda', 'winding_down', null, 'USER_A', createdAt)
  insertTeamModule.run('ORG_A', 'wip', 'disabled', '{"limit":3}', 'USER_A', createdAt)
  insertTeamModule.run('ORG_A', 'estimates.hours', 'disabled', null, 'USER_A', createdAt)
  insertTeamModule.run('ORG_B', 'core', 'active', null, null, null)
  insertTeamModule.run('ORG_B', 'agenda', 'active', null, null, null)

  return client
}

interface ProjectModuleRow {
  module_id: string
  state: string
  config: string | null
  changed_by: string | null
  changed_at: string | null
}

function modulesOf(client: BetterSqlite3.Database, projectId: string): ProjectModuleRow[] {
  return client
    .prepare(
      'SELECT module_id, state, config, changed_by, changed_at FROM project_modules WHERE project_id = ? ORDER BY module_id',
    )
    .all(projectId) as ProjectModuleRow[]
}

describe('migração de módulos por projeto (0018)', () => {
  it('existe no diário, cria as tabelas novas e não recria as antigas', () => {
    expect(tags).toContain(projectModulesMigration)
    const sql = statementsOf(projectModulesMigration).join('\n')
    expect(sql).toMatch(/CREATE TABLE `project_modules`/u)
    expect(sql).toMatch(/CREATE TABLE `project_setup`/u)
    expect(sql).not.toMatch(
      /DROP TABLE|DELETE FROM|ALTER TABLE `(team_modules|team_preferences|team_tools_audit|projects)`/iu,
    )
  })

  it('(i) projeto herda os módulos da ferramenta da equipe, com estado e configuração', () => {
    const client = seedBeforeMigration()
    applyAll(client, [projectModulesMigration])

    expect(modulesOf(client, 'PROJ_A1')).toEqual([
      {
        module_id: 'agenda',
        state: 'winding_down',
        config: null,
        changed_by: null,
        changed_at: null,
      },
      { module_id: 'core', state: 'active', config: null, changed_by: null, changed_at: null },
      { module_id: 'cost', state: 'active', config: null, changed_by: null, changed_at: null },
      {
        module_id: 'estimates.hours',
        state: 'active',
        config: null,
        changed_by: null,
        changed_at: null,
      },
      {
        module_id: 'wip',
        state: 'disabled',
        config: '{"limit":3}',
        changed_by: null,
        changed_at: null,
      },
    ])
    // O segundo projeto da mesma organização recebe exatamente as mesmas linhas.
    expect(modulesOf(client, 'PROJ_A2')).toEqual(modulesOf(client, 'PROJ_A1'))
    client.close()
  })

  it('(ii) organização sem linhas em team_modules recebe o padrão de 13 módulos, todos ativos', () => {
    const client = seedBeforeMigration()
    applyAll(client, [projectModulesMigration])

    const rows = modulesOf(client, 'PROJ_C1')
    const withoutCost = rows.filter((row) => row.module_id !== 'cost')
    expect(withoutCost.map((row) => row.module_id)).toEqual([...DEFAULT_TEAM_MODULE_IDS].sort())
    expect(withoutCost.every((row) => row.state === 'active' && row.config === null)).toBe(true)
    expect(withoutCost.every((row) => row.changed_by === null && row.changed_at === null)).toBe(
      true,
    )
    client.close()
  })

  it('(iii) cost fica ativo em todos os projetos', () => {
    const client = seedBeforeMigration()
    applyAll(client, [projectModulesMigration])

    const projects = client.prepare('SELECT id FROM projects').all() as { id: string }[]
    expect(projects).toHaveLength(4)
    for (const project of projects) {
      expect(
        client
          .prepare("SELECT state FROM project_modules WHERE project_id = ? AND module_id = 'cost'")
          .get(project.id),
      ).toEqual({ state: 'active' })
    }
    client.close()
  })

  it('(iv) estimates.hours fica ativo mesmo quando estava desligado ou ausente', () => {
    const client = seedBeforeMigration()
    applyAll(client, [projectModulesMigration])

    // ORG_A tinha estimates.hours desligado.
    expect(
      client
        .prepare(
          "SELECT state FROM project_modules WHERE project_id = 'PROJ_A1' AND module_id = 'estimates.hours'",
        )
        .get(),
    ).toEqual({ state: 'active' })
    // ORG_B não tinha a linha; a migração cria com estado ativo.
    expect(
      client
        .prepare(
          "SELECT state FROM project_modules WHERE project_id = 'PROJ_B1' AND module_id = 'estimates.hours'",
        )
        .get(),
    ).toEqual({ state: 'active' })
    client.close()
  })

  it('(v) team_modules fica intacto', () => {
    const client = seedBeforeMigration()
    const read = () =>
      client
        .prepare(
          'SELECT organization_id, module_id, state, config, changed_by, changed_at FROM team_modules ORDER BY organization_id, module_id',
        )
        .all()
    const before = read()
    applyAll(client, [projectModulesMigration])

    expect(read()).toEqual(before)
    expect(before).toHaveLength(6)
    client.close()
  })

  it('(vi) CHECKs rejeitam estado de módulo e preset inválidos', () => {
    const client = seedBeforeMigration()
    applyAll(client, [projectModulesMigration])

    expect(() =>
      client
        .prepare(
          "INSERT INTO project_modules (organization_id, project_id, module_id, state) VALUES ('ORG_A', 'PROJ_A1', 'risks', 'bogus')",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u)
    expect(() =>
      client
        .prepare(
          "INSERT INTO project_modules (organization_id, project_id, module_id, state, config) VALUES ('ORG_A', 'PROJ_A1', 'risks', 'active', 'nao-json')",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u)

    expect(() =>
      client
        .prepare(
          "INSERT INTO project_setup (project_id, organization_id, recommended_preset) VALUES ('PROJ_A1', 'ORG_A', 'cascata')",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u)
    expect(() =>
      client
        .prepare(
          "INSERT INTO project_setup (project_id, organization_id, started_from_preset) VALUES ('PROJ_A1', 'ORG_A', 'cascata')",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u)
    expect(() =>
      client
        .prepare(
          "INSERT INTO project_setup (project_id, organization_id, guide_level) VALUES ('PROJ_A1', 'ORG_A', 'sempre')",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u)
    expect(() =>
      client
        .prepare(
          "INSERT INTO project_setup (project_id, organization_id, answers) VALUES ('PROJ_A1', 'ORG_A', 'nao-json')",
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u)

    // Valores válidos (e nulos) passam.
    client
      .prepare(
        "INSERT INTO project_setup (project_id, organization_id, answers, recommended_preset, started_from_preset, guide_level) VALUES ('PROJ_A1', 'ORG_A', '{\"q\":1}', 'agil', NULL, 'sometimes')",
      )
      .run()
    client.close()
  })

  it('(vii) migração em banco sem projetos não falha', () => {
    const client = new BetterSqlite3(':memory:')
    client.pragma('foreign_keys = OFF')
    applyAll(client, previous)
    client
      .prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
      .run('ORG_VAZIA', 'Sem projetos', createdAt)

    expect(() => applyAll(client, [projectModulesMigration])).not.toThrow()
    expect(client.prepare('SELECT COUNT(*) AS total FROM project_modules').get()).toEqual({
      total: 0,
    })
    client.close()
  })
})
