import { describe, expect, it } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { applyMove, moveRequest } from './backlog-order'

function item(id: string): TaskDto {
  return { id, title: id } as unknown as TaskDto
}

const list = [item('a'), item('b'), item('c'), item('d')]

describe('reordenação do backlog', () => {
  it('subir manda o item antes do vizinho de cima', () => {
    expect(moveRequest(list, 2, 1)).toEqual({ taskId: 'c', beforeId: 'b' })
    expect(moveRequest(list, 3, 0)).toEqual({ taskId: 'd', beforeId: 'a' })
  })

  it('descer manda o item depois do vizinho de baixo', () => {
    expect(moveRequest(list, 0, 1)).toEqual({ taskId: 'a', afterId: 'b' })
    expect(moveRequest(list, 1, 3)).toEqual({ taskId: 'b', afterId: 'd' })
  })

  it('não gera pedido quando nada muda ou a posição está fora da lista', () => {
    expect(moveRequest(list, 1, 1)).toBeNull()
    expect(moveRequest(list, 0, -1)).toBeNull()
    expect(moveRequest(list, 0, 4)).toBeNull()
    expect(moveRequest([], 0, 0)).toBeNull()
  })

  it('a ordem otimista bate com a posição que o servidor vai gravar', () => {
    expect(applyMove(list, 0, 2).map((task) => task.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(applyMove(list, 3, 0).map((task) => task.id)).toEqual(['d', 'a', 'b', 'c'])
    expect(applyMove(list, 1, 1).map((task) => task.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
