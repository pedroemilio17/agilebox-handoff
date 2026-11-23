import { describe, expect, it, vi } from 'vitest'
import type { AiCompleteInput } from '@agilebox/contract'
import { createGeminiClient } from './gemini-client'

const SAMPLE_INPUT: AiCompleteInput = {
  prompt: 'Mova a AB-5 para Revisar e bloqueie a AB-6 se possível',
  history: [],
  context: {
    actorName: 'Pedro',
    actorRole: 'collaborator',
    projects: [{ id: 'p1', name: 'Projeto A' }],
    users: [{ id: 'u1', name: 'Pedro' }],
    tasks: [
      {
        id: 't5',
        key: 'AB-5',
        title: 'Webhook de boleto',
        status: 'in_progress',
        projectName: 'Projeto A',
        blocked: false,
      },
    ],
    capabilities: { checkins: true, impediments: false },
  },
}

describe('gemini-client', () => {
  it('envia chave no cabeçalho, interpreta JSON estruturado e filtra ações não permitidas', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: 'Movi a AB-5 para Revisar.',
                      actions: [
                        { kind: 'move_task', taskKey: 'AB-5', status: 'review' },
                        { kind: 'block_task', taskKey: 'AB-6', reason: 'Sem acesso' },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const client = createGeminiClient({ fetchImpl: fetchMock })
    const result = await client.complete('AIzaSecret', 'gemini-2.5-flash', SAMPLE_INPUT)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    )
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'AIzaSecret',
    })
    expect(result).toEqual({
      ok: true,
      reply: 'Movi a AB-5 para Revisar.',
      actions: [{ kind: 'move_task', taskKey: 'AB-5', status: 'review' }],
    })
  })

  it('retorna erro legível para HTTP 401/403 e 429', async () => {
    const unauthorized = createGeminiClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 403 })),
    })
    expect(await unauthorized.complete('bad', 'gemini-2.5-flash', SAMPLE_INPUT)).toEqual({
      ok: false,
      reason: 'api_error',
      message: 'Chave da API inválida ou sem permissão.',
    })

    const rateLimited = createGeminiClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 429 })),
    })
    expect(await rateLimited.complete('key', 'gemini-2.5-flash', SAMPLE_INPUT)).toEqual({
      ok: false,
      reason: 'api_error',
      message: 'Limite temporário da API atingido. Tente novamente em instantes.',
    })
  })

  it('trata falha de rede e JSON malformado', async () => {
    const netClient = createGeminiClient({
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    })
    expect(await netClient.complete('key', 'gemini-2.5-flash', SAMPLE_INPUT)).toEqual({
      ok: false,
      reason: 'network',
      message: 'Sem conexão com a API do Gemini no momento.',
    })

    const badJsonClient = createGeminiClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'não é json válido' }] } }],
          }),
          { status: 200 },
        ),
      ),
    })
    expect(await badJsonClient.complete('key', 'gemini-2.5-flash', SAMPLE_INPUT)).toEqual({
      ok: false,
      reason: 'invalid_response',
      message: 'A resposta do modelo veio em um formato inesperado.',
    })
  })

  it('testa conexão com retorno claro de sucesso ou falha', async () => {
    const okClient = createGeminiClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })),
    })
    expect(await okClient.testConnection('AIzaOk', 'gemini-2.0-flash')).toEqual({
      ok: true,
      model: 'gemini-2.0-flash',
    })

    const failClient = createGeminiClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 })),
    })
    expect(await failClient.testConnection('bad', 'gemini-2.0-flash')).toEqual({
      ok: false,
      message: 'Chave da API inválida ou sem permissão.',
    })
  })
})
