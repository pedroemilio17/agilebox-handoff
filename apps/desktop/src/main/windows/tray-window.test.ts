import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))

const { TRAY_COMPACT_SIZE, TRAY_WINDOW_SIZE } = await import('./tray-window')

describe('janela da bandeja', () => {
  it('define 340×88 no aviso compacto e 430×630 expandida', () => {
    expect(TRAY_COMPACT_SIZE).toEqual({ width: 340, height: 88 })
    expect(TRAY_WINDOW_SIZE).toEqual({ width: 430, height: 630 })
  })
})
