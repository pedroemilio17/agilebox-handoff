import { z } from 'zod'
import { SHELL_CHANNELS, type ShellChannel } from './channels'
import type { ApiInput, ApiOutput } from './api'
import type { ApiResult } from './result'
import type { ApiChannel } from './channels'
import type { ChangeEvent } from './changes'

const voidSchema = z.void()
const trayHeightInputSchema = z.object({ height: z.number().int().positive() })

export const SHELL_SCHEMA_REGISTRY = {
  'window.minimize': { input: voidSchema, output: voidSchema },
  'window.close': { input: voidSchema, output: voidSchema },
  'window.toggleTray': { input: voidSchema, output: voidSchema },
  'window.openPanel': { input: voidSchema, output: voidSchema },
  'window.setTrayHeight': { input: trayHeightInputSchema, output: voidSchema },
} satisfies Record<ShellChannel, { input: z.ZodType; output: z.ZodType }>

export interface DesktopShellApi {
  minimize(): void
  close(): void
  toggleTray(): void
  openPanel(): void
  setTrayHeight(input: z.infer<typeof trayHeightInputSchema>): void
}

export interface AgileBoxBridge {
  invoke<Channel extends ApiChannel>(
    channel: Channel,
    input: ApiInput<Channel>,
  ): Promise<ApiResult<ApiOutput<Channel>>>
  onChanges(callback: (change: ChangeEvent) => void): () => void
  shell: DesktopShellApi
}

export const shellApiChannels: readonly ShellChannel[] = SHELL_CHANNELS
