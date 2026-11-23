import { describe, expect, it } from 'vitest'
import {
  AI_CHANNELS,
  AI_MODELS,
  DEFAULT_AI_MODEL,
  SHELL_SCHEMA_REGISTRY,
  aiCompleteInputSchema,
  aiCompleteResultSchema,
  aiConfigStatusSchema,
  aiProposedActionSchema,
  saveAiConfigInputSchema,
} from './index'

describe('contratos de IA do assistente Kan', () => {
  it('define canais e modelos oficiais sem chave crua no status', () => {
    expect(Object.values(AI_CHANNELS)).toEqual([
      'ai.getConfig',
      'ai.saveConfig',
      'ai.clearKey',
      'ai.testConnection',
      'ai.complete',
    ])
    expect(AI_MODELS).toContain(DEFAULT_AI_MODEL)
    expect(
      aiConfigStatusSchema.parse({ configured: true, model: DEFAULT_AI_MODEL, encrypted: true }),
    ).toEqual({
      configured: true,
      model: 'gemini-2.5-flash',
      encrypted: true,
    })
  })

  it('aceita salvar modelo sem reenviar a chave e rejeita modelo desconhecido', () => {
    expect(saveAiConfigInputSchema.parse({ model: 'gemini-2.5-flash-lite' })).toEqual({
      model: 'gemini-2.5-flash-lite',
    })
    expect(
      saveAiConfigInputSchema.safeParse({ apiKey: 'AIza123', model: 'outro-modelo' }).success,
    ).toBe(false)
  })

  it('valida ações propostas com os estados oficiais da tarefa', () => {
    const move = aiProposedActionSchema.parse({
      kind: 'move_task',
      taskKey: 'AB-5',
      status: 'review',
    })
    expect(move).toEqual({ kind: 'move_task', taskKey: 'AB-5', status: 'review' })
    expect(
      aiProposedActionSchema.safeParse({
        kind: 'move_task',
        taskKey: 'AB-5',
        status: 'invalido',
      }).success,
    ).toBe(false)

    const result = aiCompleteResultSchema.parse({
      ok: true,
      reply: 'Pronto.',
      actions: [
        { kind: 'create_task', title: 'Revisar deploy', status: 'todo' },
        { kind: 'log_hours', taskKey: 'AB-5', hours: 1.5 },
      ],
    })
    expect(result.ok).toBe(true)
  })

  it('valida contexto de entrada e dimensões da bandeja com ou sem width', () => {
    const input = aiCompleteInputSchema.parse({
      prompt: 'Mover AB-1 para Revisar',
      history: [{ role: 'user', text: 'Oi Kan' }],
      context: {
        actorName: 'Pedro',
        actorRole: 'collaborator',
        projects: [{ id: 'p1', name: 'Projeto A' }],
        users: [{ id: 'u1', name: 'Pedro' }],
        tasks: [
          {
            id: 't1',
            key: 'AB-1',
            title: 'Testar bandeja',
            status: 'in_progress',
            projectName: 'Projeto A',
            blocked: false,
          },
        ],
        capabilities: { checkins: true, impediments: false },
      },
    })
    expect(input.context.tasks).toHaveLength(1)

    const traySchema = SHELL_SCHEMA_REGISTRY['window.setTrayHeight'].input
    expect(traySchema.parse({ height: 480 })).toEqual({ height: 480 })
    expect(traySchema.parse({ height: 88, width: 340 })).toEqual({ height: 88, width: 340 })
  })
})
