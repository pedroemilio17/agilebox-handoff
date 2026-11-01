/** Atualização pelo código-fonte (git pull + pnpm install + reempacotar). Só existe no app de desktop. */
export const UPDATE_CHANNELS = {
  check: 'update.check',
  apply: 'update.apply',
  lastRun: 'update.lastRun',
} as const

export type UpdateStatus =
  /** O app não roda de dentro de um repositório com git e pnpm (ex.: instalado pelo setup). */
  | { readonly state: 'unsupported'; readonly reason: string }
  /** Há alterações locais não commitadas; o pull poderia conflitar. */
  | { readonly state: 'dirty'; readonly files: number }
  | { readonly state: 'up-to-date'; readonly commit: string }
  | { readonly state: 'available'; readonly behind: number; readonly commits: readonly string[] }
  /** O auxiliar começou: o app vai fechar e reabrir atualizado. */
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
  apply(): Promise<UpdateStatus>
  lastRun(): Promise<UpdateRun | null>
}
