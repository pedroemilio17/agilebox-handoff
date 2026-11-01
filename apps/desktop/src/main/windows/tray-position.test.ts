import { describe, expect, it } from 'vitest'
import { getTrayPosition } from './tray-position'

describe('getTrayPosition', () => {
  it('ancora a bandeja no canto inferior direito da área útil', () => {
    expect(
      getTrayPosition({ x: 100, y: 50, width: 1920, height: 1040 }, { width: 360, height: 640 }),
    ).toEqual({ x: 1660, y: 450 })
  })

  it('respeita a origem da área útil em monitores posicionados à esquerda ou acima', () => {
    expect(
      getTrayPosition(
        { x: -1280, y: -200, width: 1280, height: 1000 },
        { width: 360, height: 640 },
      ),
    ).toEqual({ x: -360, y: 160 })
  })
})
