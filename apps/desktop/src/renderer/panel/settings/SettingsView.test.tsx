import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WINDOW_OPACITY_KEY } from '../../shared/lib/window-opacity'
import { SettingsView } from './SettingsView'

const updates = {
  check: () => Promise.resolve({ state: 'up-to-date', commit: 'x' }),
  apply: () => Promise.resolve({ state: 'started' }),
  lastRun: () => Promise.resolve(null),
}

beforeEach(() => {
  vi.stubGlobal('agilebox', { shell: { setAppearance: vi.fn() }, updates })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.glass
})

describe('Ajustes: opacidade da janela', () => {
  it('mostra o padrão, salva o novo valor e restaura', async () => {
    render(<SettingsView />)
    const slider = screen.getByLabelText<HTMLInputElement>('Opacidade da janela')
    expect(slider.value).toBe('68')
    expect(screen.getByText('68%')).toBeTruthy()

    fireEvent.change(slider, { target: { value: '85' } })
    expect(screen.getByText('85%')).toBeTruthy()
    expect(window.localStorage.getItem(WINDOW_OPACITY_KEY)).toBe('0.85')
    expect(document.documentElement.style.getPropertyValue('--glass-window-alpha')).toBe('0.85')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    expect(slider.value).toBe('68')
  })

  it('abre com o valor salvo antes', () => {
    window.localStorage.setItem(WINDOW_OPACITY_KEY, '0.5')
    render(<SettingsView />)
    expect(screen.getByLabelText<HTMLInputElement>('Opacidade da janela').value).toBe('50')
  })
})

describe('Ajustes: fundo da janela', () => {
  it('troca para opaco, pede a recriação das janelas e desliga a opacidade', async () => {
    const setAppearance = vi.fn()
    vi.stubGlobal('agilebox', { shell: { setAppearance }, updates })
    document.documentElement.dataset.glass = 'native'
    render(<SettingsView />)
    expect(screen.getByRole('button', { name: 'Translúcido' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Opaco' }))
    expect(setAppearance).toHaveBeenCalledWith({ mode: 'opaque' })
    expect(window.localStorage.getItem('agilebox.reopenSettings')).toBe('1')
    expect(screen.getByLabelText<HTMLInputElement>('Opacidade da janela').disabled).toBe(true)
  })

  it('no modo opaco mostra "Opaco" selecionado', () => {
    document.documentElement.dataset.glass = 'opaque'
    render(<SettingsView />)
    expect(screen.getByRole('button', { name: 'Opaco' }).getAttribute('aria-pressed')).toBe('true')
  })
})
