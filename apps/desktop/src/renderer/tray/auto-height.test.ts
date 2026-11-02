import { describe, expect, it } from 'vitest'
import { autoHeight, clampHeight, tweenHeight, TRAY_HEIGHT_DURATION_MS } from './auto-height'

describe('altura automática da bandeja', () => {
  it('no início: 246 + 64 por linha visível, de 1 a 2 linhas', () => {
    expect(autoHeight('home', 0)).toBe(310)
    expect(autoHeight('home', 1)).toBe(310)
    expect(autoHeight('home', 2)).toBe(374)
    expect(autoHeight('home', 9)).toBe(374)
  })

  it('atualizar tem 560 e nova tarefa 316', () => {
    expect(autoHeight('update', 5)).toBe(560)
    expect(autoHeight('new', 5)).toBe(316)
  })

  it('o ajuste manual fica entre 260 e 600', () => {
    expect(clampHeight(100)).toBe(260)
    expect(clampHeight(900)).toBe(600)
    expect(clampHeight(333.4)).toBe(333)
  })
})

describe('transição da altura automática', () => {
  it('dura 450 ms, como o HANDOFF', () => {
    expect(TRAY_HEIGHT_DURATION_MS).toBe(450)
  })

  it('começa na altura anterior, termina na nova e passa por valores intermediários', () => {
    expect(tweenHeight(374, 310, 0)).toBe(374)
    expect(tweenHeight(374, 310, 1)).toBe(310)
    const middle = tweenHeight(374, 310, 0.5)
    expect(middle).toBeLessThan(374)
    expect(middle).toBeGreaterThan(310)
  })

  it('ignora progresso fora de 0 a 1', () => {
    expect(tweenHeight(374, 560, -1)).toBe(374)
    expect(tweenHeight(374, 560, 3)).toBe(560)
  })
})
