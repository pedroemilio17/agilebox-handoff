import { describe, expect, it } from 'vitest'
import { ValidationError } from '../shared/errors'
import { toTaskId } from '../shared/ids'
import type { TaskId } from '../shared/ids'
import type { BacklogItem } from './backlog-order'
import {
  isInBacklog,
  isVisibleOnBoard,
  moveInBacklog,
  nextBacklogRank,
  orderedBacklog,
  parseBacklogRank,
} from './backlog-order'

const id = (n: number) => toTaskId(String(n).padStart(26, '0'))
const item = (n: number, backlogRank: number | null): BacklogItem => ({ id: id(n), backlogRank })

/** Aplica as alterações devolvidas pela função pura a uma cópia, como a persistência faria. */
function apply(items: readonly BacklogItem[], changes: readonly BacklogItem[]): BacklogItem[] {
  return items.map((current) => {
    const change = changes.find((c) => c.id === current.id)
    return change ? { id: current.id, backlogRank: change.backlogRank } : current
  })
}

function ranksOf(items: readonly BacklogItem[]): Array<[TaskId, number | null]> {
  return items.map((i) => [i.id, i.backlogRank])
}

function contiguousOrder(items: readonly BacklogItem[]): TaskId[] {
  return orderedBacklog(items).map((i) => i.id)
}

const backlog = () => [item(1, 1), item(2, 2), item(3, 3), item(4, 4)]

describe('posição do backlog', () => {
  it('aceita só inteiros seguros a partir de 1', () => {
    expect(parseBacklogRank(1)).toBe(1)
    expect(parseBacklogRank(42)).toBe(42)
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => parseBacklogRank(invalid)).toThrow(ValidationError)
    }
  })

  it('ordena só as tarefas do backlog, por posição', () => {
    const items = [item(1, 3), item(2, null), item(3, 1), item(4, 2)]
    expect(orderedBacklog(items).map((i) => i.id)).toEqual([id(3), id(4), id(1)])
    expect(isInBacklog(item(1, null))).toBe(false)
    expect(isInBacklog(item(1, 1))).toBe(true)
  })

  it('nova tarefa no backlog vai para o fim, sem colidir com ranks existentes', () => {
    expect(nextBacklogRank([])).toBe(1)
    expect(nextBacklogRank([item(1, null)])).toBe(1)
    expect(nextBacklogRank(backlog())).toBe(5)
    // Lacuna deixada por outra tarefa: o fim continua depois do maior rank.
    expect(nextBacklogRank([item(1, 1), item(2, 7)])).toBe(8)
  })
})

describe('mover no backlog (função pura)', () => {
  it('mover ao topo põe a tarefa na posição 1 e mantém a ordem relativa do resto', () => {
    const items = backlog()
    const changes = moveInBacklog(items, id(3), 'top')
    const after = apply(items, changes)
    expect(contiguousOrder(after)).toEqual([id(3), id(1), id(2), id(4)])
    expect(ranksOf(orderedBacklog(after))).toEqual([
      [id(3), 1],
      [id(1), 2],
      [id(2), 3],
      [id(4), 4],
    ])
  })

  it('mover ao fim põe a tarefa na última posição, com ranks contíguos', () => {
    const items = backlog()
    const after = apply(items, moveInBacklog(items, id(1), 'end'))
    expect(contiguousOrder(after)).toEqual([id(2), id(3), id(4), id(1)])
    expect(orderedBacklog(after).map((i) => i.backlogRank)).toEqual([1, 2, 3, 4])
  })

  it('reordena para um índice intermediário, nos dois sentidos', () => {
    const items = backlog()
    expect(contiguousOrder(apply(items, moveInBacklog(items, id(1), 2)))).toEqual([
      id(2),
      id(3),
      id(1),
      id(4),
    ])
    expect(contiguousOrder(apply(items, moveInBacklog(items, id(4), 1)))).toEqual([
      id(1),
      id(4),
      id(2),
      id(3),
    ])
  })

  it('devolve só as tarefas cuja posição mudou', () => {
    const items = backlog()
    expect(moveInBacklog(items, id(2), 1)).toEqual([])
    expect(moveInBacklog(items, id(1), 1)).toEqual([
      { id: id(2), backlogRank: 1 },
      { id: id(1), backlogRank: 2 },
    ])
  })

  it('renumera ranks com lacunas e sem colisão, e a ordem resultante fica contígua', () => {
    const items = [item(1, 10), item(2, 20), item(3, 30)]
    const after = apply(items, moveInBacklog(items, id(3), 'top'))
    expect(orderedBacklog(after).map((i) => [i.id, i.backlogRank])).toEqual([
      [id(3), 1],
      [id(1), 2],
      [id(2), 3],
    ])
    const ranks = after.map((i) => i.backlogRank)
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it('não altera a entrada', () => {
    const items = Object.freeze(backlog().map((i) => Object.freeze({ ...i })))
    const snapshot = JSON.stringify(items)
    moveInBacklog(items, id(1), 'end')
    expect(JSON.stringify(items)).toBe(snapshot)
  })

  it('recusa tarefa fora do backlog, destino fora da faixa e índice inválido', () => {
    const items = [...backlog(), item(9, null)]
    expect(() => moveInBacklog(items, id(9), 'top')).toThrow(ValidationError)
    expect(() => moveInBacklog(items, id(42), 'top')).toThrow(ValidationError)
    expect(() => moveInBacklog(items, id(1), 4)).toThrow(ValidationError)
    expect(() => moveInBacklog(items, id(1), -1)).toThrow(ValidationError)
    expect(() => moveInBacklog(items, id(1), 1.5)).toThrow(ValidationError)
    expect(() => moveInBacklog(items, id(1), Number.NaN)).toThrow(ValidationError)
  })

  it('com um único item, mover ao topo ou ao fim não muda nada', () => {
    const items = [item(1, 1)]
    expect(moveInBacklog(items, id(1), 'top')).toEqual([])
    expect(moveInBacklog(items, id(1), 'end')).toEqual([])
  })

  it('lida com lista grande sem perder a ordem (10 mil itens)', () => {
    const items = Array.from({ length: 10_000 }, (_, i) => item(i + 1, i + 1))
    const changes = moveInBacklog(items, id(10_000), 'top')
    const after = apply(items, changes)
    expect(orderedBacklog(after).map((i) => i.id)).toEqual([
      id(10_000),
      ...items.slice(0, 9_999).map((i) => i.id),
    ])
    expect(after.find((i) => i.id === id(10_000))?.backlogRank).toBe(1)
    expect(after.find((i) => i.id === id(9_999))?.backlogRank).toBe(10_000)
    expect(changes).toHaveLength(10_000)
  })
})

describe('visibilidade no quadro', () => {
  const onBoard = { onBoard: true }
  const offBoard = { onBoard: false }

  it('com o Backlog ativo, o quadro mostra só as tarefas do quadro', () => {
    expect(isVisibleOnBoard(onBoard, 'active')).toBe(true)
    expect(isVisibleOnBoard(offBoard, 'active')).toBe(false)
  })

  it('com o Backlog em encerramento, as tarefas do backlog continuam fora do quadro', () => {
    expect(isVisibleOnBoard(offBoard, 'winding_down')).toBe(false)
    expect(isVisibleOnBoard(onBoard, 'winding_down')).toBe(true)
  })

  it('com o Backlog desligado, tudo volta ao quadro, sem mexer na flag', () => {
    expect(isVisibleOnBoard(offBoard, 'disabled')).toBe(true)
    expect(isVisibleOnBoard(onBoard, 'disabled')).toBe(true)
    expect(offBoard.onBoard).toBe(false)
  })
})
