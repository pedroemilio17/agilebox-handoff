export interface GlassEnvironment {
  readonly AGILEBOX_GLASS?: string
  readonly systemVersion?: string
}

// `opaque`: janela sólida, para sistemas sem desfoque do desktop (Linux).
export type GlassMode = 'css' | 'native' | 'opaque'

export function resolveGlassMode(platform: string, env: GlassEnvironment): GlassMode {
  const version = env.systemVersion?.match(/^\d+\.\d+\.(\d+)/)?.[1]
  const isWindows11 = version !== undefined && Number(version) >= 22000
  if (platform === 'win32' && isWindows11 && env.AGILEBOX_GLASS === 'native') return 'native'
  if (platform === 'linux' && env.AGILEBOX_GLASS !== 'css') return 'opaque'
  return 'css'
}
