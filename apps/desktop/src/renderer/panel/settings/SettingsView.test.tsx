import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { WINDOW_OPACITY_KEY } from '../../shared/lib/window-opacity'
import { SettingsView } from './SettingsView'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
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
