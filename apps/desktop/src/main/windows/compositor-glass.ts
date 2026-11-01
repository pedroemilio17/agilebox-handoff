import { execFileSync } from 'node:child_process'

export const LIQUID_GLASS_UUID = 'liquid-glass@thinkingcoding1231.gmail.com'

export function hasLiquidGlass(enabledExtensions: string): boolean {
  return enabledExtensions.includes(LIQUID_GLASS_UUID)
}

/** Lê as extensões ativas do GNOME Shell; qualquer falha (sem GNOME, sem gsettings) vale como "não". */
export function detectCompositorGlass(platform: string): boolean {
  if (platform !== 'linux') return false
  try {
    const output = execFileSync('gsettings', ['get', 'org.gnome.shell', 'enabled-extensions'], {
      encoding: 'utf8',
      timeout: 1500,
    })
    return hasLiquidGlass(output)
  } catch {
    return false
  }
}
