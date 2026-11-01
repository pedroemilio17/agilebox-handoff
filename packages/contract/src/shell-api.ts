import { z } from 'zod'
import { SHELL_CHANNELS, type ShellChannel } from './channels'

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

export const shellApiChannels: readonly ShellChannel[] = SHELL_CHANNELS
