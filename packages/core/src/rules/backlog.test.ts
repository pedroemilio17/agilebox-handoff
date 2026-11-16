import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toTaskId } from '../shared/ids'
import type { TaskId } from '../shared/ids'
import {
  BACKLOG_RANK_GAP,
  compareBacklogOrder,
  rankAtEnd,
  rankBetween,
  rebalanceBacklog,
  reorderInBacklog,
  sortBacklog,
} from './backlog'
import type { BacklogItem } from './backlog'

const id = (n: number): TaskId => toTaskId(`0000000000000000000000${String(n).padStart(4, '0')}`)
const at = '2026-01-01T00:00:00.000Z'

function item(n: number, backlogRank: number | null, createdAt = at): BacklogItem {
  return { id: id(n), backlogRank, createdAt }
}

/** Aplica as mudanças e devolve os ids na ordem final do backlog. */
function applyOrder(
  items: readonly BacklogItem[],
  changes: readonly { taskId: TaskId; backlogRank: number }[],
) {
  const ranks = new Map(items.map((i) => [i.id, i.backlogRank]))
  for (const change of changes) ranks.set(change.taskId, change.backlogRank)
  return [...ranks]
    .filter(([, rank]) => rank !== null)
    .sort(([aId, a], [bId, b]) => (a as number) - (b as number) || aId.localeCompare(bId))
    .map(([taskId]) => taskId)
}

describe('ordenação do backlog', () => {
  it('ordena por rank e deixa de fora quem não está no backlog', () => {
    const ordered = sortBacklog([item(3, 3000), item(1, null), item(2, 1000)])
    expect(ordered.map((i) => i.id)).toEqual([id(2), id(3)])
  })

  it('empate de rank se resolve por data de criação e depois por id (estável)', () => {
    const a = item(1, 1000, '2026-01-02T00:00:00.000Z')
    const b = item(2, 1000, '2026-01-01T00:00:00.000Z')
    const c = item(3, 1000, '2026-01-01T00:00:00.000Z')
    expect(sortBacklog([a, c, b]).map((i) => i.id)).toEqual([id(2), id(3), id(1)])
    expect(compareBacklogOrder(b, c)).toBeLessThan(0)
  })
})

describe('rank entre vizinhos', () => {
  it('usa o espaçamento no início, no fim e numa lista vazia', () => {
    expect(rankBetween(null, null)).toBe(BACKLOG_RANK_GAP)
    expect(rankBetween(null, 5000)).toBe(5000 - BACKLOG_RANK_GAP)
    expect(rankBetween(5000, null)).toBe(5000 + BACKLOG_RANK_GAP)
    expect(rankAtEnd([])).toBe(BACKLOG_RANK_GAP)
    expect(rankAtEnd([item(1, 2048), item(2, 1024)])).toBe(2048 + BACKLOG_RANK_GAP)
  })

  it('o ponto médio fica estritamente entre os vizinhos', () => {
    const rank = rankBetween(1000, 2000)
    expect(rank).toBeGreaterThan(1000)
    expect(rank).toBeLessThan(2000)
  })

  it('sem inteiro livre entre os vizinhos devolve nulo (pede rebalanceamento)', () => {
    expect(rankBetween(1000, 1001)).toBeNull()
    expect(rankBetween(1000, 1000)).toBeNull()
    expect(rankBetween(1000, 1002)).toBe(1001)
  })

  it('rebalanceia com espaçamento e na ordem recebida', () => {
    expect(rebalanceBacklog([id(9), id(4)])).toEqual([
      { taskId: id(9), backlogRank: BACKLOG_RANK_GAP },
      { taskId: id(4), backlogRank: 2 * BACKLOG_RANK_GAP },
    ])
  })
})

describe('reordenar no backlog', () => {
  const backlog = [item(1, 1024), item(2, 2048), item(3, 3072)]

  it('entre dois vizinhos grava só o item movido', () => {
    const move = reorderInBacklog(backlog, id(3), {
      to: 'between',
      afterId: id(1),
      beforeId: id(2),
    })
    expect(move.changes).toHaveLength(1)
    expect(move.changes[0]?.taskId).toBe(id(3))
    expect(move.position).toBe(2)
    expect(applyOrder(backlog, move.changes)).toEqual([id(1), id(3), id(2)])
  })

  it('para o topo e para o fim', () => {
    const top = reorderInBacklog(backlog, id(3), { to: 'top' })
    expect(top.position).toBe(1)
    expect(applyOrder(backlog, top.changes)).toEqual([id(3), id(1), id(2)])

    const end = reorderInBacklog(backlog, id(1), { to: 'end' })
    expect(end.position).toBe(3)
    expect(applyOrder(backlog, end.changes)).toEqual([id(2), id(3), id(1)])
  })

  it('só um vizinho basta: depois de um item, ou antes de um item', () => {
    const after = reorderInBacklog(backlog, id(3), {
      to: 'between',
      afterId: id(1),
      beforeId: null,
    })
    expect(applyOrder(backlog, after.changes)).toEqual([id(1), id(3), id(2)])
    const before = reorderInBacklog(backlog, id(1), {
      to: 'between',
      afterId: null,
      beforeId: id(3),
    })
    expect(applyOrder(backlog, before.changes)).toEqual([id(2), id(1), id(3)])
  })

  it('no mesmo lugar, não grava nada', () => {
    const move = reorderInBacklog(backlog, id(2), {
      to: 'between',
      afterId: id(1),
      beforeId: id(3),
    })
    expect(move.changes).toEqual([])
    expect(move.position).toBe(2)
    expect(reorderInBacklog(backlog, id(1), { to: 'top' }).changes).toEqual([])
    expect(reorderInBacklog(backlog, id(3), { to: 'end' }).changes).toEqual([])
  })

  it('reordenação repetida mantém a ordem pedida em cada passo', () => {
    let current = [item(1, 1024), item(2, 2048), item(3, 3072), item(4, 4096)]
    const steps: [number, BacklogPlacementStep][] = [
      [4, { to: 'top' }],
      [1, { to: 'end' }],
      [2, { to: 'between', afterId: id(4), beforeId: id(3) }],
      [3, { to: 'top' }],
    ]
    const expected = [
      [4, 1, 2, 3],
      [4, 2, 3, 1],
      [4, 2, 3, 1],
      [3, 4, 2, 1],
    ]
    steps.forEach(([moved, placement], step) => {
      const move = reorderInBacklog(current, id(moved), placement)
      const order = applyOrder(current, move.changes)
      expect(order).toEqual(expected[step]?.map(id))
      current = current.map((i) => {
        const change = move.changes.find((c) => c.taskId === i.id)
        return change ? { ...i, backlogRank: change.backlogRank } : i
      })
    })
  })

  it('rebalanceia quando o espaço acaba e preserva a ordem', () => {
    // Três itens coladinhos: não cabe inteiro entre 1000 e 1001.
    const tight = [item(1, 1000), item(2, 1001), item(3, 5000)]
    const move = reorderInBacklog(tight, id(3), { to: 'between', afterId: id(1), beforeId: id(2) })
    expect(move.changes.length).toBeGreaterThan(1)
    expect(move.position).toBe(2)
    expect(applyOrder(tight, move.changes)).toEqual([id(1), id(3), id(2)])
    // Depois do rebalanceamento, os ranks voltam a ter espaço.
    const after = move.changes.map((change) => change.backlogRank)
    expect(new Set(after).size).toBe(after.length)
  })

  it('rebalanceia sem gravar o que não mudou de posição', () => {
    // Ao renumerar, o item 3 já tem o rank 2048 que ele ganharia na segunda posição: fica de fora.
    const tight = [item(1, 1000), item(2, 1001), item(3, 2 * BACKLOG_RANK_GAP)]
    const move = reorderInBacklog(tight, id(3), { to: 'between', afterId: id(1), beforeId: id(2) })
    expect(move.changes.map((c) => c.taskId)).toEqual([id(1), id(2)])
  })

  it('vizinhos que não são consecutivos são recusados', () => {
    const four = [...backlog, item(4, 4096)]
    expect(() =>
      reorderInBacklog(four, id(1), { to: 'between', afterId: id(2), beforeId: id(4) }),
    ).toThrow(ValidationError)
    expect(() =>
      reorderInBacklog(four, id(1), { to: 'between', afterId: id(2), beforeId: id(4) }),
    ).toThrow('um ao lado do outro')
    expect(() =>
      reorderInBacklog(backlog, id(3), { to: 'between', afterId: id(2), beforeId: id(1) }),
    ).toThrow('um ao lado do outro')
  })

  it('recusa vizinho fora do backlog, a própria tarefa, falta de vizinho e tarefa fora do backlog', () => {
    expect(() =>
      reorderInBacklog(backlog, id(3), { to: 'between', afterId: id(9), beforeId: null }),
    ).toThrow('não está no backlog')
    expect(() =>
      reorderInBacklog(backlog, id(3), { to: 'between', afterId: id(3), beforeId: null }),
    ).toThrow('vizinha dela mesma')
    expect(() =>
      reorderInBacklog(backlog, id(3), { to: 'between', afterId: null, beforeId: null }),
    ).toThrow('Informe o vizinho')
    expect(() => reorderInBacklog(backlog, id(8), { to: 'top' })).toThrow('não está no backlog')
  })
})

type BacklogPlacementStep = Parameters<typeof reorderInBacklog>[2]
