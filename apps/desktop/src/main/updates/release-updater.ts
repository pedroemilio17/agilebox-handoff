import type { UpdateRun, UpdateStatus, UpdateStep } from '@agilebox/contract'

/** O que usamos do `autoUpdater` do electron-updater (injetável nos testes). */
export interface AutoUpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<{
    readonly isUpdateAvailable: boolean
    readonly updateInfo: { readonly version: string }
  } | null>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** App instalado (setup.exe ou AppImage): versões novas vêm dos Releases do GitHub. */
export function createReleaseUpdater(options: {
  readonly updater: AutoUpdaterLike
  readonly notify: (step: UpdateStep) => void
}) {
  const { updater } = options
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  let ready = false
  let busy = false

  async function check(): Promise<UpdateStatus> {
    if (ready) return { state: 'ready' }
    try {
      const result = await updater.checkForUpdates()
      if (!result?.isUpdateAvailable) {
        return { state: 'up-to-date', commit: result?.updateInfo.version ?? 'versão atual' }
      }
      return {
        state: 'available',
        behind: 1,
        commits: [`Versão ${result.updateInfo.version}`],
      }
    } catch (error) {
      return { state: 'error', message: message(error) }
    }
  }

  /** Baixa o instalador novo em segundo plano, com o app aberto. */
  async function apply(): Promise<UpdateStatus> {
    if (busy) return { state: 'error', message: 'Uma atualização já está em andamento.' }
    const status = await check()
    if (status.state !== 'available') return status
    busy = true
    try {
      options.notify('download')
      await updater.downloadUpdate()
      ready = true
      return { state: 'ready' }
    } catch (error) {
      return { state: 'error', message: message(error) }
    } finally {
      busy = false
    }
  }

  /** Instala sem perguntas e reabre o app já atualizado. */
  function restart(): Promise<UpdateStatus> {
    if (!ready) return Promise.resolve({ state: 'error', message: 'Nenhuma versão nova pronta.' })
    setTimeout(() => updater.quitAndInstall(true, true), 300)
    return Promise.resolve({ state: 'started' })
  }

  const lastRun = (): UpdateRun | null => null

  return { check, apply, restart, lastRun }
}
