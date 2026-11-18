import { describe, expect, it } from 'vitest'
import { createDeliverable } from '../entities/deliverable'
import type { Deliverable } from '../entities/deliverable'
import { NotFoundError, ValidationError } from '../shared/errors'
import { toDeliverableId, toOrganizationId, toProjectId, toUserId } from '../shared/ids'
import type { DeliverableId, ProjectId } from '../shared/ids'
import {
  MAX_DELIVERABLE_DEPTH,
  deliverableCodes,
  deliverableHeight,
  deliverableLevel,
  arrangeAfterMove,
  moveDeliverable,
} from './deliverable-tree'

const ulid = (n: number) => String(n).padStart(26, '0')
const org = toOrganizationId(ulid(1))
const project = toProjectId(ulid(20))
const otherProject = toProjectId(ulid(21))
const user = toUserId(ulid(10))
const at = '2026-03-01T10:00:00.000Z'

/** Entrega pronta para a árvore: os testes só mexem em pai, posição e projeto. */
function node(
  n: number,
  parentId: number | null,
  position: number,
  projectId: ProjectId = project,
): Deliverable {
  return {
    id: toDeliverableId(ulid(100 + n)),
    organizationId: org,
    projectId,
    parentId: parentId === null ? null : toDeliverableId(ulid(100 + parentId)),
    title: `Entrega ${n}`,
    position,
    createdBy: user,
    createdAt: at,
  }
}

const id = (n: number): DeliverableId => toDeliverableId(ulid(100 + n))

/** Cadeia de três níveis: 1 > 2 > 3. */
const chain = [node(1, null, 0), node(2, 1, 0), node(3, 2, 0)]

describe('profundidade da EAP', () => {
  it('limite é 3 níveis', () => {
    expect(MAX_DELIVERABLE_DEPTH).toBe(3)
  })

  it.each([
    ['raiz (nível 1)', null, true],
    ['filho de nível 1 (nível 2)', 1, true],
    ['filho de nível 2 (nível 3)', 2, true],
    ['filho de nível 3 (nível 4)', 3, false],
  ])('criar: %s', (_label, parentN, ok) => {
    const parentId = parentN === null ? null : id(parentN)
    const input = {
      id: toDeliverableId(ulid(900)),
      organizationId: org,
      projectId: project,
      parentId,
      title: 'Nova',
      position: 0,
      createdBy: user,
      createdAt: at,
    }
    if (ok) expect(createDeliverable(input, chain).parentId).toBe(parentId)
    else expect(() => createDeliverable(input, chain)).toThrow(ValidationError)
  })

  it.each([
    ['folha sem filhos, sob nível 2', 2, 1, true],
    ['subárvore de 2 níveis sob nível 2 (chega a 4)', 2, 2, false],
    ['subárvore de 2 níveis sob nível 1 (chega a 3)', 1, 2, true],
    ['subárvore de 3 níveis sob raiz (chega a 3)', null, 3, true],
  ])('mover: %s', (_label, parentN, height, ok) => {
    // Entrega 50 é o nó movido; abaixo dela há `height - 1` níveis de filhos.
    const moved = node(50, null, 0)
    const below: Deliverable[] = []
    let parent = moved.id
    for (let level = 1; level < height; level += 1) {
      const child = { ...node(60 + level, null, 0), parentId: parent }
      below.push(child)
      parent = child.id
    }
    const base = [...chain, moved, ...below]
    const target = parentN === null ? null : id(parentN)
    if (ok) {
      const result = moveDeliverable(moved, base, { parentId: target, position: 0 })
      expect(result.parentId).toBe(target)
    } else {
      expect(() => moveDeliverable(moved, base, { parentId: target, position: 0 })).toThrow(
        ValidationError,
      )
    }
  })

  it('níveis e altura são contados a partir da raiz', () => {
    expect(deliverableLevel(id(1), chain)).toBe(1)
    expect(deliverableLevel(id(3), chain)).toBe(3)
    expect(deliverableHeight(id(1), chain)).toBe(3)
    expect(deliverableHeight(id(3), chain)).toBe(1)
  })

  it('pai inexistente é recusado como não encontrado', () => {
    expect(() =>
      createDeliverable(
        {
          id: toDeliverableId(ulid(901)),
          organizationId: org,
          projectId: project,
          parentId: toDeliverableId(ulid(999)),
          title: 'Órfã',
          position: 0,
          createdBy: user,
          createdAt: at,
        },
        chain,
      ),
    ).toThrow(NotFoundError)
  })
})

describe('ciclos e projeto na árvore', () => {
  it('não move uma entrega para dentro dela mesma', () => {
    expect(() => moveDeliverable(chain[0]!, chain, { parentId: id(1), position: 0 })).toThrow(
      ValidationError,
    )
  })

  it('não move uma entrega para um descendente (cria ciclo)', () => {
    expect(() => moveDeliverable(chain[0]!, chain, { parentId: id(3), position: 0 })).toThrow(
      ValidationError,
    )
  })

  it('recusa pai de outro projeto', () => {
    const other = node(7, null, 0, otherProject)
    expect(() =>
      moveDeliverable(node(8, null, 0), [...chain, other], { parentId: other.id, position: 0 }),
    ).toThrow(ValidationError)
  })

  it('mover para o mesmo lugar devolve a mesma entrega', () => {
    const first = chain[0]!
    expect(moveDeliverable(first, chain, { parentId: null, position: 0 })).toBe(first)
  })

  it('recusa posição negativa ou fracionária', () => {
    expect(() =>
      moveDeliverable(node(8, null, 0), chain, { parentId: null, position: -1 }),
    ).toThrow(ValidationError)
    expect(() =>
      moveDeliverable(node(8, null, 0), chain, { parentId: null, position: 1.5 }),
    ).toThrow(ValidationError)
  })

  it('move com sucesso e grava o novo pai e a nova posição', () => {
    const loose = node(8, null, 4)
    const moved = moveDeliverable(loose, chain, { parentId: id(2), position: 3 })
    expect(moved).toMatchObject({ parentId: id(2), position: 3 })
  })
})

describe('códigos da EAP', () => {
  it('são calculados pela posição entre irmãos, não pelo valor guardado', () => {
    // Posições 10, 20 e 30 entre raízes geram "1", "2" e "3".
    const tree = [node(1, null, 30), node(2, null, 10), node(3, null, 20)]
    const codes = deliverableCodes(tree)
    expect(codes.get(id(2))).toBe('1')
    expect(codes.get(id(3))).toBe('2')
    expect(codes.get(id(1))).toBe('3')
  })

  it('geram "1", "1.2" e "2.2.1" em árvore de três níveis', () => {
    const tree = [
      node(1, null, 0),
      node(2, null, 1),
      node(3, 1, 0),
      node(4, 1, 1),
      node(5, 2, 0),
      node(6, 2, 1),
      node(7, 6, 0),
    ]
    const codes = deliverableCodes(tree)
    expect(codes.get(id(1))).toBe('1')
    expect(codes.get(id(4))).toBe('1.2')
    expect(codes.get(id(6))).toBe('2.2')
    expect(codes.get(id(7))).toBe('2.2.1')
  })

  it('ignora entregas sem caminho até a raiz', () => {
    const loop = [node(21, 22, 0), node(22, 21, 0)]
    const codes = deliverableCodes([...chain, ...loop])
    expect(codes.get(id(21))).toBeUndefined()
    expect(codes.get(id(22))).toBeUndefined()
    expect(codes.get(id(3))).toBe('1.1.1')
  })
})

describe('título da entrega', () => {
  it('é obrigatório e vem sem espaços nas pontas', () => {
    expect(() =>
      createDeliverable(
        {
          id: toDeliverableId(ulid(902)),
          organizationId: org,
          projectId: project,
          parentId: null,
          title: '   ',
          position: 0,
          createdBy: user,
          createdAt: at,
        },
        [],
      ),
    ).toThrow(ValidationError)
  })

  it('aceita 200 caracteres e recusa 201', () => {
    const base = {
      id: toDeliverableId(ulid(903)),
      organizationId: org,
      projectId: project,
      parentId: null,
      position: 0,
      createdBy: user,
      createdAt: at,
    }
    expect(createDeliverable({ ...base, title: ` ${'a'.repeat(200)} ` }, []).title).toHaveLength(
      200,
    )
    expect(() => createDeliverable({ ...base, title: 'a'.repeat(201) }, [])).toThrow(
      ValidationError,
    )
  })
})

describe('mover e reordenar irmãos', () => {
  /** Posições finais de cada entrega (pelo número do teste), só as que mudaram. */
  const movedPositions = (changed: readonly Deliverable[]) =>
    Object.fromEntries(changed.map((item) => [item.title, [item.parentId, item.position]]))

  it('dentro do mesmo pai, a entrega vai para a posição pedida e os irmãos andam sem buraco', () => {
    const roots = [node(1, null, 0), node(2, null, 1), node(3, null, 2)]
    const changed = arrangeAfterMove(roots, id(1), { parentId: null, position: 2 })
    expect(movedPositions(changed)).toEqual({
      'Entrega 2': [null, 0],
      'Entrega 3': [null, 1],
      'Entrega 1': [null, 2],
    })
  })

  it('trocar de pai fecha o buraco no pai de origem e abre espaço no de destino', () => {
    const all = [
      node(1, null, 0),
      node(2, null, 1),
      node(3, 1, 0),
      node(4, 1, 1),
      node(5, null, 2),
      node(6, 5, 0),
    ]
    // Move a Entrega 3 (filha da 1) para a 5, na posição 0, antes da 6.
    const changed = arrangeAfterMove(all, id(3), { parentId: id(5), position: 0 })
    expect(movedPositions(changed)).toEqual({
      'Entrega 4': [id(1), 0],
      'Entrega 3': [id(5), 0],
      'Entrega 6': [id(5), 1],
    })
  })

  it('posição além do fim vira o fim dos irmãos', () => {
    const roots = [node(1, null, 0), node(2, null, 1)]
    const changed = arrangeAfterMove(roots, id(1), { parentId: null, position: 99 })
    expect(movedPositions(changed)).toEqual({ 'Entrega 2': [null, 0], 'Entrega 1': [null, 1] })
  })

  it('mover para o mesmo lugar não muda nada', () => {
    const roots = [node(1, null, 0), node(2, null, 1)]
    expect(arrangeAfterMove(roots, id(2), { parentId: null, position: 1 })).toEqual([])
  })

  it('as mesmas regras de profundidade e ciclo valem aqui', () => {
    expect(() => arrangeAfterMove(chain, id(1), { parentId: id(3), position: 0 })).toThrow(
      ValidationError,
    )
    expect(() => arrangeAfterMove(chain, id(9), { parentId: null, position: 0 })).toThrow(
      NotFoundError,
    )
  })
})
