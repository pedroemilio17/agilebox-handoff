import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_CHANNELS } from '@agilebox/contract'
import type { AgileBoxBridge } from '@agilebox/contract'

const { exposeInMainWorld, invoke, on, removeListener } = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn<(key: string, bridge: AgileBoxBridge) => void>(),
  invoke: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  on: vi.fn(),
  removeListener: vi.fn(),
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener },
}))

describe('ponte preload', () => {
  beforeEach(() => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockClear()
    on.mockClear()
    removeListener.mockClear()
  })

  it('expõe a API de dados, eventos e shell no contexto principal', async () => {
    await import('./index')
    const bridge = getExposedBridge()

    expect(exposeInMainWorld).toHaveBeenCalledWith('agilebox', bridge)
    expect(typeof bridge.invoke).toBe('function')
    expect(typeof bridge.onChanges).toBe('function')
    expect(Object.values(bridge.shell).every((method) => typeof method === 'function')).toBe(true)
  })

  it('remove o listener de mudanças ao cancelar a assinatura', async () => {
    await import('./index')
    const bridge = getExposedBridge()
    const unsubscribe = bridge.onChanges(vi.fn())

    unsubscribe()

    expect(removeListener).toHaveBeenCalledWith('changes', expect.any(Function))
  })

  it('encaminha operações do shell para canais de janela', async () => {
    await import('./index')
    const bridge = getExposedBridge()

    bridge.shell.setTrayHeight({ height: 320 })

    expect(invoke).toHaveBeenCalledWith('window.setTrayHeight', { height: 320 })
  })

  it('encaminha cada canal da API para o IPC com o mesmo nome, inclusive ferramentas do time', async () => {
    await import('./index')
    const bridge = getExposedBridge()

    for (const channel of API_CHANNELS) {
      await bridge.invoke(channel, undefined)
      expect(invoke).toHaveBeenLastCalledWith(channel, undefined)
    }

    expect(API_CHANNELS).toEqual(
      expect.arrayContaining([
        'teamModules.get',
        'teamModules.previewImpact',
        'teamModules.change',
        'teamModules.finishWindingDown',
      ]),
    )
  })
})

function getExposedBridge(): AgileBoxBridge {
  const bridge = exposeInMainWorld.mock.calls[0]?.[1]
  if (!bridge) throw new Error('A ponte preload não foi exposta')
  return bridge
}
