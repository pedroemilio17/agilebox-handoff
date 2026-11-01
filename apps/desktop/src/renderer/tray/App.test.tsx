import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Bandeja (casca)', () => {
  it('expandir abre o painel e fechar esconde a bandeja', async () => {
    const shell = { minimize: vi.fn(), close: vi.fn(), toggleTray: vi.fn(), openPanel: vi.fn() }
    vi.stubGlobal('agilebox', { shell })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Expandir' }))
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(shell.openPanel).toHaveBeenCalledTimes(1)
    expect(shell.close).toHaveBeenCalledTimes(1)
  })
})
