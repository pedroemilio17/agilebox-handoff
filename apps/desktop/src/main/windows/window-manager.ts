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

  private quitting = false

  constructor(
    private readonly glassMode: GlassMode,
    private readonly onPanelClosed: () => void = () => undefined,
    // Com ícone de bandeja confiável, fechar o painel só o esconde.
    private readonly hideOnClose = false,
  ) {}

  markQuitting(): void {
    this.quitting = true
  }

  createPanel(): BrowserWindow {
    if (this.panel && !this.panel.isDestroyed()) return this.panel
    this.panel = createPanelWindow(this.glassMode)
    this.panel.on('close', (event) => {
      if (!this.hideOnClose || this.quitting) return
      event.preventDefault()
      this.panel?.hide()
    })
    this.panel.on('closed', () => {
      this.panel = undefined
      this.onPanelClosed()
    })
    return this.panel
  }

  createTray(): BrowserWindow {
    if (this.tray && !this.tray.isDestroyed()) return this.tray
    this.tray = createTrayWindow(
      this.glassMode,
      getTrayPosition(screen.getPrimaryDisplay().workArea, TRAY_WINDOW_SIZE),
    )
    this.tray.on('closed', () => {
      this.tray = undefined
    })
    return this.tray
  }

  /** Clique no ícone: mostra a bandeja no canto do monitor do ícone, ou a esconde se já está visível. */
  toggleTrayWindow(iconBounds?: Electron.Rectangle): void {
    const tray = this.createTray()
    if (tray.isVisible()) tray.hide()
    else this.showTrayWindow(iconBounds)
  }

  private showTrayWindow(iconBounds?: Electron.Rectangle): void {
    const tray = this.createTray()
    const display = iconBounds
      ? screen.getDisplayNearestPoint({ x: iconBounds.x, y: iconBounds.y })
      : screen.getPrimaryDisplay()
    const height = tray.getBounds().height
    tray.setBounds({
      ...getTrayPosition(display.workArea, { width: TRAY_WINDOW_SIZE.width, height }),
      width: TRAY_WINDOW_SIZE.width,
      height,
    })
    tray.show()
    tray.focus()
  }

  minimize(sender: unknown): void {
    this.windowOf(sender)?.minimize()
  }

  close(sender: unknown): void {
    const window = this.windowOf(sender)
    if (window === undefined) return
    if (window !== this.tray) return window.close()
    // A bandeja só some da tela. Sem ícone confiável (Linux) e com o painel também escondido, não
    // sobra como reabrir: nesse caso encerra o aplicativo.
    window.hide()
    if (this.hideOnClose) return
    if (this.panel === undefined || this.panel.isDestroyed() || !this.panel.isVisible()) {
      if (this.panel !== undefined && !this.panel.isDestroyed()) this.panel.close()
      else this.onPanelClosed()
    }
  }

  // No painel, "Recolher" esconde o painel e mostra a bandeja; na bandeja, "Expandir" volta ao painel.
  toggleTray(sender: unknown): void {
    if (this.windowOf(sender) === this.tray) {
      this.openPanel()
      this.tray?.hide()
      return
    }
    this.showTrayWindow()
    this.panel?.hide()
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
