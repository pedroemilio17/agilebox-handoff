import { describe, expect, it } from 'vitest'
import {
  autoHeight,
  autoWidth,
  TRAY_COMPACT_HEIGHT,
  TRAY_COMPACT_WIDTH,
  TRAY_EXPANDED_HEIGHT,
  TRAY_EXPANDED_WIDTH,
  tweenHeight,
  TRAY_HEIGHT_DURATION_MS,
} from './auto-height'

describe('dimensões da bandeja (protótipo bandeja.html)', () => {
  it('aviso compacto mede 340×62 e as telas expandidas 430×630', () => {
    expect(autoWidth('prompt')).toBe(TRAY_COMPACT_WIDTH)
    expect(TRAY_COMPACT_WIDTH).toBe(340)
    expect(autoHeight('prompt')).toBe(TRAY_COMPACT_HEIGHT)
    expect(TRAY_COMPACT_HEIGHT).toBe(62)

    for (const kind of ['home', 'kan', 'new', 'update', 'daily'] as const) {
      expect(autoWidth(kind)).toBe(TRAY_EXPANDED_WIDTH)
      expect(autoHeight(kind)).toBe(TRAY_EXPANDED_HEIGHT)
    }
    expect(TRAY_EXPANDED_WIDTH).toBe(430)
    expect(TRAY_EXPANDED_HEIGHT).toBe(630)
  })
})

describe('transição da janela', () => {
  it('dura 240 ms, como no protótipo', () => {
    expect(TRAY_HEIGHT_DURATION_MS).toBe(240)
  })

  it('começa na dimensão anterior, termina na nova e passa por valores intermediários', () => {
    expect(tweenHeight(630, 62, 0)).toBe(630)
    expect(tweenHeight(630, 62, 1)).toBe(62)
    const middle = tweenHeight(630, 62, 0.5)
    expect(middle).toBeLessThan(630)
    expect(middle).toBeGreaterThan(62)
  })

  it('usa curva ease-ios: já passa da metade do caminho no meio do tempo', () => {
    expect(tweenHeight(0, 100, 0.5)).toBeGreaterThan(50)
  })

  it('ignora progresso fora de 0 a 1', () => {
    expect(tweenHeight(468, 600, -1)).toBe(468)
    expect(tweenHeight(468, 600, 3)).toBe(600)
  })
})
