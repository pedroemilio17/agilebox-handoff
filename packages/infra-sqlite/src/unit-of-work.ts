import type { UnitOfWork, UnitOfWorkRepositories } from '@agilebox/application'
import type { OrganizationId } from '@agilebox/core'
import { createSqliteClient } from './client.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

export class SqliteUnitOfWork implements UnitOfWork {
  private active = false

  constructor(
    private readonly database: SqliteDatabase,
    private readonly repositories: UnitOfWorkRepositories,
  ) {}

  async run<T>(
    _organizationId: OrganizationId,
    operation: (repositories: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    if (this.active) throw new Error('Transações aninhadas não são suportadas')
    this.active = true
    let transactionStarted = false
    try {
      this.database.$client.exec('BEGIN')
      transactionStarted = true
      const result = await operation(this.repositories)
      this.database.$client.exec('COMMIT')
      return result
    } catch (error) {
      if (transactionStarted) this.database.$client.exec('ROLLBACK')
      throw error
    } finally {
      this.active = false
    }
  }
}

export function createSqliteUnitOfWork(
  database: SqliteDatabase,
  repositories: UnitOfWorkRepositories,
): UnitOfWork {
  return new SqliteUnitOfWork(database, repositories)
}
