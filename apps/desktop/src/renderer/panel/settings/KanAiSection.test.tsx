import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiConfigStatus, DesktopAiApi } from '@agilebox/contract'
import { KanAiSection } from './KanAiSection'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup(
  initial: AiConfigStatus = { configured: false, model: 'gemini-2.5-flash', encrypted: true },
) {
  let current = initial
  const saveConfig = vi.fn<DesktopAiApi['saveConfig']>((input) => {
    current = {
      configured: Boolean(input.apiKey?.trim()) || current.configured,
      model: input.model,
      encrypted: initial.encrypted,
    }
    return Promise.resolve(current)
  })
  const clearKey = vi.fn<DesktopAiApi['clearKey']>(() => {
    current = { configured: false, model: current.model, encrypted: false }
    return Promise.resolve(current)
  })
  const ai: DesktopAiApi = {
    getConfig: vi.fn<DesktopAiApi['getConfig']>(() => Promise.resolve(current)),
    saveConfig,
    clearKey,
    testConnection: vi.fn<DesktopAiApi['testConnection']>(() =>
      Promise.resolve({ ok: true, model: current.model }),
    ),
    complete: vi.fn<DesktopAiApi['complete']>(),
  }
  vi.stubGlobal('agilebox', { ai })
  render(<KanAiSection />)
  return { saveConfig, clearKey, user: userEvent.setup() }
}

describe('KanAiSection em Ajustes do App', () => {
  it('carrega estado inicial, salva chave e modelo e limpa o campo após gravar', async () => {
    const { saveConfig, user } = setup()
    expect(await screen.findByText('Modo local (sem chave salva)')).toBeTruthy()

    const keyInput = screen.getByLabelText<HTMLInputElement>('Chave da API Google AI Studio')
    await user.type(keyInput, 'AIzaMinhaChave')
    await user.selectOptions(screen.getByLabelText('Modelo Gemini'), 'gemini-2.5-flash-lite')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith({
        apiKey: 'AIzaMinhaChave',
        model: 'gemini-2.5-flash-lite',
      }),
    )
    expect(keyInput.value).toBe('')
    expect(await screen.findByText('Conectado · gemini-2.5-flash-lite')).toBeTruthy()
    expect(await screen.findByText('Configuração do assistente salva.')).toBeTruthy()
  })

  it('testa a conexão e permite remover a chave salva', async () => {
    const { clearKey, user } = setup({
      configured: true,
      model: 'gemini-2.5-flash',
      encrypted: true,
    })

    expect(await screen.findByText('Conectado · gemini-2.5-flash')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Testar conexão' }))
    expect(await screen.findByText('Conexão confirmada com gemini-2.5-flash.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Remover chave' }))
    await waitFor(() => expect(clearKey).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Modo local (sem chave salva)')).toBeTruthy()
    expect(await screen.findByText('Chave removida. O Kan voltou ao modo local.')).toBeTruthy()
  })
})
