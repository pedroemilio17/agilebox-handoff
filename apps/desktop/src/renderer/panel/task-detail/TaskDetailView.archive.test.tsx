import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDateOnly } from '@agilebox/core'
import type { GetTaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { makeDetail, TASK_ID } from './fixtures'
import { TaskDetailView } from './TaskDetailView'

afterEach(cleanup)

const ARCHIVED_AT = '2026-11-02T09:00:00.000Z'

function archivedOf(detail: GetTaskDto): GetTaskDto {
  return { ...detail, archivedAt: ARCHIVED_AT, canEdit: false, readOnly: true }
}

function setup({
  initial,
  afterChange,
  readOnlyScope = false,
}: {
  initial: GetTaskDto
  afterChange?: GetTaskDto
  readOnlyScope?: boolean
}) {
  const api = createFakeApi()
  const get = vi
    .spyOn(api.tasks, 'get')
    .mockResolvedValueOnce(initial)
    .mockResolvedValue(afterChange ?? initial)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  const archive = vi.spyOn(api.tasks, 'archive').mockResolvedValue(afterChange ?? initial)
  const unarchive = vi.spyOn(api.tasks, 'unarchive').mockResolvedValue(initial)
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <TaskDetailView
          taskId={TASK_ID}
          onBack={vi.fn()}
          readOnlyScope={readOnlyScope}
          today={parseDateOnly('2026-11-01')}
        />
      </QueryProvider>
    </ApiProvider>,
  )
  return { archive, unarchive, get, user: userEvent.setup() }
}

describe('Arquivar e desarquivar no detalhe da tarefa', () => {
  it('mostra Arquivar só quando o servidor informa que pode', async () => {
    setup({ initial: makeDetail({ canArchive: false }) })
    await screen.findByDisplayValue('Revisar integração')
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull()
  })

  it('não oferece arquivar na visão Equipe, mesmo para quem pode', async () => {
    setup({ initial: makeDetail({ canArchive: true }), readOnlyScope: true })
    await screen.findByDisplayValue('Revisar integração')
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull()
  })

  it('pede confirmação curta, arquiva pela API e mostra Desarquivar', async () => {
    const initial = makeDetail({ canArchive: true })
    const { archive, user } = setup({ initial, afterChange: archivedOf(initial) })
    await user.click(await screen.findByRole('button', { name: 'Arquivar' }))
    expect(screen.getByText(/Ela sai do quadro e fica somente leitura/)).toBeTruthy()
    expect(archive).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith({ taskId: TASK_ID }))
    expect(await screen.findByRole('button', { name: 'Desarquivar' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Tarefa arquivada' })).toBeTruthy()
  })

  it('cancela a confirmação sem arquivar', async () => {
    const { archive, user } = setup({ initial: makeDetail({ canArchive: true }) })
    await user.click(await screen.findByRole('button', { name: 'Arquivar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(archive).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeTruthy()
  })

  it('tarefa arquivada abre em leitura: campos desabilitados e Desarquivar no lugar', async () => {
    const detail = archivedOf(makeDetail({ canArchive: true }))
    const { unarchive, user } = setup({ initial: detail })
    const title = await screen.findByDisplayValue('Revisar integração')
    expect((title as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('region', { name: 'Tarefa arquivada' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Desarquivar' }))
    expect(unarchive).toHaveBeenCalledWith({ taskId: TASK_ID })
  })

  it('tarefa arquivada sem permissão mostra só o aviso, sem botão', async () => {
    setup({ initial: archivedOf(makeDetail({ canArchive: false })) })
    await screen.findByRole('region', { name: 'Tarefa arquivada' })
    expect(screen.queryByRole('button', { name: 'Desarquivar' })).toBeNull()
  })
})
