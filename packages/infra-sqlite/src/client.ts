import BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

export const createSqliteClient = (filename: string) => {
  const client = new BetterSqlite3(filename)

  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')

  return drizzle(client)
}
