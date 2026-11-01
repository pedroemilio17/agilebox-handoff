import { BrowserWindow, screen } from 'electron'
import type { ShellWindows } from '../ipc/register-shell-handlers'
import type { ChangeWindow } from '../ipc/change-broadcaster'
import type { GlassMode } from './glass'
import { createPanelWindow } from './panel-window'
import { getTrayPosition } from './tray-position'
import { createTrayWindow, TRAY_WINDOW_SIZE } from './tray-window'

export class WindowManager implements ShellWindows {
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

  minimize(sender: unknown): void {
    this.windowOf(sender)?.minimize()
  }

  close(sender: unknown): void {
    const window = this.windowOf(sender)
    if (window === undefined) return
    // A bandeja só some da tela; fechar o painel encerra o aplicativo (até o ícone de bandeja do M10.1).
    if (window === this.tray) window.hide()
    else window.close()
  }

  // No painel, "Recolher" mostra a bandeja e minimiza o painel; na bandeja, "Expandir" volta ao painel.
  toggleTray(sender: unknown): void {
    if (this.windowOf(sender) === this.tray) {
      this.openPanel()
      this.tray?.hide()
      return
    }
    this.createTray().show()
    this.panel?.minimize()
  }

  openPanel(): void {
    const panel = this.createPanel()
    if (panel.isMinimized()) panel.restore()
    panel.show()
    panel.focus()
  }

  setTrayHeight(height: number): void {
    if (this.tray === undefined || this.tray.isDestroyed()) return
    const bounds = this.tray.getBounds()
    // Mantém a borda inferior fixa: a bandeja cresce para cima.
    this.tray.setBounds({
      ...bounds,
      y: bounds.y + bounds.height - height,
      height,
    })
  }

  private windowOf(sender: unknown): BrowserWindow | undefined {
    return [this.panel, this.tray].find(
      (window) => window !== undefined && !window.isDestroyed() && window.webContents === sender,
    )
  }

  getAll(): readonly ChangeWindow[] {
    return [this.panel, this.tray]
      .filter((window): window is BrowserWindow => window !== undefined && !window.isDestroyed())
      .map((window) => ({ send: (channel, payload) => window.webContents.send(channel, payload) }))
  }

  destroyAll(): void {
    this.tray?.destroy()
    this.panel?.destroy()
    this.tray = undefined
    this.panel = undefined
  }
}
