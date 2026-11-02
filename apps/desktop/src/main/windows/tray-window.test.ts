import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))

const { TRAY_WINDOW_SIZE } = await import('./tray-window')

describe('janela da bandeja', () => {
  it('tem 360 px de largura, como o HANDOFF', () => {
    expect(TRAY_WINDOW_SIZE.width).toBe(360)
  })
})
