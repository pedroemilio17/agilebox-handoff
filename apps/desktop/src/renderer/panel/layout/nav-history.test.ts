import { describe, expect, it } from 'vitest'
import { MAX_NAV_HISTORY, popNavHistory, pushNavHistory, type NavEntry } from './nav-history'

describe('histórico de navegação do painel', () => {
  it('adiciona a posição atual ao navegar para outro destino', () => {
    const history = pushNavHistory(
      [],
      { view: 'projects', projectId: null },
      { view: 'backlog', projectId: 'p1' },
    )
    expect(history).toEqual([{ view: 'projects', projectId: null }])
  })

  it('não duplica quando o destino é igual à tela e ao projeto atuais', () => {
    const initial: NavEntry[] = [{ view: 'dashboard', projectId: null }]
    const next = pushNavHistory(
      initial,
      { view: 'backlog', projectId: 'p1' },
      { view: 'backlog', projectId: 'p1' },
    )
    expect(next).toBe(initial)
  })

  it('respeita o limite máximo mantendo os registros mais recentes', () => {
    let history: readonly NavEntry[] = []
    for (let index = 0; index < MAX_NAV_HISTORY + 5; index += 1) {
      history = pushNavHistory(
        history,
        { view: 'projects', projectId: `p-${index}` },
        { view: 'backlog', projectId: `p-${index}` },
      )
    }
    expect(history).toHaveLength(MAX_NAV_HISTORY)
    expect(history[0]).toEqual({ view: 'projects', projectId: 'p-5' })
    expect(history[history.length - 1]).toEqual({
      view: 'projects',
      projectId: `p-${MAX_NAV_HISTORY + 4}`,
    })
  })

  it('desempilha o último item e trata pilha vazia', () => {
    expect(popNavHistory([])).toEqual({ entry: null, rest: [] })

    const history: NavEntry[] = [
      { view: 'projects', projectId: null },
      { view: 'backlog', projectId: 'p1' },
    ]
    expect(popNavHistory(history)).toEqual({
      entry: { view: 'backlog', projectId: 'p1' },
      rest: [{ view: 'projects', projectId: null }],
    })
  })
})
