import { describe, expect, it } from 'vitest'
import { detectCompositorGlass, hasLiquidGlass } from './compositor-glass'

describe('vidro do compositor', () => {
  it('reconhece a extensão Liquid Glass na lista do GNOME Shell', () => {
    expect(
      hasLiquidGlass(
        "['dash-to-dock@micxgx.gmail.com', 'liquid-glass@thinkingcoding1231.gmail.com']",
      ),
    ).toBe(true)
    expect(hasLiquidGlass("['dash-to-dock@micxgx.gmail.com']")).toBe(false)
  })

  it('não consulta o GNOME fora do Linux', () => {
    expect(detectCompositorGlass('win32')).toBe(false)
  })
})
