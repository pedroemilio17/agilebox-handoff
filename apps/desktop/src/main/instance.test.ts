import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  acquireInstanceLock,
  isReplaceRequest,
  readRunningInstance,
  shouldReplace,
  writeRunningInstance,
} from './instance'

const sleep = () => Promise.resolve()

describe('instância única entre builds', () => {
  it('substitui só quando a instância aberta é de outro build', () => {
    expect(shouldReplace({ buildId: 'velho', pid: 1 }, 'novo')).toBe(true)
    expect(shouldReplace({ buildId: 'novo', pid: 1 }, 'novo')).toBe(false)
    expect(shouldReplace(undefined, 'novo')).toBe(false)
  })

  it('a instância aberta só aceita pedido de saída vindo de outro build', () => {
    expect(isReplaceRequest({ buildId: 'novo', replace: true }, 'velho')).toBe(true)
    expect(isReplaceRequest({ buildId: 'velho', replace: true }, 'velho')).toBe(false)
    expect(isReplaceRequest({ buildId: 'novo', replace: false }, 'velho')).toBe(false)
    expect(isReplaceRequest(undefined, 'velho')).toBe(false)
  })

  it('grava e lê a instância aberta na pasta de dados', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agilebox-'))
    expect(readRunningInstance(dir)).toBeUndefined()
    writeRunningInstance(dir, { buildId: 'abc', pid: 42 })
    expect(readRunningInstance(dir)).toEqual({ buildId: 'abc', pid: 42 })
  })

  it('build diferente: pede a saída da antiga e assume quando o lock fica livre', async () => {
    const requestLock = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true)
    const acquired = await acquireInstanceLock({
      buildId: 'novo',
      running: { buildId: 'velho', pid: 1 },
      requestLock,
      sleep,
    })
    expect(acquired).toBe(true)
    expect(requestLock).toHaveBeenCalledWith({ buildId: 'novo', replace: true })
    expect(requestLock).toHaveBeenCalledTimes(3)
  })

  it('mesmo build: desiste na hora, sem esperar', async () => {
    const requestLock = vi.fn().mockReturnValue(false)
    const acquired = await acquireInstanceLock({
      buildId: 'novo',
      running: { buildId: 'novo', pid: 1 },
      requestLock,
      sleep,
    })
    expect(acquired).toBe(false)
    expect(requestLock).toHaveBeenCalledTimes(1)
  })

  it('desiste se a antiga não sair dentro do prazo', async () => {
    const requestLock = vi.fn().mockReturnValue(false)
    const acquired = await acquireInstanceLock({
      buildId: 'novo',
      running: { buildId: 'velho', pid: 1 },
      requestLock,
      sleep,
      timeoutMs: 2000,
    })
    expect(acquired).toBe(false)
    expect(requestLock).toHaveBeenCalledTimes(6)
  })
})
