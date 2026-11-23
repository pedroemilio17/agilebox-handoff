import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    expect(bridge.ai).toBeDefined()
    expect(Object.values(bridge.ai!).every((method) => typeof method === 'function')).toBe(true)
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

  it('encaminha chamadas de IA para os canais ai.*', async () => {
    await import('./index')
    const bridge = getExposedBridge()

    await bridge.ai?.getConfig()
    await bridge.ai?.saveConfig({ apiKey: 'AIza1', model: 'gemini-2.5-flash' })

    expect(invoke).toHaveBeenCalledWith('ai.getConfig')
    expect(invoke).toHaveBeenCalledWith('ai.saveConfig', {
      apiKey: 'AIza1',
      model: 'gemini-2.5-flash',
    })
  })
})

function getExposedBridge(): AgileBoxBridge {
  const bridge = exposeInMainWorld.mock.calls[0]?.[1]
  if (!bridge) throw new Error('A ponte preload não foi exposta')
  return bridge
}
