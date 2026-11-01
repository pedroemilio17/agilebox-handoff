import { z } from 'zod'
import { SHELL_CHANNELS, type ShellChannel } from './channels'
import type { ApiInput, ApiOutput } from './api'
import type { ApiResult } from './result'
import type { ApiChannel } from './channels'
import type { ChangeEvent } from './changes'
import type { DesktopUpdatesApi } from './updates'

const voidSchema = z.void()
const trayHeightInputSchema = z.object({ height: z.number().int().positive() })
export const appearanceModeSchema = z.enum(['translucent', 'opaque'])
const appearanceInputSchema = z.object({ mode: appearanceModeSchema })

export const SHELL_SCHEMA_REGISTRY = {
  'window.minimize': { input: voidSchema, output: voidSchema },
  'window.close': { input: voidSchema, output: voidSchema },
  'window.toggleTray': { input: voidSchema, output: voidSchema },
  'window.openPanel': { input: voidSchema, output: voidSchema },
  'window.setTrayHeight': { input: trayHeightInputSchema, output: voidSchema },
  'window.setAppearance': { input: appearanceInputSchema, output: voidSchema },
} satisfies Record<ShellChannel, { input: z.ZodType; output: z.ZodType }>

export interface DesktopShellApi {
  minimize(): void
  close(): void
  toggleTray(): void
  openPanel(): void
  setTrayHeight(input: z.infer<typeof trayHeightInputSchema>): void
  /** Translúcido (vidro do sistema) ou opaco; as janelas são recriadas com o novo fundo. */
  setAppearance(input: z.infer<typeof appearanceInputSchema>): void
}

export type AppearanceMode = z.infer<typeof appearanceModeSchema>

export interface AgileBoxBridge {
  invoke<Channel extends ApiChannel>(
    channel: Channel,
    input: ApiInput<Channel>,
  ): Promise<ApiResult<ApiOutput<Channel>>>
  onChanges(callback: (change: ChangeEvent) => void): () => void
  shell: DesktopShellApi
  updates: DesktopUpdatesApi
}

export const shellApiChannels: readonly ShellChannel[] = SHELL_CHANNELS
