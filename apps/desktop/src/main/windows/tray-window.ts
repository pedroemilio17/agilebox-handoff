import { BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import type { GlassMode } from './glass'
import type { WindowPosition } from './tray-position'

export const TRAY_WINDOW_SIZE = { width: 360, height: 640 } as const

export function createTrayWindow(glassMode: GlassMode, position: WindowPosition): BrowserWindow {
  const window = new BrowserWindow({
    ...TRAY_WINDOW_SIZE,
    ...position,
    frame: false,
    transparent: glassMode === 'css',
    backgroundMaterial: glassMode === 'native' ? 'acrylic' : 'none',
    backgroundColor: glassMode === 'opaque' ? '#1e212a' : '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
    },
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) void window.loadURL(`${rendererUrl}/tray/index.html?glass=${glassMode}`)
  else
    void window.loadFile(fileURLToPath(new URL('../renderer/tray/index.html', import.meta.url)), {
      query: { glass: glassMode },
    })
  return window
}
