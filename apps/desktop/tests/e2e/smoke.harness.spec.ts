import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  captureE2EScreenshot,
  expectNoHorizontalOverflow,
  expectTrayDimensions,
  launchAgileBoxSession,
  NAV_LABELS,
  SEED_DATA,
  setPanelViewport,
  TRAY_LABELS,
  TRAY_ROTATING_PHRASES,
  VIEWPORTS,
} from './helpers'

test('harness launches isolated Electron session with seed data and Tray window', async () => {
  const session = await launchAgileBoxSession()
  const { userDataDir } = session

  try {
    const panelPage = await session.getPanelPage()
    const nav = panelPage.locator(`[aria-label="${NAV_LABELS.navigation}"]`)
    await expect(nav).toBeVisible()

    // Confirma dados iniciais do seed isolado (SQLite criado sob userDataDir temporário)
    await expect(nav.getByText(SEED_DATA.projects[0])).toBeVisible()
    await expect(nav.getByText(SEED_DATA.collaborator)).toBeVisible()

    await setPanelViewport(
      session.electronApp,
      panelPage,
      VIEWPORTS.PANEL_DEFAULT.width,
      VIEWPORTS.PANEL_DEFAULT.height,
    )
    await expectNoHorizontalOverflow(panelPage)
    const defaultShot = await captureE2EScreenshot(panelPage, 'panel-1280x780', 'smoke')
    expect(existsSync(defaultShot)).toBe(true)

    await setPanelViewport(
      session.electronApp,
      panelPage,
      VIEWPORTS.PANEL_COMPACT.width,
      VIEWPORTS.PANEL_COMPACT.height,
    )
    await expectNoHorizontalOverflow(panelPage)
    const compactShot = await captureE2EScreenshot(panelPage, 'panel-960x720', 'smoke')
    expect(existsSync(compactShot)).toBe(true)

    const trayPage = await session.openTrayPage()
    await expectTrayDimensions(session.electronApp, trayPage, VIEWPORTS.TRAY_COMPACT)
    await expect(trayPage.locator(`[aria-label="${TRAY_LABELS.trayAria}"]`)).toBeVisible()
    await expect(trayPage.getByText(TRAY_ROTATING_PHRASES[0])).toBeVisible()

    const trayShot = await captureE2EScreenshot(trayPage, 'tray-340x88', 'smoke')
    expect(existsSync(trayShot)).toBe(true)
  } finally {
    await session.close()
  }

  expect(existsSync(userDataDir)).toBe(false)
})
