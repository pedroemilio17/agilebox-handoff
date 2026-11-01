import console from 'node:console'
import { app, ipcMain } from 'electron'
import { createCompositionRoot } from './composition-root'
import { registerHandlers } from './ipc/register-handlers'
import { registerShellHandlers } from './ipc/register-shell-handlers'
import { getDatabasePath } from './paths'
import { resolveGlassMode } from './windows/glass'
import { createTrayIcon } from './tray/tray-icon'
import { shouldHideOnClose } from './tray/tray-menu'
import { WindowManager } from './windows/window-manager'

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  const glassMode = resolveGlassMode(process.platform, {
    ...(process.env.AGILEBOX_GLASS === undefined
      ? {}
      : { AGILEBOX_GLASS: process.env.AGILEBOX_GLASS }),
    systemVersion: process.getSystemVersion(),
  })
  const windows = new WindowManager(
    glassMode,
    () => {
      if (process.platform !== 'darwin' && !isQuitting) app.quit()
    },
    shouldHideOnClose(process.platform),
  )
  let trayIcon: Electron.Tray | undefined // guardado para o coletor de lixo não remover o ícone
  let closeCompositionRoot: (() => void) | undefined
  let isQuitting = false

  app.on('second-instance', () => {
    const panel = windows.createPanel()
    if (panel.isMinimized()) panel.restore()
    panel.show()
    panel.focus()
  })

  app.on('before-quit', () => {
    isQuitting = true
    windows.markQuitting()
    trayIcon?.destroy()
    trayIcon = undefined
    closeCompositionRoot?.()
    closeCompositionRoot = undefined
    windows.destroyAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (!isQuitting) windows.createPanel().show()
  })

  registerShellHandlers(ipcMain, windows)

  void app
    .whenReady()
    .then(async () => {
      const compositionRoot = await createCompositionRoot({
        databasePath: getDatabasePath(app.getPath('userData')),
        isProduction: app.isPackaged,
        windows,
      })
      closeCompositionRoot = compositionRoot.close
      registerHandlers(ipcMain, compositionRoot.useCases, compositionRoot.actorSession)
      windows.createPanel()
      windows.createTray()
      trayIcon = createTrayIcon({
        openPanel: () => windows.openPanel(),
        quit: () => app.quit(),
        toggleTrayWindow: (bounds) => windows.toggleTrayWindow(bounds),
      })
    })
    .catch((error: unknown) => {
      console.error('Falha ao iniciar o AgileBox:', error)
      app.quit()
    })
}
