import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

export interface CaptureScreenshotOptions {
  readonly animations?: 'disabled' | 'allow' | undefined
  readonly fullPage?: boolean | undefined
}

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SCREENSHOT_ROOT = resolve(HELPERS_DIR, '../../../test-results/screenshots')

export async function captureE2EScreenshot(
  page: Page,
  name: string,
  subdir?: string,
  options?: CaptureScreenshotOptions,
): Promise<string> {
  const baseDir = process.env.AGILEBOX_E2E_SCREENSHOT_DIR?.trim() || DEFAULT_SCREENSHOT_ROOT
  const targetDir = subdir ? join(baseDir, subdir) : baseDir
  mkdirSync(targetDir, { recursive: true })

  const fileName = name.endsWith('.png') ? name : `${name}.png`
  const targetPath = join(targetDir, fileName)

  await page.screenshot({
    path: targetPath,
    animations: options?.animations ?? 'disabled',
    ...(options?.fullPage !== undefined ? { fullPage: options.fullPage } : {}),
  })

  return targetPath
}
