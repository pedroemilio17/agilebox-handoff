import { describe, expect, it } from 'vitest'
import { anchorStyle, dragAnchorPoint, isPointerPoint } from './drag-anchor'

const card = { left: 300, top: 120, width: 240, height: 80 }

describe('Ancoragem do cartão arrastado', () => {
  it('mede o ponto do clique em relação ao canto do cartão', () => {
    // Pegou o cartão 30 px da esquerda e 12 px do topo.
    expect(dragAnchorPoint({ clientX: 330, clientY: 132 }, card)).toEqual({ x: 30, y: 12 })
  })

  it('limita a âncora dentro do cartão', () => {
    expect(dragAnchorPoint({ clientX: 100, clientY: 900 }, card)).toEqual({ x: 0, y: 80 })
    expect(dragAnchorPoint({ clientX: 900, clientY: 0 }, card)).toEqual({ x: 240, y: 0 })
  })

  it('sem ponteiro (teclado) ou sem medida válida, não há âncora', () => {
    expect(dragAnchorPoint(null, card)).toBeNull()
    expect(dragAnchorPoint({ clientX: 1, clientY: 1 }, { ...card, width: 0 })).toBeNull()
  })

  it('reconhece eventos de ponteiro e rejeita eventos de teclado', () => {
    expect(isPointerPoint({ clientX: 10, clientY: 20 })).toBe(true)
    expect(isPointerPoint(new KeyboardEvent('keydown', { key: ' ' }))).toBe(false)
    expect(isPointerPoint(null)).toBe(false)
  })
})

describe('Estilo que aplica a ancoragem', () => {
  it('gira e escala em torno do ponto do clique', () => {
    expect(anchorStyle({ x: 30, y: 12 })).toEqual({ transformOrigin: '30px 12px' })
  })

  it('arredonda casas decimais para não gerar valores longos', () => {
    expect(anchorStyle({ x: 30.123456, y: 12 })).toEqual({ transformOrigin: '30.12px 12px' })
  })

  it('sem âncora não define transform-origin (centro padrão)', () => {
    expect(anchorStyle(null)).toBeUndefined()
  })
})
