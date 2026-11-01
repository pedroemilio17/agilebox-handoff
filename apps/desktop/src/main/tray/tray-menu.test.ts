import { describe, expect, it, vi } from 'vitest'
import { buildTrayMenu, shouldHideOnClose } from './tray-menu'

describe('menu do ícone de bandeja', () => {
  it('tem "Abrir painel" e "Sair" ligados às ações', () => {
    const handlers = { openPanel: vi.fn(), quit: vi.fn() }
    const menu = buildTrayMenu(handlers)
    expect(menu.map((item) => item.label)).toEqual(['Abrir painel', 'Sair'])
    menu[0]!.click()
    menu[1]!.click()
    expect(handlers.openPanel).toHaveBeenCalledTimes(1)
    expect(handlers.quit).toHaveBeenCalledTimes(1)
  })
})

describe('fechar o painel', () => {
  it('recolhe para a bandeja no Windows e no macOS e encerra no Linux', () => {
    expect(shouldHideOnClose('win32')).toBe(true)
    expect(shouldHideOnClose('darwin')).toBe(true)
    expect(shouldHideOnClose('linux')).toBe(false)
  })
})
