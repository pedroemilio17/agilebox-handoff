import { describe, expect, it, vi } from 'vitest'
import { createReleaseUpdater } from './release-updater'
import type { AutoUpdaterLike } from './release-updater'

function fakeUpdater(result: Awaited<ReturnType<AutoUpdaterLike['checkForUpdates']>>) {
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(() => Promise.resolve(result)),
    downloadUpdate: vi.fn(() => Promise.resolve([])),
    quitAndInstall: vi.fn(),
  }
  return updater
}

describe('atualização pelos Releases', () => {
  it('não baixa sozinho; só depois do pedido', () => {
    const updater = fakeUpdater(null)
    createReleaseUpdater({ updater, notify: vi.fn() })
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(true)
  })

  it('informa a versão nova e, sem versão nova, a atual', async () => {
    const available = fakeUpdater({ isUpdateAvailable: true, updateInfo: { version: '0.3.0' } })
    expect(await createReleaseUpdater({ updater: available, notify: vi.fn() }).check()).toEqual({
      state: 'available',
      behind: 1,
      commits: ['Versão 0.3.0'],
    })
    const current = fakeUpdater({ isUpdateAvailable: false, updateInfo: { version: '0.2.0' } })
    expect(await createReleaseUpdater({ updater: current, notify: vi.fn() }).check()).toEqual({
      state: 'up-to-date',
      commit: '0.2.0',
    })
  })

  it('baixa com o app aberto, avisa a etapa e só instala ao reiniciar', async () => {
    vi.useFakeTimers()
    const updater = fakeUpdater({ isUpdateAvailable: true, updateInfo: { version: '0.3.0' } })
    const notify = vi.fn()
    const release = createReleaseUpdater({ updater, notify })
    expect(await release.apply()).toEqual({ state: 'ready' })
    expect(notify).toHaveBeenCalledWith('download')
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(await release.restart()).toEqual({ state: 'started' })
    vi.runAllTimers()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
    vi.useRealTimers()
  })

  it('erro de rede ou Release inexistente vira mensagem', async () => {
    const updater = fakeUpdater(null)
    updater.checkForUpdates.mockRejectedValue(new Error('HttpError: 404'))
    expect(await createReleaseUpdater({ updater, notify: vi.fn() }).check()).toEqual({
      state: 'error',
      message: 'HttpError: 404',
    })
  })

  it('reiniciar sem versão baixada é recusado', async () => {
    const release = createReleaseUpdater({ updater: fakeUpdater(null), notify: vi.fn() })
    expect(await release.restart()).toEqual({
      state: 'error',
      message: 'Nenhuma versão nova pronta.',
    })
  })
})
