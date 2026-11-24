import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { _electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { NAV_LABELS } from './opaque-contracts'

export type GlassMode = 'native' | 'css' | 'opaque'

export interface WindowBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface LaunchAgileBoxOptions {
  readonly glassMode?: GlassMode | undefined
  readonly screenshotSubdir?: string | undefined
  readonly timeoutMs?: number | undefined
}

export interface OpenTrayOptions {
  readonly show?: boolean | undefined
  readonly focus?: boolean | undefined
  readonly viaUi?: boolean | undefined
}

export interface AgileBoxSession {
  readonly electronApp: ElectronApplication
  readonly panelPage: Page
  readonly userDataDir: string
  readonly screenshotSubdir?: string | undefined
  readonly getPanelPage: () => Promise<Page>
  readonly openTrayPage: (opts?: OpenTrayOptions) => Promise<Page>
  readonly getTrayBounds: () => Promise<WindowBounds>
  readonly getPanelBounds: () => Promise<WindowBounds>
  readonly setReducedMotion: (page: Page, enabled: boolean) => Promise<void>
  readonly close: () => Promise<void>
}

const DEFAULT_TIMEOUT_MS = 30_000
const HELPERS_DIR = dirname(fileURLToPath(import.meta.url))
const MAIN_ENTRY_PATH = resolve(HELPERS_DIR, '../../../out/main/index.js')
const requireFromHelpers = createRequire(import.meta.url)

function resolveElectronExecutable(): string {
  const resolved: unknown = requireFromHelpers('electron')
  if (typeof resolved !== 'string' || resolved.length === 0) {
    throw new Error('Could not resolve local Electron executable path from workspace.')
  }
  return resolved
}

function buildCleanElectronEnv(glassMode?: GlassMode): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value
    }
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  if (glassMode !== undefined) {
    env.AGILEBOX_GLASS = glassMode
  } else {
    delete env.AGILEBOX_GLASS
  }
  return env
}

async function removeUserDataDirWithRetries(userDataDir: string): Promise<void> {
  const maxAttempts = 10
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      rmSync(userDataDir, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
      await delay(100)
    }
  }
}

async function getWindowBoundsByPath(
  electronApp: ElectronApplication,
  urlSuffix: '/panel/index.html' | '/tray/index.html',
): Promise<WindowBounds> {
  return electronApp.evaluate(({ BrowserWindow }, targetSuffix) => {
    const win = BrowserWindow.getAllWindows().find(
      (candidate) =>
        !candidate.isDestroyed() && candidate.webContents.getURL().includes(targetSuffix),
    )
    if (!win) {
      throw new Error(`BrowserWindow not found for URL suffix "${targetSuffix}".`)
    }
    const bounds = win.getBounds()
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }
  }, urlSuffix)
}

export async function launchAgileBoxSession(
  options?: LaunchAgileBoxOptions,
): Promise<AgileBoxSession> {
  if (!existsSync(MAIN_ENTRY_PATH)) {
    throw new Error(
      `Compiled Electron main entry not found at "${MAIN_ENTRY_PATH}". Run "pnpm --filter @agilebox/desktop build" first.`,
    )
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const userDataDir = mkdtempSync(join(tmpdir(), 'agilebox-e2e-'))
  const env = buildCleanElectronEnv(options?.glassMode)
  const launchArgs = [
    MAIN_ENTRY_PATH,
    `--user-data-dir=${userDataDir}`,
    ...(process.platform === 'linux' ? ['--ozone-platform=x11'] : []),
  ]

  let electronApp: ElectronApplication | undefined
  try {
    electronApp = await _electron.launch({
      executablePath: resolveElectronExecutable(),
      args: launchArgs,
      env,
      timeout: timeoutMs,
    })

    const app = electronApp

    const findWindowByPath = async (
      suffix: '/panel/index.html' | '/tray/index.html',
    ): Promise<Page> => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const existing = app
          .windows()
          .find((candidate) => !candidate.isClosed() && candidate.url().includes(suffix))
        if (existing) {
          return existing
        }

        const remaining = Math.max(50, deadline - Date.now())
        try {
          const nextWindow = await app.waitForEvent('window', {
            timeout: Math.min(remaining, 1_000),
          })
          if (!nextWindow.isClosed()) {
            if (nextWindow.url().includes(suffix)) {
              return nextWindow
            }
            await nextWindow
              .waitForLoadState('domcontentloaded', {
                timeout: Math.min(remaining, 2_000),
              })
              .catch(() => undefined)
            if (!nextWindow.isClosed() && nextWindow.url().includes(suffix)) {
              return nextWindow
            }
          }
        } catch {
          // Segue verificando janelas já abertas até o deadline.
        }
      }
      const urls = app.windows().map((win) => win.url())
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for window "${suffix}". Open windows: [${urls.join(', ')}]`,
      )
    }

    const getPanelPage = async (): Promise<Page> => {
      const page = await findWindowByPath('/panel/index.html')
      await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs })
      await page
        .locator(`[aria-label="${NAV_LABELS.navigation}"]`)
        .waitFor({ state: 'visible', timeout: timeoutMs })
      return page
    }

    const openTrayPage = async (opts?: OpenTrayOptions): Promise<Page> => {
      if (opts?.viaUi) {
        const currentPanel = await getPanelPage()
        await currentPanel.getByRole('button', { name: NAV_LABELS.openTray }).click()
      }

      const trayPage = await findWindowByPath('/tray/index.html')

      if (opts?.show !== false && !opts?.viaUi) {
        await app.evaluate(({ BrowserWindow, screen }, focusWindow) => {
          const win = BrowserWindow.getAllWindows().find(
            (candidate) =>
              !candidate.isDestroyed() &&
              candidate.webContents.getURL().includes('/tray/index.html'),
          )
          if (!win) {
            throw new Error('Tray BrowserWindow not found while trying to open programmatically.')
          }
          const bounds = win.getBounds()
          const workArea = screen.getDisplayMatching(bounds).workArea
          const isOutsideWorkArea =
            bounds.x < workArea.x ||
            bounds.y < workArea.y ||
            bounds.x + bounds.width > workArea.x + workArea.width ||
            bounds.y + bounds.height > workArea.y + workArea.height

          if (isOutsideWorkArea) {
            win.setBounds({
              x: Math.max(workArea.x, workArea.x + workArea.width - bounds.width - 16),
              y: Math.max(workArea.y, workArea.y + workArea.height - bounds.height - 16),
              width: bounds.width,
              height: bounds.height,
            })
          }

          if (focusWindow) {
            win.show()
            win.focus()
          } else {
            win.showInactive()
          }
        }, Boolean(opts?.focus))
      }

      await trayPage.waitForLoadState('domcontentloaded', { timeout: timeoutMs })
      return trayPage
    }

    const getTrayBounds = async (): Promise<WindowBounds> =>
      getWindowBoundsByPath(app, '/tray/index.html')

    const getPanelBounds = async (): Promise<WindowBounds> =>
      getWindowBoundsByPath(app, '/panel/index.html')

    const setReducedMotion = async (page: Page, enabled: boolean): Promise<void> => {
      await page.emulateMedia({
        reducedMotion: enabled ? 'reduce' : 'no-preference',
      })
    }

    const close = async (): Promise<void> => {
      try {
        await Promise.race([
          app.close(),
          delay(8_000).then(() => {
            throw new Error('Timed out closing ElectronApplication')
          }),
        ])
      } catch {
        const proc = app.process()
        if (!proc.killed) {
          proc.kill('SIGKILL')
        }
      } finally {
        await removeUserDataDirWithRetries(userDataDir)
      }
    }

    const initialPanelPage = await getPanelPage()

    return {
      electronApp: app,
      panelPage: initialPanelPage,
      userDataDir,
      ...(options?.screenshotSubdir !== undefined
        ? { screenshotSubdir: options.screenshotSubdir }
        : {}),
      getPanelPage,
      openTrayPage,
      getTrayBounds,
      getPanelBounds,
      setReducedMotion,
      close,
    }
  } catch (error) {
    if (electronApp) {
      await electronApp.close().catch(() => {
        const proc = electronApp?.process()
        if (proc && !proc.killed) {
          proc.kill('SIGKILL')
        }
      })
    }
    await removeUserDataDirWithRetries(userDataDir).catch(() => undefined)
    throw error
  }
}
