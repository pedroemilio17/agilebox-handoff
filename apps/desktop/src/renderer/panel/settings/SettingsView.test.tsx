import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { WINDOW_OPACITY_KEY } from '../../shared/lib/window-opacity'
import { createFakeApi } from '../../shared/testing/fake-api'
import { teamToolsView } from '../../shared/testing/team-tools-fixture'
import { SettingsView } from './SettingsView'

/** Ajustes usa a API (ferramentas da equipe), então o teste monta os provedores. */
async function renderSettings() {
  const api = createFakeApi()
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(teamToolsView({ modules: [], level: 'basic' }))
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: '01HZANA000000000000000000B',
    organizationId: '01HZTEAM00000000000000000C',
    role: 'collaborator',
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <SettingsView />
      </QueryClientProvider>
    </ApiProvider>,
  )
  await userEvent.setup().click(screen.getByRole('button', { name: 'Minhas preferências' }))
}

const updates = {
  check: () => Promise.resolve({ state: 'up-to-date', commit: 'x' }),
  apply: () => Promise.resolve({ state: 'ready' }),
  restart: () => Promise.resolve({ state: 'started' }),
  lastRun: () => Promise.resolve(null),
  info: () => Promise.resolve({ version: '0.2.0', mode: 'source' }),
  onProgress: () => () => undefined,
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
    await renderSettings()
    const slider = screen.getByLabelText<HTMLInputElement>('Opacidade do vidro fosco')
    expect(slider.value).toBe('68')
    expect(screen.getByText('68%')).toBeTruthy()

    fireEvent.change(slider, { target: { value: '85' } })
    expect(screen.getByText('85%')).toBeTruthy()
    expect(window.localStorage.getItem(WINDOW_OPACITY_KEY)).toBe('0.85')
    expect(document.documentElement.style.getPropertyValue('--glass-window-alpha')).toBe('0.85')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    expect(slider.value).toBe('68')
  })

  it('abre com o valor salvo antes', async () => {
    window.localStorage.setItem(WINDOW_OPACITY_KEY, '0.5')
    await renderSettings()
    expect(screen.getByLabelText<HTMLInputElement>('Opacidade do vidro fosco').value).toBe('50')
  })
})

describe('Ajustes: fundo da janela', () => {
  it('troca para opaco, pede a recriação das janelas e desliga a opacidade', async () => {
    const setAppearance = vi.fn()
    vi.stubGlobal('agilebox', { shell: { setAppearance }, updates })
    document.documentElement.dataset.glass = 'native'
    await renderSettings()
    expect(screen.getByRole('button', { name: 'Vidro' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sólido' }))
    expect(setAppearance).toHaveBeenCalledWith({ mode: 'opaque' })
    expect(window.localStorage.getItem('agilebox.reopenSettings')).toBe('1')
    expect(screen.getByLabelText<HTMLInputElement>('Opacidade do vidro fosco').disabled).toBe(true)
  })

  it('no modo opaco mostra "Sólido" selecionado', async () => {
    document.documentElement.dataset.glass = 'opaque'
    await renderSettings()
    expect(screen.getByRole('button', { name: 'Sólido' }).getAttribute('aria-pressed')).toBe('true')
  })
})
