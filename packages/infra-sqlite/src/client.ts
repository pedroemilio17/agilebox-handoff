import BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'

export const createSqliteClient = (filename: string) => {
  const client = new BetterSqlite3(filename)

  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')

  const database = drizzle(client)
  migrate(database, {
    migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
  })

  return database
}
