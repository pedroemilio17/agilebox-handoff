/**
 * Ancoragem do cartão que acompanha o ponteiro durante o arraste.
 *
 * O cartão flutuante deve girar e escalar em torno do ponto onde o usuário pegou o cartão, e não do
 * centro. Assim o ponteiro continua exatamente sobre o mesmo ponto do cartão do começo ao fim.
 */

export interface PointerPoint {
  clientX: number
  clientY: number
}

export interface BoxRect {
  left: number
  top: number
  width: number
  height: number
}

export interface AnchorPoint {
  /** Distância horizontal, em px, do canto esquerdo do cartão até o ponto do clique. */
  x: number
  /** Distância vertical, em px, do canto superior do cartão até o ponto do clique. */
  y: number
}

/** Confere se o evento que iniciou o arraste veio do ponteiro (mouse, caneta ou toque). */
export function isPointerPoint(event: unknown): event is PointerPoint {
  if (typeof event !== 'object' || event === null) return false
  const candidate = event as Partial<PointerPoint>
  return typeof candidate.clientX === 'number' && typeof candidate.clientY === 'number'
}

/**
 * Ponto de ancoragem dentro do cartão, em coordenadas locais. `null` quando não há ponteiro
 * (arraste por teclado) ou a medida do cartão é inválida: nesse caso vale o centro padrão.
 */
export function dragAnchorPoint(pointer: PointerPoint | null, card: BoxRect): AnchorPoint | null {
  if (!pointer || card.width <= 0 || card.height <= 0) return null
  return {
    x: clamp(pointer.clientX - card.left, 0, card.width),
    y: clamp(pointer.clientY - card.top, 0, card.height),
  }
}

/** Estilo inline que move o ponto de rotação e escala para o ponto do clique. */
export function anchorStyle(anchor: AnchorPoint | null): { transformOrigin: string } | undefined {
  if (!anchor) return undefined
  return { transformOrigin: `${formatPx(anchor.x)}px ${formatPx(anchor.y)}px` }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatPx(value: number): string {
  return Number(value.toFixed(2)).toString()
}
