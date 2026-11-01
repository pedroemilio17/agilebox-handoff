import { describe, expect, it } from 'vitest'
import { resolveGlassMode, windowChrome } from './glass'

describe('resolveGlassMode', () => {
  it('usa vidro CSS onde não há vidro do sistema', () => {
    expect(resolveGlassMode('win32', {})).toBe('css')
    expect(resolveGlassMode('win32', { systemVersion: '10.0.19045' })).toBe('css')
    expect(resolveGlassMode('darwin', {})).toBe('css')
  })

  it('usa janela opaca no Linux, onde o CSS não desfoca o desktop', () => {
    expect(resolveGlassMode('linux', {})).toBe('opaque')
    expect(resolveGlassMode('linux', { AGILEBOX_GLASS: 'native' })).toBe('opaque')
    expect(resolveGlassMode('linux', { AGILEBOX_GLASS: 'css' })).toBe('css')
  })

  it('usa o Acrylic por padrão no Windows 11 e permite voltar ao CSS', () => {
    expect(resolveGlassMode('win32', { systemVersion: '10.0.22631' })).toBe('native')
    expect(
      resolveGlassMode('win32', { AGILEBOX_GLASS: 'native', systemVersion: '10.0.22631' }),
    ).toBe('native')
    expect(
      resolveGlassMode('win32', { AGILEBOX_GLASS: 'native', systemVersion: '10.0.19045' }),
    ).toBe('css')
    expect(resolveGlassMode('win32', { AGILEBOX_GLASS: 'css', systemVersion: '10.0.22631' })).toBe(
      'css',
    )
  })

  it('usa o vidro do GNOME Shell quando a extensão Liquid Glass está ativa', () => {
    expect(resolveGlassMode('linux', { compositorGlass: true })).toBe('compositor')
    expect(resolveGlassMode('linux', { compositorGlass: false })).toBe('opaque')
    expect(resolveGlassMode('linux', { compositorGlass: true, AGILEBOX_GLASS: 'opaque' })).toBe(
      'opaque',
    )
    expect(resolveGlassMode('linux', { AGILEBOX_GLASS: 'compositor' })).toBe('compositor')
    expect(resolveGlassMode('win32', { compositorGlass: true })).toBe('css')
  })

  it('a preferência "opaco" de Ajustes vence a detecção; "translúcido" usa o melhor vidro disponível', () => {
    expect(resolveGlassMode('win32', { systemVersion: '10.0.22631', preference: 'opaque' })).toBe(
      'opaque',
    )
    expect(resolveGlassMode('linux', { compositorGlass: true, preference: 'opaque' })).toBe(
      'opaque',
    )
    expect(
      resolveGlassMode('win32', { systemVersion: '10.0.22631', preference: 'translucent' }),
    ).toBe('native')
    expect(resolveGlassMode('linux', { preference: 'translucent' })).toBe('css')
    expect(resolveGlassMode('linux', { preference: 'opaque', AGILEBOX_GLASS: 'compositor' })).toBe(
      'compositor',
    )
  })
})

describe('windowChrome', () => {
  it('no Acrylic mantém a moldura do sistema e esconde só a barra de título', () => {
    expect(windowChrome('native')).toEqual({
      titleBarStyle: 'hidden',
      transparent: false,
      backgroundMaterial: 'acrylic',
      backgroundColor: '#00000000',
    })
  })

  it('nos outros modos a janela é sem moldura; transparente só quando há vidro', () => {
    expect(windowChrome('css')).toMatchObject({ frame: false, transparent: true })
    expect(windowChrome('compositor')).toMatchObject({ frame: false, transparent: true })
    expect(windowChrome('opaque')).toMatchObject({
      frame: false,
      transparent: false,
      backgroundColor: '#1e212a',
    })
  })
})
