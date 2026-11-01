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
})
