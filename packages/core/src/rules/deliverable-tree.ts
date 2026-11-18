import { NotFoundError, ValidationError } from '../shared/errors'
import type { DeliverableId } from '../shared/ids'
import type { Deliverable } from '../entities/deliverable'

/**
 * Profundidade máxima da EAP (ADR-10). Constante de validação: para aumentar o limite, troque só
 * este número. Nível 1 é a raiz; a entrega de nível 3 não aceita filhos.
 */
export const MAX_DELIVERABLE_DEPTH = 3

/** Campos da entrega que a árvore precisa para validar uma posição. */
export type DeliverableNode = Pick<Deliverable, 'id' | 'projectId' | 'parentId'>

function indexById(all: readonly Deliverable[]): Map<DeliverableId, Deliverable> {
  return new Map(all.map((item) => [item.id, item]))
}

function childrenOf(all: readonly Deliverable[]): Map<DeliverableId | null, Deliverable[]> {
  const groups = new Map<DeliverableId | null, Deliverable[]>()
  for (const item of all) {
    const siblings = groups.get(item.parentId) ?? []
    siblings.push(item)
    groups.set(item.parentId, siblings)
  }
  return groups
}

/** Nível de uma entrega existente: 1 para a raiz, 2 para filho de raiz e assim por diante. */
export function deliverableLevel(id: DeliverableId, all: readonly Deliverable[]): number {
  const byId = indexById(all)
  const visited = new Set<DeliverableId>()
  let current = byId.get(id)
  if (!current) throw new NotFoundError('Entrega não encontrada')
  let level = 1
  while (current.parentId !== null) {
    if (visited.has(current.id)) throw new ValidationError('Hierarquia da EAP inválida')
    visited.add(current.id)
    const parent = byId.get(current.parentId)
    if (!parent) throw new NotFoundError('Entrega pai não encontrada')
    level += 1
    current = parent
  }
  return level
}

/** Quantos níveis a entrega e os descendentes ocupam, contando a própria entrega (folha = 1). */
export function deliverableHeight(id: DeliverableId, all: readonly Deliverable[]): number {
  const children = childrenOf(all)
  const visit = (node: DeliverableId, path: ReadonlySet<DeliverableId>): number => {
    if (path.has(node)) throw new ValidationError('Hierarquia da EAP inválida')
    const nextPath = new Set(path).add(node)
    const below = (children.get(node) ?? []).map((child) => visit(child.id, nextPath))
    return 1 + Math.max(0, ...below)
  }
  return visit(id, new Set())
}

/**
 * Valida onde a entrega fica: o pai (se houver) existe no mesmo projeto, não cria ciclo e, com a
 * subárvore inteira, não passa de `MAX_DELIVERABLE_DEPTH` níveis. `height` é 1 para entrega nova.
 */
export function assertDeliverablePlacement(
  node: DeliverableNode,
  all: readonly Deliverable[],
  height: number,
): void {
  const byId = indexById(all)
  let depth = 1
  if (node.parentId !== null) {
    const parent = byId.get(node.parentId)
    if (!parent) throw new NotFoundError('Entrega pai não encontrada')
    if (parent.projectId !== node.projectId)
      throw new ValidationError('A entrega pai é de outro projeto')
    // Subir pelos ancestrais do pai: encontrar a própria entrega significa ciclo.
    const visited = new Set<DeliverableId>()
    let ancestor: Deliverable | undefined = parent
    while (ancestor) {
      if (ancestor.id === node.id)
        throw new ValidationError('Uma entrega não pode ficar dentro dela mesma')
      if (visited.has(ancestor.id)) throw new ValidationError('Hierarquia da EAP inválida')
      visited.add(ancestor.id)
      ancestor = ancestor.parentId === null ? undefined : byId.get(ancestor.parentId)
    }
    depth = deliverableLevel(parent.id, all) + 1
  }
  if (depth + height - 1 > MAX_DELIVERABLE_DEPTH)
    throw new ValidationError(`A EAP aceita até ${MAX_DELIVERABLE_DEPTH} níveis`)
}

/**
 * Código de cada entrega da árvore ("1", "1.2", "2.2.1"), pela ordem de `position` entre irmãos.
 * Não é gravado: muda sozinho quando a árvore muda. Entregas sem caminho até a raiz ficam de fora.
 */
export function deliverableCodes(all: readonly Deliverable[]): Map<DeliverableId, string> {
  const children = childrenOf(all)
  const codes = new Map<DeliverableId, string>()
  const siblingOrder = (a: Deliverable, b: Deliverable) =>
    a.position - b.position || a.id.localeCompare(b.id)
  const assign = (parentId: DeliverableId | null, prefix: string, path: ReadonlySet<string>) => {
    const siblings = [...(children.get(parentId) ?? [])].sort(siblingOrder)
    siblings.forEach((item, index) => {
      // Dado corrompido (ciclo) não pode girar para sempre: o caminho para na primeira repetição.
      if (path.has(item.id)) return
      const code = prefix === '' ? `${index + 1}` : `${prefix}.${index + 1}`
      codes.set(item.id, code)
      assign(item.id, code, new Set(path).add(item.id))
    })
  }
  assign(null, '', new Set())
  return codes
}

/** Posição de uma entrega entre os irmãos (inteiro não negativo). */
export function validateDeliverablePosition(position: number): number {
  if (!Number.isSafeInteger(position) || position < 0)
    throw new ValidationError('Posição da entrega inválida')
  return position
}

/**
 * Move a entrega para outro pai e/ou outra posição. Valida projeto, ciclo e profundidade (com a
 * subárvore). A reordenação dos irmãos fica a cargo de quem chama (ver `saveMany` no repositório).
 */
export function moveDeliverable(
  deliverable: Deliverable,
  all: readonly Deliverable[],
  target: { readonly parentId: DeliverableId | null; readonly position: number },
): Deliverable {
  const position = validateDeliverablePosition(target.position)
  if (target.parentId === deliverable.parentId && position === deliverable.position)
    return deliverable
  const height = deliverableHeight(deliverable.id, all)
  assertDeliverablePlacement(
    { id: deliverable.id, projectId: deliverable.projectId, parentId: target.parentId },
    all,
    height,
  )
  return { ...deliverable, parentId: target.parentId, position }
}

/** Ordem de exibição entre irmãos: posição e, em empate, id (a mesma de `deliverableCodes`). */
function inSiblingOrder(a: Deliverable, b: Deliverable): number {
  return a.position - b.position || a.id.localeCompare(b.id)
}

/**
 * Move a entrega e arruma os irmãos: ela entra no pai de destino na posição pedida (grudada no fim
 * se passar do tamanho) e os irmãos das duas pontas ficam com posições 0..n-1, sem buracos.
 * Devolve só as entregas cuja posição ou pai mudou, para o caso de uso gravar em lote. Mover para o
 * mesmo lugar devolve lista vazia.
 */
export function arrangeAfterMove(
  all: readonly Deliverable[],
  deliverableId: DeliverableId,
  target: { readonly parentId: DeliverableId | null; readonly position: number },
): Deliverable[] {
  const current = indexById(all).get(deliverableId)
  if (!current) throw new NotFoundError('Entrega não encontrada')
  const moved = moveDeliverable(current, all, target)
  if (moved === current) return []

  const changed = new Map<DeliverableId, Deliverable>()
  const siblingsOf = (parentId: DeliverableId | null) =>
    all
      .filter((item) => item.parentId === parentId && item.id !== deliverableId)
      .sort(inSiblingOrder)

  // Pai de origem: os irmãos que ficaram se reencaixam sem buraco.
  if (current.parentId !== moved.parentId) {
    siblingsOf(current.parentId).forEach((item, index) => {
      if (item.position !== index) changed.set(item.id, { ...item, position: index })
    })
  }

  // Pai de destino: a entrega entra na posição pedida e os irmãos seguintes empurram.
  const targetSiblings = siblingsOf(moved.parentId)
  const index = Math.min(moved.position, targetSiblings.length)
  const ordered = [...targetSiblings.slice(0, index), moved, ...targetSiblings.slice(index)]
  ordered.forEach((item, position) => {
    if (item.id === deliverableId) changed.set(item.id, { ...moved, position })
    else if (item.position !== position) changed.set(item.id, { ...item, position })
  })

  return [...changed.values()]
}
