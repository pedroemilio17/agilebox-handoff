import { afterEach, describe, expect, it } from 'vitest'
import {
  clampOpacity,
  readWindowOpacity,
  saveWindowOpacity,
  WINDOW_OPACITY_DEFAULT,
  WINDOW_OPACITY_KEY,
} from './window-opacity'

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.style.removeProperty('--glass-window-alpha')
})

describe('opacidade da janela', () => {
  it('limita entre 30% e 95% e arredonda em centésimos', () => {
    expect(clampOpacity(0.1)).toBe(0.3)
    expect(clampOpacity(2)).toBe(0.95)
    expect(clampOpacity(0.734)).toBe(0.73)
    expect(clampOpacity(Number.NaN)).toBe(WINDOW_OPACITY_DEFAULT)
  })

  it('usa o padrão sem valor salvo e guarda o valor escolhido', () => {
    expect(readWindowOpacity()).toBe(WINDOW_OPACITY_DEFAULT)
    saveWindowOpacity(0.8)
    expect(window.localStorage.getItem(WINDOW_OPACITY_KEY)).toBe('0.8')
    expect(readWindowOpacity()).toBe(0.8)
    expect(document.documentElement.style.getPropertyValue('--glass-window-alpha')).toBe('0.8')
  })
})
