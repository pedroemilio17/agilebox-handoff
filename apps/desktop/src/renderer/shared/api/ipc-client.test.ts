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

  it('lista as tarefas arquivadas pelo canal tasks.listArchived, sem entrada', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true, value: [] })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })

    await expect(client.tasks.listArchived()).resolves.toEqual([])
    expect(invoke).toHaveBeenCalledWith('tasks.listArchived', undefined)
  })

  it('envia os métodos do backlog pelos canais backlog.*, com a posição e o id da tarefa', async () => {
    const channels: { channel: string; input: unknown }[] = []
    const invoke = vi.fn().mockImplementation((channel: string, input: unknown) => {
      channels.push({ channel, input })
      return Promise.resolve({ ok: true, value: channel === 'backlog.list' ? [] : undefined })
    })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })
    const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
    const projectId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

    await client.backlog.list({ projectId })
    await client.backlog.reorder({ taskId, placement: 'top' })
    await client.backlog.reorder({ taskId, placement: 3 })
    await client.backlog.takeToBoard({ taskId })
    await client.backlog.sendToBacklog({ taskId })

    expect(channels).toEqual([
      { channel: 'backlog.list', input: { projectId } },
      { channel: 'backlog.reorder', input: { taskId, placement: 'top' } },
      { channel: 'backlog.reorder', input: { taskId, placement: 3 } },
      { channel: 'backlog.takeToBoard', input: { taskId } },
      { channel: 'backlog.sendToBacklog', input: { taskId } },
    ])
  })

  it('envia critérios de aceite e estimativa pelos canais acceptance.* e estimates.set', async () => {
    const channels: { channel: string; input: unknown }[] = []
    const invoke = vi.fn().mockImplementation((channel: string, input: unknown) => {
      channels.push({ channel, input })
      return Promise.resolve({ ok: true, value: undefined })
    })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })
    const taskId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
    const criterionId = '01ARZ3NDEKTSV4RRFFQ69G5FAW'

    await client.acceptance.list({ taskId })
    await client.acceptance.add({ taskId, text: 'Login' })
    await client.acceptance.edit({ taskId, criterionId, text: 'Login com e-mail' })
    await client.acceptance.setDone({ taskId, criterionId, done: true })
    await client.acceptance.remove({ taskId, criterionId })
    await client.acceptance.reorder({ taskId, criterionId, toIndex: 2 })
    await client.estimates.set({ taskId, estimatedHours: 1.5 })
    await client.estimates.set({ taskId, estimatedHours: null })

    expect(channels).toEqual([
      { channel: 'acceptance.list', input: { taskId } },
      { channel: 'acceptance.add', input: { taskId, text: 'Login' } },
      { channel: 'acceptance.edit', input: { taskId, criterionId, text: 'Login com e-mail' } },
      { channel: 'acceptance.setDone', input: { taskId, criterionId, done: true } },
      { channel: 'acceptance.remove', input: { taskId, criterionId } },
      { channel: 'acceptance.reorder', input: { taskId, criterionId, toIndex: 2 } },
      { channel: 'estimates.set', input: { taskId, estimatedHours: 1.5 } },
      { channel: 'estimates.set', input: { taskId, estimatedHours: null } },
    ])
  })

  it('leva a mensagem do servidor ao reordenar sem permissão', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Só o gestor reordena o backlog' },
    })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })

    await expect(
      client.backlog.reorder({ taskId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', placement: 'end' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 'FORBIDDEN',
      message: 'Só o gestor reordena o backlog',
    } satisfies Partial<ApiError>)
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

  it('envia leitura e gravação do nível do time pelos canais de teamSettings', async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true, value: 'advanced' })
    const client = createIpcClient({ invoke, onChanges: () => () => undefined })

    await client.teamSettings.getLevel()
    await client.teamSettings.setLevel({ level: 'advanced' })

    expect(invoke).toHaveBeenNthCalledWith(1, 'teamSettings.getLevel', undefined)
    expect(invoke).toHaveBeenNthCalledWith(2, 'teamSettings.setLevel', { level: 'advanced' })
  })
})
