import { describe, expect, it } from 'vitest'
import { createSqliteClient } from './client.js'

describe('cliente SQLite', () => {
  it('abre um banco em memória com as chaves estrangeiras habilitadas', () => {
    const database = createSqliteClient(':memory:')

    expect(database.$client.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(database.$client.pragma('journal_mode', { simple: true })).toBe('memory')

    database.$client.close()
  })
})
