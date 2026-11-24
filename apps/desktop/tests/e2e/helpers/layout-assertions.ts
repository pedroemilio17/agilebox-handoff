import { expect } from '@playwright/test'
import type { ElectronApplication, Locator, Page } from '@playwright/test'

export interface ElementRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export async function setPanelViewport(
  electronApp: ElectronApplication,
  panelPage: Page,
  width: number,
  height: number,
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows().find(
        (candidate) =>
          !candidate.isDestroyed() && candidate.webContents.getURL().includes('/panel/index.html'),
      )
      if (!win) {
        throw new Error('Panel BrowserWindow not found during setPanelViewport.')
      }
      if (win.isMaximized()) {
        win.unmaximize()
      }
      win.setContentSize(size.width, size.height)
    },
    { width, height },
  )

  await panelPage.setViewportSize({ width, height })
  await panelPage.waitForFunction(
    ([expectedWidth, expectedHeight]) =>
      window.innerWidth === expectedWidth && window.innerHeight === expectedHeight,
    [width, height] as const,
  )
}

export async function setTraySize(
  electronApp: ElectronApplication,
  trayPage: Page,
  width: number,
  height: number,
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows().find(
        (candidate) =>
          !candidate.isDestroyed() && candidate.webContents.getURL().includes('/tray/index.html'),
      )
      if (!win) {
        throw new Error('Tray BrowserWindow not found during setTraySize.')
      }
      const bounds = win.getBounds()
      win.setBounds({
        x: bounds.x + bounds.width - size.width,
        y: bounds.y + bounds.height - size.height,
        width: size.width,
        height: size.height,
      })
    },
    { width, height },
  )

  await trayPage.setViewportSize({ width, height })
  await trayPage.waitForFunction(
    ([expectedWidth, expectedHeight]) =>
      window.innerWidth === expectedWidth && window.innerHeight === expectedHeight,
    [width, height] as const,
  )
}

export interface ExpectTrayDimensionsOptions {
  readonly timeoutMs?: number | undefined
  readonly tolerancePx?: number | undefined
}

export async function expectTrayDimensions(
  electronApp: ElectronApplication,
  trayPage: Page,
  expected: { readonly width: number; readonly height: number },
  optionsOrTimeout?: number | ExpectTrayDimensionsOptions,
): Promise<void> {
  const timeoutMs =
    typeof optionsOrTimeout === 'number' ? optionsOrTimeout : (optionsOrTimeout?.timeoutMs ?? 3_000)
  const tolerancePx =
    typeof optionsOrTimeout === 'number' ? 4 : (optionsOrTimeout?.tolerancePx ?? 4)

  await expect
    .poll(
      async () => {
        const winBounds = await electronApp.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find(
            (candidate) =>
              !candidate.isDestroyed() &&
              candidate.webContents.getURL().includes('/tray/index.html'),
          )
          if (!win) {
            return null
          }
          const bounds = win.getBounds()
          return { width: bounds.width, height: bounds.height }
        })

        const viewport = await trayPage.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        }))

        if (!winBounds) {
          return { matched: false, winBounds: null, viewport }
        }

        const matched =
          Math.abs(winBounds.width - expected.width) <= tolerancePx &&
          Math.abs(winBounds.height - expected.height) <= tolerancePx &&
          Math.abs(viewport.width - expected.width) <= tolerancePx &&
          Math.abs(viewport.height - expected.height) <= tolerancePx

        return { matched, winBounds, viewport }
      },
      { timeout: timeoutMs },
    )
    .toMatchObject({ matched: true })
}

export async function expectNoHorizontalOverflow(page: Page, selector?: string): Promise<void> {
  const rootMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

  expect(
    rootMetrics.scrollWidth,
    `Document horizontal overflow: scrollWidth (${rootMetrics.scrollWidth}) > clientWidth (${rootMetrics.clientWidth})`,
  ).toBeLessThanOrEqual(rootMetrics.clientWidth)

  if (selector) {
    const targetMetrics = await page.evaluate((targetSelector) => {
      const elements = Array.from(document.querySelectorAll(targetSelector))
      return elements.map((el, index) => ({
        index,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }))
    }, selector)

    expect(
      targetMetrics.length,
      `Selector "${selector}" matched 0 elements during overflow check`,
    ).toBeGreaterThan(0)

    for (const metric of targetMetrics) {
      expect(
        metric.scrollWidth,
        `Element "${selector}"[${metric.index}] horizontal overflow: scrollWidth (${metric.scrollWidth}) > clientWidth (${metric.clientWidth})`,
      ).toBeLessThanOrEqual(metric.clientWidth)
    }
  }
}

export async function getRect(locator: Locator): Promise<ElementRect> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(`Could not measure boundingBox for locator: ${locator.toString()}`)
  }
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  }
}

export async function getComputedStyleProp(locator: Locator, prop: string): Promise<string> {
  return locator.evaluate(
    (element, propertyName) =>
      window.getComputedStyle(element).getPropertyValue(propertyName).trim(),
    prop,
  )
}

export async function expectNotClipped(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await getRect(locator)
  expect(box.width).toBeGreaterThan(0)
  expect(box.height).toBeGreaterThan(0)

  const metrics = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowX: style.overflowX,
      textOverflow: style.textOverflow,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })

  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(metrics.viewportHeight + 1)
  expect(
    metrics.scrollWidth,
    `Element horizontally clipped: scrollWidth (${metrics.scrollWidth}) > clientWidth (${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(metrics.clientWidth)
  expect(
    metrics.scrollHeight,
    `Element vertically clipped: scrollHeight (${metrics.scrollHeight}) > clientHeight (${metrics.clientHeight})`,
  ).toBeLessThanOrEqual(metrics.clientHeight)
}

export async function expectNoOverlap(locatorA: Locator, locatorB: Locator): Promise<void> {
  const boxA = await getRect(locatorA)
  const boxB = await getRect(locatorB)

  const separated =
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y

  expect(
    separated,
    `Expected no overlap between ${JSON.stringify(boxA)} and ${JSON.stringify(boxB)}`,
  ).toBe(true)
}
