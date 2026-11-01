import { Menu, Tray, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import { buildTrayMenu } from './tray-menu'
import type { TrayMenuHandlers } from './tray-menu'

export interface TrayIconHandlers extends TrayMenuHandlers {
  readonly toggleTrayWindow: (iconBounds: Electron.Rectangle) => void
}

/** Ícone na área de notificação: clique abre ou fecha a bandeja; o menu abre o painel ou sai. */
export function createTrayIcon(handlers: TrayIconHandlers): Tray {
  const image = nativeImage.createFromPath(
    fileURLToPath(new URL('../../resources/tray.png', import.meta.url)),
  )
  const tray = new Tray(image)
  tray.setToolTip('AgileBox')
  tray.setContextMenu(Menu.buildFromTemplate([...buildTrayMenu(handlers)]))
  tray.on('click', (_event, bounds) => handlers.toggleTrayWindow(bounds))
  return tray
}
