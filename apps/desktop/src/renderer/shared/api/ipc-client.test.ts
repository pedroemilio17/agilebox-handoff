import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import { createIpcClient } from './ipc-client'

describe('cliente IPC', () => {
  it('devolve o valor de uma chamada bem-sucedida', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true, value: [{ id: 'projeto' }] })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })

    await expect(client.projects.list()).resolves.toEqual([{ id: 'projeto' }])
    expect(invoke).toHaveBeenCalledWith('projects.list', undefined)
  })

  it('envia arquivar, desarquivar, renomear e a flag de arquivados pelos canais certos', async () => {
    const channels: string[] = []
    const invoke = vi.fn().mockImplementation((channel: string) => {
      channels.push(channel)
      return Promise.resolve({ ok: true, value: undefined })
    })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })
    const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
    const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

    await client.projects.list({ includeArchived: true })
    await client.projects.archiveProject({ projectId })
    await client.projects.unarchiveProject({ projectId })
    await client.projects.renameProject({ projectId, name: 'Novo' })
    await client.tasks.archive({ taskId })
    await client.tasks.unarchive({ taskId })

    expect(channels).toEqual([
      'projects.list',
      'projects.archiveProject',
      'projects.unarchiveProject',
      'projects.renameProject',
      'tasks.archive',
      'tasks.unarchive',
    ])
    expect(invoke).toHaveBeenCalledWith('projects.list', { includeArchived: true })
  })

  it('converte falhas do contrato em ApiError', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Sem permissão' },
    })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })

    await expect(client.tasks.listBoard({})).rejects.toMatchObject({
      name: 'ApiError',
      code: 'FORBIDDEN',
      message: 'Sem permissão',
    } satisfies Partial<ApiError>)
  })

  it('registra e cancela a assinatura de mudanças', () => {
    const unsubscribe = vi.fn()
    const onChanges = vi.fn(() => unsubscribe)
    const client = createIpcClient({ invoke: vi.fn(), onChanges })
    const callback = vi.fn()

    client.onChanges(callback)()

    expect(onChanges).toHaveBeenCalledWith(callback)
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
