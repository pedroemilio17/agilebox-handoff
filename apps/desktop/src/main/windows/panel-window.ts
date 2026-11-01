import { BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import type { GlassMode } from './glass'

export function createPanelWindow(glassMode: GlassMode): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 900,
    frame: false,
    transparent: glassMode === 'css',
    backgroundMaterial: glassMode === 'native' ? 'acrylic' : 'none',
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
    },
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) void window.loadURL(`${rendererUrl}/panel/index.html`)
  else void window.loadFile(fileURLToPath(new URL('../renderer/panel/index.html', import.meta.url)))
  return window
}
