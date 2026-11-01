export interface GlassEnvironment {
  readonly AGILEBOX_GLASS?: string
  readonly systemVersion?: string
  /** Linux: a extensão Liquid Glass do GNOME Shell está ativa e desenha o vidro atrás da janela. */
  readonly compositorGlass?: boolean
}

// `opaque`: janela sólida, para sistemas sem desfoque do desktop (Linux).
// `compositor`: janela translúcida; o vidro (desfoque e refração) é desenhado pelo GNOME Shell.
export type GlassMode = 'css' | 'native' | 'opaque' | 'compositor'

const LINUX_MODES: readonly string[] = ['css', 'opaque', 'compositor']

export function resolveGlassMode(platform: string, env: GlassEnvironment): GlassMode {
  const version = env.systemVersion?.match(/^\d+\.\d+\.(\d+)/)?.[1]
  const isWindows11 = version !== undefined && Number(version) >= 22000
  if (platform === 'win32' && isWindows11 && env.AGILEBOX_GLASS === 'native') return 'native'
  if (platform === 'linux') {
    if (env.AGILEBOX_GLASS && LINUX_MODES.includes(env.AGILEBOX_GLASS))
      return env.AGILEBOX_GLASS as GlassMode
    return env.compositorGlass ? 'compositor' : 'opaque'
  }
  return 'css'
}
