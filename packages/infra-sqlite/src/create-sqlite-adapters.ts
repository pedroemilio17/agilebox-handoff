import { createSqliteClient } from './client.js'
import { createSqliteCoreRepositories } from './repositories/core-repositories.js'
import { createSqliteMeetingRepository } from './repositories/meeting-repository.js'
import { createSqliteTaskRepositories } from './repositories/task-repositories.js'
import { createSqliteUnitOfWork } from './unit-of-work.js'

export function createSqliteAdapters(filename: string) {
  const database = createSqliteClient(filename)
  const repositories = {
    ...createSqliteCoreRepositories(database),
    ...createSqliteTaskRepositories(database),
    meetings: createSqliteMeetingRepository(database),
  }
  return {
    ...repositories,
    unitOfWork: createSqliteUnitOfWork(database, repositories),
    close: () => database.$client.close(),
  }
}
