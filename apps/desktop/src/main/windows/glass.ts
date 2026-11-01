export type AppearancePreference = 'translucent' | 'opaque'

export interface GlassEnvironment {
  readonly AGILEBOX_GLASS?: string
  readonly systemVersion?: string
  /** Escolha da pessoa em Ajustes; `opaque` vence a detecção automática. */
  readonly preference?: AppearancePreference
  /** Linux: a extensão Liquid Glass do GNOME Shell está ativa e desenha o vidro atrás da janela. */
  readonly compositorGlass?: boolean
}

// `opaque`: janela sólida, para sistemas sem desfoque do desktop (Linux).
// `compositor`: janela translúcida; o vidro (desfoque e refração) é desenhado pelo GNOME Shell.
export type GlassMode = 'css' | 'native' | 'opaque' | 'compositor'

const LINUX_MODES: readonly string[] = ['css', 'opaque', 'compositor']

export function resolveGlassMode(platform: string, env: GlassEnvironment): GlassMode {
  const forced = ['css', 'native', 'opaque', 'compositor'].includes(env.AGILEBOX_GLASS ?? '')
  if (!forced && env.preference === 'opaque') return 'opaque'
  const version = env.systemVersion?.match(/^\d+\.\d+\.(\d+)/)?.[1]
  const isWindows11 = version !== undefined && Number(version) >= 22000
  // Windows 11: o vidro real é o Acrylic do sistema (desfoca o desktop); AGILEBOX_GLASS=css volta ao CSS.
  if (platform === 'win32' && isWindows11 && env.AGILEBOX_GLASS !== 'css') return 'native'
  if (platform === 'linux') {
    if (env.AGILEBOX_GLASS && LINUX_MODES.includes(env.AGILEBOX_GLASS))
      return env.AGILEBOX_GLASS as GlassMode
    if (env.compositorGlass) return 'compositor'
    return env.preference === 'translucent' ? 'css' : 'opaque'
  }
  return 'css'
}

export interface WindowChrome {
  readonly frame: false
  readonly transparent: boolean
  readonly roundedCorners?: boolean
  readonly backgroundMaterial: 'acrylic' | 'none'
  readonly backgroundColor: string
}

/**
 * Opções de moldura de cada modo. No Windows 11 (`native`) vale a configuração da versão 7f00386,
 * confirmada pelo Pedro: janela sem moldura com Acrylic e fundo transparente. (Manter a moldura do
 * sistema com `titleBarStyle: 'hidden'` deixou o fundo cinza, sem desfoque.)
 */
export function windowChrome(mode: GlassMode): WindowChrome {
  if (mode === 'native') {
    return {
      frame: false,
      transparent: false,
      roundedCorners: true,
      backgroundMaterial: 'acrylic',
      backgroundColor: '#00000000',
    }
  }
  return {
    frame: false,
    transparent: mode === 'css' || mode === 'compositor',
    backgroundMaterial: 'none',
    backgroundColor: mode === 'opaque' ? '#1e212a' : '#00000000',
  }
}
