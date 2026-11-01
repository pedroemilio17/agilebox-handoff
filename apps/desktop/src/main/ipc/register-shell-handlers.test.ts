import { describe, expect, it, vi } from 'vitest'
import { SHELL_CHANNELS } from '@agilebox/contract'
import { registerShellHandlers } from './register-shell-handlers'
import type { ShellWindows } from './register-shell-handlers'

function setup() {
  const listeners = new Map<string, (event: { sender: unknown }, input: unknown) => void>()
  const mocks = {
    minimize: vi.fn(),
    close: vi.fn(),
    toggleTray: vi.fn(),
    openPanel: vi.fn(),
    setTrayHeight: vi.fn(),
  }
  const windows: ShellWindows = mocks
  registerShellHandlers(
    { handle: (channel, listener) => listeners.set(channel, listener) },
    windows,
  )
  return { listeners, windows: mocks }
}

describe('handlers IPC da janela', () => {
  it('registra um handler para cada canal da janela', () => {
    expect(new Set(setup().listeners.keys())).toEqual(new Set(SHELL_CHANNELS))
  })

  it('repassa a janela de origem em minimizar, fechar e alternar a bandeja', () => {
    const { listeners, windows } = setup()
    const sender = { id: 1 }
    listeners.get('window.minimize')!({ sender }, undefined)
    listeners.get('window.close')!({ sender }, undefined)
    listeners.get('window.toggleTray')!({ sender }, undefined)
    expect(windows.minimize).toHaveBeenCalledWith(sender)
    expect(windows.close).toHaveBeenCalledWith(sender)
    expect(windows.toggleTray).toHaveBeenCalledWith(sender)
  })

  it('abre o painel e ajusta a altura da bandeja', () => {
    const { listeners, windows } = setup()
    listeners.get('window.openPanel')!({ sender: {} }, undefined)
    listeners.get('window.setTrayHeight')!({ sender: {} }, { height: 480 })
    expect(windows.openPanel).toHaveBeenCalledTimes(1)
    expect(windows.setTrayHeight).toHaveBeenCalledWith(480)
  })

  it('ignora entrada inválida', () => {
    const { listeners, windows } = setup()
    listeners.get('window.setTrayHeight')!({ sender: {} }, { height: -5 })
    listeners.get('window.setTrayHeight')!({ sender: {} }, 'x')
    expect(windows.setTrayHeight).not.toHaveBeenCalled()
  })
})
