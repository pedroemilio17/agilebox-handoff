import console from 'node:console'
import { app, ipcMain } from 'electron'
import { createCompositionRoot } from './composition-root'
import { registerHandlers } from './ipc/register-handlers'
import { registerShellHandlers } from './ipc/register-shell-handlers'
import { registerUpdateHandlers } from './updates/register-update-handlers'
import { createSourceUpdater } from './updates/source-updater'
import { needsX11Relaunch } from './linux-display'
import { readAppearance, writeAppearance } from './appearance'
import { getDatabasePath, getMigrationsFolder } from './paths'
import { detectCompositorGlass } from './windows/compositor-glass'
import { resolveGlassMode } from './windows/glass'
import { createTrayIcon } from './tray/tray-icon'
import { shouldHideOnClose } from './tray/tray-menu'
import { WindowManager } from './windows/window-manager'

const relaunchInX11 = needsX11Relaunch({
  platform: process.platform,
  env: process.env,
  ozonePlatform: app.commandLine.getSwitchValue('ozone-platform'),
})
if (relaunchInX11) {
  app.relaunch({ args: [...process.argv.slice(1), '--ozone-platform=x11'] })
  app.exit(0)
}

const gotSingleInstanceLock = relaunchInX11 || app.requestSingleInstanceLock()

if (relaunchInX11) {
  // O processo novo assume; este só encerra.
} else if (!gotSingleInstanceLock) {
  app.quit()
} else {
  const userDataPath = app.getPath('userData')
  const glassEnvironment = {
    ...(process.env.AGILEBOX_GLASS === undefined
      ? {}
      : { AGILEBOX_GLASS: process.env.AGILEBOX_GLASS }),
    systemVersion: process.getSystemVersion(),
    compositorGlass: detectCompositorGlass(process.platform),
  }
  const savedAppearance = readAppearance(userDataPath)
  const glassMode = resolveGlassMode(process.platform, {
    ...glassEnvironment,
    ...(savedAppearance === undefined ? {} : { preference: savedAppearance }),
  })
  const windows = new WindowManager(
    glassMode,
    () => {
      if (process.platform !== 'darwin' && !isQuitting) app.quit()
    },
    shouldHideOnClose(process.platform),
  )
  windows.onAppearanceChange = (preference) => {
    writeAppearance(userDataPath, preference)
    windows.applyGlassMode(resolveGlassMode(process.platform, { ...glassEnvironment, preference }))
  }
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
  registerUpdateHandlers(
    ipcMain,
    createSourceUpdater({
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      userDataPath,
      isPackaged: app.isPackaged,
      platform: process.platform,
      appImage: process.env.APPIMAGE,
      quit: () => app.quit(),
    }),
  )

  void app
    .whenReady()
    .then(async () => {
      const compositionRoot = await createCompositionRoot({
        databasePath: getDatabasePath(app.getPath('userData')),
        // O app ainda não tem cadastro nem login (PLANO 12): a primeira execução, inclusive a do
        // instalador, cria os dados de demonstração.
        isProduction: false,
        ...(getMigrationsFolder(app.isPackaged, process.resourcesPath) === undefined
          ? {}
          : { migrationsFolder: getMigrationsFolder(app.isPackaged, process.resourcesPath)! }),
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
