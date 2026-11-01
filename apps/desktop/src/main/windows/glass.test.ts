import { describe, expect, it } from 'vitest'
import { resolveGlassMode } from './glass'

describe('resolveGlassMode', () => {
  it('usa vidro CSS por padrão', () => {
    expect(resolveGlassMode('win32', {})).toBe('css')
    expect(resolveGlassMode('darwin', {})).toBe('css')
  })

  it('usa janela opaca no Linux, onde o CSS não desfoca o desktop', () => {
    expect(resolveGlassMode('linux', {})).toBe('opaque')
    expect(resolveGlassMode('linux', { AGILEBOX_GLASS: 'native' })).toBe('opaque')
    expect(resolveGlassMode('linux', { AGILEBOX_GLASS: 'css' })).toBe('css')
  })

  it('usa vidro nativo somente quando solicitado no Windows 11', () => {
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
})
