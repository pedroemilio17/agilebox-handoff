import { SHELL_SCHEMA_REGISTRY } from '@agilebox/contract'
import type { ShellChannel } from '@agilebox/contract'

export interface ShellWindows {
  minimize(sender: unknown): void
  close(sender: unknown): void
  toggleTray(sender: unknown): void
  openPanel(): void
  setTrayHeight(height: number): void
}

export interface ShellIpcMainLike {
  handle(channel: string, listener: (event: { sender: unknown }, input: unknown) => void): void
}

export function registerShellHandlers(ipcMain: ShellIpcMainLike, windows: ShellWindows): void {
  const register = (channel: ShellChannel, run: (sender: unknown, input: unknown) => void) => {
    ipcMain.handle(channel, (event, input) => {
      const parsed = SHELL_SCHEMA_REGISTRY[channel].input.safeParse(input)
      if (parsed.success) run(event.sender, parsed.data)
    })
  }

  register('window.minimize', (sender) => windows.minimize(sender))
  register('window.close', (sender) => windows.close(sender))
  register('window.toggleTray', (sender) => windows.toggleTray(sender))
  register('window.openPanel', () => windows.openPanel())
  register('window.setTrayHeight', (_sender, input) =>
    windows.setTrayHeight((input as { height: number }).height),
  )
}
