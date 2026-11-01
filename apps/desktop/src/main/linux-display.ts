export interface DisplayEnvironment {
  readonly platform: string
  readonly env: Readonly<Record<string, string | undefined>>
  /** Valor atual de `--ozone-platform` (vazio se ausente); o Electron pode defini-lo sozinho como `wayland`. */
  readonly ozonePlatform: string
}

/**
 * No Wayland o app não posiciona as próprias janelas (a bandeja não ancora no canto e cresce para
 * baixo). No Linux o AgileBox reinicia uma vez com `--ozone-platform=x11`; AGILEBOX_WAYLAND=1 mantém
 * o Wayland. A escolha de plataforma só vale na linha de comando, por isso a reinicialização.
 */
export function needsX11Relaunch({ platform, env, ozonePlatform }: DisplayEnvironment): boolean {
  return platform === 'linux' && env.AGILEBOX_WAYLAND !== '1' && ozonePlatform !== 'x11'
}
