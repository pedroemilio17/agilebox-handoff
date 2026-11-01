/** Atualização pelo código-fonte (git pull + pnpm install + reconstruir). Só existe no app de desktop. */
export const UPDATE_CHANNELS = {
  check: 'update.check',
  apply: 'update.apply',
  restart: 'update.restart',
  lastRun: 'update.lastRun',
  info: 'update.info',
  progress: 'update.progress',
} as const

export type UpdateStep = 'pull' | 'install' | 'build' | 'package' | 'download'

/**
 * `source`: o app roda de dentro do repositório e se atualiza pelo código (git pull + reconstruir).
 * `release`: app instalado; baixa a versão nova dos Releases do GitHub.
 */
export type UpdateMode = 'source' | 'release'

export interface UpdateInfo {
  readonly version: string
  readonly mode: UpdateMode
}

export type UpdateStatus =
  /** O app não roda de dentro de um repositório com git e pnpm (ex.: instalado pelo setup). */
  | { readonly state: 'unsupported'; readonly reason: string }
  /** Há alterações locais não commitadas; o pull poderia conflitar. */
  | { readonly state: 'dirty'; readonly files: number }
  | { readonly state: 'up-to-date'; readonly commit: string }
  | { readonly state: 'available'; readonly behind: number; readonly commits: readonly string[] }
  /** Código novo baixado e app novo construído ao lado do atual: falta só reiniciar. */
  | { readonly state: 'ready' }
  /** Reiniciando: o app fecha, a pasta nova substitui a antiga e o app reabre. */
  | { readonly state: 'started' }
  /** Em `pnpm dev`: pull e install feitos; falta reiniciar o `pnpm dev`. */
  | { readonly state: 'done-dev' }
  | { readonly state: 'error'; readonly message: string }

export interface UpdateRun {
  readonly ok: boolean
  readonly at: string
  readonly logPath: string
  readonly message: string
}

export interface DesktopUpdatesApi {
  check(): Promise<UpdateStatus>
  /** Baixa, instala e reconstrói com o app aberto. */
  apply(): Promise<UpdateStatus>
  /** Troca pela versão já construída e reabre. */
  restart(): Promise<UpdateStatus>
  lastRun(): Promise<UpdateRun | null>
  info(): Promise<UpdateInfo>
  onProgress(callback: (step: UpdateStep) => void): () => void
}
