import { describe, expect, it, vi } from 'vitest'
import { createChangeSync } from './sync-changes'

describe('sincronização de mudanças', () => {
  it('invalida as consultas da aplicação quando chega uma mudança', () => {
    const invalidateQueries = vi.fn()
    const subscribe = vi.fn((callback: (change: { kind: string; ids: string[] }) => void) => {
      callback({ kind: 'task', ids: ['tarefa-1'] })
      return vi.fn()
    })
    const stop = createChangeSync({ invalidateQueries }, subscribe)

    expect(invalidateQueries).toHaveBeenCalledOnce()
    expect(invalidateQueries).toHaveBeenCalledWith()
    stop()
  })

  it('uma mudança do tipo board (limite de WIP) invalida também o quadro e o dashboard', () => {
    const invalidateQueries = vi.fn()
    const subscribe = vi.fn((callback: (change: { kind: string; ids: string[] }) => void) => {
      callback({ kind: 'board', ids: [] })
      return vi.fn()
    })
    createChangeSync({ invalidateQueries }, subscribe)

    // Sem filtro: invalida todas as consultas, inclusive tasks.board e dashboard.all.
    expect(invalidateQueries).toHaveBeenCalledWith()
  })

  it('devolve a função que encerra a assinatura', () => {
    const unsubscribe = vi.fn()
    const stop = createChangeSync({ invalidateQueries: vi.fn() }, () => unsubscribe)

    stop()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
