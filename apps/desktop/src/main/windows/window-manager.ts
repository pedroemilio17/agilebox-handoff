import { BrowserWindow, screen } from 'electron'
import type { ChangeWindow } from '../ipc/change-broadcaster'
import type { GlassMode } from './glass'
import { createPanelWindow } from './panel-window'
import { getTrayPosition } from './tray-position'
import { createTrayWindow, TRAY_WINDOW_SIZE } from './tray-window'

export class WindowManager {
  private panel: BrowserWindow | undefined
  private tray: BrowserWindow | undefined

  constructor(
    private readonly glassMode: GlassMode,
    private readonly onPanelClosed: () => void = () => undefined,
  ) {}

  createPanel(): BrowserWindow {
    if (this.panel && !this.panel.isDestroyed()) return this.panel
    this.panel = createPanelWindow(this.glassMode)
    this.panel.on('closed', () => {
      this.panel = undefined
      this.onPanelClosed()
    })
    return this.panel
  }

  createTray(): BrowserWindow {
    if (this.tray && !this.tray.isDestroyed()) return this.tray
    const workArea = screen.getPrimaryDisplay().workArea
    const position = getTrayPosition(workArea, TRAY_WINDOW_SIZE)
    this.tray = createTrayWindow(this.glassMode, position)
    this.tray.on('closed', () => {
      this.tray = undefined
    })
    return this.tray
  }

  getAll(): readonly ChangeWindow[] {
    return [this.panel, this.tray]
      .filter((window): window is BrowserWindow => window !== undefined && !window.isDestroyed())
      .map((window) => ({ send: (channel, payload) => window.webContents.send(channel, payload) }))
  }

  close(): void {
    this.tray?.destroy()
    this.panel?.destroy()
    this.tray = undefined
    this.panel = undefined
  }
}
