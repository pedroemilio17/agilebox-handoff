import { describe, expect, it } from 'vitest'
import { matchesBoardSearch } from './board-search'

const task = { key: 'AB-12', title: 'Migrar autenticação de sessão' }

describe('matchesBoardSearch', () => {
  it('sem texto, mostra todas as tarefas', () => {
    expect(matchesBoardSearch(task, undefined, '')).toBe(true)
    expect(matchesBoardSearch(task, undefined, '   ')).toBe(true)
  })

  it('acha pelo ID, sem diferenciar maiúsculas', () => {
    expect(matchesBoardSearch(task, undefined, 'ab-12')).toBe(true)
    expect(matchesBoardSearch(task, undefined, 'ab-13')).toBe(false)
  })

  it('acha pelo título, ignorando acentos no texto digitado', () => {
    expect(matchesBoardSearch(task, undefined, 'autenticacao')).toBe(true)
    expect(matchesBoardSearch(task, undefined, 'sessão')).toBe(true)
  })

  it('acha pelo responsável', () => {
    expect(matchesBoardSearch(task, 'Ana Souza', 'ana')).toBe(true)
    expect(matchesBoardSearch(task, undefined, 'ana')).toBe(false)
  })
})
