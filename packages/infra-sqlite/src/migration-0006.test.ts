import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createUser, toOrganizationId, toUserId } from '@agilebox/core'
import { createSqliteClient } from './client.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))
const newMigrationTag = '0006_taxa_padrao_organizacao_usuario'

interface JournalEntry {
  readonly idx: number
  readonly tag: string
}

/**
 * Pasta de migrações como estava antes da 0006: as mesmas entradas do diário, sem a nova. Assim o
 * banco é criado no estado da 0005, com dados, e a 0006 é aplicada por cima pelo caminho normal.
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
const managerId = toUserId('01ARZ3NDEKTSV4RRFFQ69G5FAX')

describe('migração 0006 (taxa padrão da organização e do usuário)', () => {
  it('cria a taxa da organização com 4500, preserva a taxa do usuário e aceita taxa nula', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'agilebox-migracao-0006-'))
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
          managerId,
          organizationId,
          'Pedro',
          'pedro@example.com',
          'PE',
          'manager',
          6500,
          timestamp,
        )
      // Filho com chave estrangeira para o usuário: a recriação da tabela não pode quebrar isso.
      client
        .prepare(
          'INSERT INTO projects (id, organization_id, name, name_key, created_by, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          '01ARZ3NDEKTSV4RRFFQ69G5FAY',
          organizationId,
          'Projeto A',
          'projeto a',
          managerId,
          timestamp,
          null,
        )
      legacy.$client.close()

      const upgraded = createSqliteClient(filename)
      try {
        const upgradedClient = upgraded.$client

        const applied = upgradedClient.prepare('SELECT hash FROM __drizzle_migrations').all()
        expect(applied).toHaveLength(7)

        // Usuário existente mantém a taxa que já tinha.
        const user = upgradedClient
          .prepare('SELECT default_rate_cents AS rate FROM users WHERE id = ?')
          .get(managerId) as { rate: number | null }
        expect(user.rate).toBe(6500)

        // Organização nova ganha o padrão de R$ 45,00.
        const org = upgradedClient
          .prepare('SELECT default_rate_cents AS rate FROM organizations WHERE id = ?')
          .get(organizationId) as { rate: number }
        expect(org.rate).toBe(4500)

        // Índice único e chaves estrangeiras continuam no lugar e sem violações.
        const indexes = upgradedClient.prepare('PRAGMA index_list(users)').all() as {
          name: string
        }[]
        expect(indexes.map((index) => index.name)).toContain('users_organization_email_unique')
        expect(upgradedClient.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        expect(upgradedClient.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })

        // Taxa nula: o usuário usa o padrão da organização.
        const repositories = createSqliteCoreRepositories(upgraded)
        await repositories.users.save(
          organizationId,
          createUser({
            id: toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB2'),
            organizationId,
            name: 'Ana Souza',
            email: 'ana@example.com',
            role: 'collaborator',
            defaultRateCents: null,
            createdAt: timestamp,
          }),
        )
        const saved = await repositories.users.findById(
          organizationId,
          toUserId('01ARZ3NDEKTSV4RRFFQ69G5FB2'),
        )
        expect(saved?.defaultRateCents).toBeNull()
        const nullRate = upgradedClient
          .prepare('SELECT default_rate_cents AS rate FROM users WHERE email = ?')
          .get('ana@example.com') as { rate: number | null }
        expect(nullRate.rate).toBeNull()
      } finally {
        upgraded.$client.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
