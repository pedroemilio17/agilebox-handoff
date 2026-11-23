import { describe, expect, it } from 'vitest'
import {
  autoHeight,
  autoWidth,
  clampHeight,
  DAILY_INVITE_HEIGHT,
  TRAY_COMPACT_HEIGHT,
  TRAY_COMPACT_WIDTH,
  TRAY_EXPANDED_WIDTH,
  tweenHeight,
  TRAY_HEIGHT_DURATION_MS,
} from './auto-height'

describe('dimensões automáticas da nova bandeja', () => {
  it('aviso compacto mede 340×88 e telas expandidas usam largura 430', () => {
    expect(autoWidth('prompt')).toBe(TRAY_COMPACT_WIDTH)
    expect(TRAY_COMPACT_WIDTH).toBe(340)
    expect(autoHeight('prompt', 5)).toBe(TRAY_COMPACT_HEIGHT)
    expect(TRAY_COMPACT_HEIGHT).toBe(88)

    for (const kind of ['home', 'kan', 'new', 'update', 'daily'] as const) {
      expect(autoWidth(kind)).toBe(TRAY_EXPANDED_WIDTH)
      expect(TRAY_EXPANDED_WIDTH).toBe(430)
    }
  })

  it('no início: 340 + 64 por linha visível, de 1 a 3 linhas', () => {
    expect(autoHeight('home', 0)).toBe(404)
    expect(autoHeight('home', 1)).toBe(404)
    expect(autoHeight('home', 2)).toBe(468)
    expect(autoHeight('home', 3)).toBe(532)
    expect(autoHeight('home', 9)).toBe(532)
  })

  it('kan usa 630, atualizar usa 600 e nova tarefa 430', () => {
    expect(autoHeight('kan', 5)).toBe(630)
    expect(autoHeight('update', 5)).toBe(600)
    expect(autoHeight('new', 5)).toBe(430)
  })

  it('o ajuste manual fica entre 280 e 660', () => {
    expect(clampHeight(100)).toBe(280)
    expect(clampHeight(900)).toBe(660)
    expect(clampHeight(444.4)).toBe(444)
  })
})

describe('transição da altura automática', () => {
  it('dura 450 ms, como o HANDOFF', () => {
    expect(TRAY_HEIGHT_DURATION_MS).toBe(450)
  })

  it('começa na altura anterior, termina na nova e passa por valores intermediários', () => {
    expect(tweenHeight(468, 404, 0)).toBe(468)
    expect(tweenHeight(468, 404, 1)).toBe(404)
    const middle = tweenHeight(468, 404, 0.5)
    expect(middle).toBeLessThan(468)
    expect(middle).toBeGreaterThan(404)
  })

  it('ignora progresso fora de 0 a 1', () => {
    expect(tweenHeight(468, 600, -1)).toBe(468)
    expect(tweenHeight(468, 600, 3)).toBe(600)
  })
})

describe('altura automática com a barra de convite da daily', () => {
  it('a barra soma sua altura à tela inicial respeitando o teto de 630', () => {
    expect(autoHeight('home', 1, true)).toBe(404 + DAILY_INVITE_HEIGHT)
    expect(autoHeight('home', 2, true)).toBe(468 + DAILY_INVITE_HEIGHT)
    expect(autoHeight('home', 3, true)).toBe(630)
  })

  it('a daily usa a mesma altura de atualização de tarefa', () => {
    expect(autoHeight('daily', 2)).toBe(600)
  })
})
