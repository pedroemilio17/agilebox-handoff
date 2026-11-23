import {
  AI_CHANNELS,
  aiCompleteInputSchema,
  saveAiConfigInputSchema,
  type AiCompleteResult,
  type AiTestResult,
} from '@agilebox/contract'
import type { AiConfigStore } from './ai-config-store'
import type { GeminiClient } from './gemini-client'

export interface AiIpcMainLike {
  handle(channel: string, listener: (_event: unknown, input?: unknown) => unknown): void
}

export function registerAiHandlers(
  ipcMain: AiIpcMainLike,
  store: AiConfigStore,
  client: GeminiClient,
): void {
  ipcMain.handle(AI_CHANNELS.getConfig, () => store.getStatus())

  ipcMain.handle(AI_CHANNELS.saveConfig, (_event, input) => {
    const parsed = saveAiConfigInputSchema.parse(input)
    return store.save(parsed)
  })

  ipcMain.handle(AI_CHANNELS.clearKey, () => store.clearKey())

  ipcMain.handle(AI_CHANNELS.testConnection, async (): Promise<AiTestResult> => {
    const apiKey = store.readApiKey()
    const status = store.getStatus()
    if (!apiKey) {
      return { ok: false, message: 'Salve uma chave da API antes de testar.' }
    }
    return client.testConnection(apiKey, status.model)
  })

  ipcMain.handle(AI_CHANNELS.complete, async (_event, input): Promise<AiCompleteResult> => {
    const parsed = aiCompleteInputSchema.parse(input)
    const apiKey = store.readApiKey()
    const status = store.getStatus()
    if (!apiKey) {
      return {
        ok: false,
        reason: 'not_configured',
        message: 'Nenhuma chave da API configurada em Ajustes.',
      }
    }
    return client.complete(apiKey, status.model, parsed)
  })
}
