export interface GlassEnvironment {
  readonly AGILEBOX_GLASS?: string
  readonly systemVersion?: string
}

export type GlassMode = 'css' | 'native'

export function resolveGlassMode(platform: string, env: GlassEnvironment): GlassMode {
  const version = env.systemVersion?.match(/^\d+\.\d+\.(\d+)/)?.[1]
  const isWindows11 = version !== undefined && Number(version) >= 22000
  return platform === 'win32' && isWindows11 && env.AGILEBOX_GLASS === 'native' ? 'native' : 'css'
}
