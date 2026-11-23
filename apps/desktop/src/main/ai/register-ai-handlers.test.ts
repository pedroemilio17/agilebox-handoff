import { describe, expect, it, vi } from 'vitest'
import { AI_CHANNELS, type AiCompleteInput, type AiConfigStatus } from '@agilebox/contract'
import type { AiConfigStore } from './ai-config-store'
import type { GeminiClient } from './gemini-client'
import { registerAiHandlers } from './register-ai-handlers'

const SAMPLE_COMPLETE: AiCompleteInput = {
  prompt: 'Quais minhas tarefas?',
  history: [],
  context: {
    actorName: 'Pedro',
    actorRole: 'collaborator',
    projects: [],
    users: [],
    tasks: [],
    capabilities: { checkins: false, impediments: false },
  },
}

function setup(apiKey: string | null = null) {
  const handlers = new Map<string, (event: unknown, input?: unknown) => unknown>()
  const saveSpy = vi.fn<AiConfigStore['save']>((input): AiConfigStatus => ({
    configured: Boolean(input.apiKey || apiKey),
    model: input.model,
    encrypted: true,
  }))
  const store: AiConfigStore = {
    getStatus: vi.fn<AiConfigStore['getStatus']>(() => ({
      configured: apiKey !== null,
      model: 'gemini-2.5-flash',
      encrypted: true,
    })),
    readApiKey: vi.fn<AiConfigStore['readApiKey']>(() => apiKey),
    save: saveSpy,
    clearKey: vi.fn<AiConfigStore['clearKey']>(() => ({
      configured: false,
      model: 'gemini-2.5-flash',
      encrypted: false,
    })),
  }
  const testConnectionSpy = vi.fn<GeminiClient['testConnection']>((_k, model) =>
    Promise.resolve({ ok: true, model }),
  )
  const completeSpy = vi.fn<GeminiClient['complete']>(() =>
    Promise.resolve({ ok: true, reply: 'Olá', actions: [] }),
  )
  const client: GeminiClient = {
    testConnection: testConnectionSpy,
    complete: completeSpy,
  }
  registerAiHandlers(
    { handle: (channel, listener) => handlers.set(channel, listener) },
    store,
    client,
  )
  return { handlers, saveSpy, testConnectionSpy, completeSpy }
}

describe('registerAiHandlers', () => {
  it('registra todos os 5 canais de IA', () => {
    const { handlers } = setup()
    expect(new Set(handlers.keys())).toEqual(new Set(Object.values(AI_CHANNELS)))
  })

  it('sem chave salva responde aviso claro em testConnection e not_configured em complete', async () => {
    const { handlers, testConnectionSpy, completeSpy } = setup(null)
    expect(await handlers.get(AI_CHANNELS.testConnection)!({})).toEqual({
      ok: false,
      message: 'Salve uma chave da API antes de testar.',
    })
    expect(await handlers.get(AI_CHANNELS.complete)!({}, SAMPLE_COMPLETE)).toEqual({
      ok: false,
      reason: 'not_configured',
      message: 'Nenhuma chave da API configurada em Ajustes.',
    })
    expect(testConnectionSpy).not.toHaveBeenCalled()
    expect(completeSpy).not.toHaveBeenCalled()
  })

  it('salva, testa conexão e completa quando há chave configurada', async () => {
    const { handlers, saveSpy, testConnectionSpy, completeSpy } = setup('AIzaValida')
    expect(
      handlers.get(AI_CHANNELS.saveConfig)!({}, { apiKey: 'AIzaNova', model: 'gemini-2.0-flash' }),
    ).toEqual({
      configured: true,
      model: 'gemini-2.0-flash',
      encrypted: true,
    })
    expect(saveSpy).toHaveBeenCalledWith({ apiKey: 'AIzaNova', model: 'gemini-2.0-flash' })

    expect(await handlers.get(AI_CHANNELS.testConnection)!({})).toEqual({
      ok: true,
      model: 'gemini-2.5-flash',
    })
    expect(testConnectionSpy).toHaveBeenCalledWith('AIzaValida', 'gemini-2.5-flash')

    expect(await handlers.get(AI_CHANNELS.complete)!({}, SAMPLE_COMPLETE)).toEqual({
      ok: true,
      reply: 'Olá',
      actions: [],
    })
    expect(completeSpy).toHaveBeenCalledWith('AIzaValida', 'gemini-2.5-flash', SAMPLE_COMPLETE)
  })
})
