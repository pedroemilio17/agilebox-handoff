import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel, settleCapabilities } from '../../shared/testing/render-panel'
import { BacklogControl } from './BacklogControl'
import { makeDetail, TASK_ID } from './fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const SCRUM = presetModules('scrum')
const KANBAN = presetModules('kanban')

function setup(task: Parameters<typeof BacklogControl>[0]['task'], modules = SCRUM) {
  const api = createFakeApi()
  const sendBack = vi.spyOn(api.backlog, 'sendBack').mockResolvedValue(task)
  const onSent = vi.fn()
  renderPanel(<BacklogControl task={task} readOnly={false} onSent={onSent} />, {
    api,
    tools: teamToolsView({ modules, level: 'intermediate' }),
  })
  return { api, sendBack, onSent }
}

describe('Devolver ao backlog', () => {
  it('aparece em A fazer com a ferramenta ligada; ao clicar, devolve e fecha o detalhe', async () => {
    const user = userEvent.setup()
    const { sendBack, onSent } = setup(makeDetail({ status: 'todo', inBacklog: false } as never))
    await user.click(await screen.findByRole('button', { name: 'Devolver ao backlog' }))
    await waitFor(() => expect(sendBack).toHaveBeenCalledWith({ taskId: TASK_ID }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
  })

  it('não aparece depois que o trabalho começou', async () => {
    const { api } = setup(makeDetail({ status: 'in_progress', inBacklog: false } as never))
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Devolver ao backlog' })).toBeNull()
  })

  it('não aparece com a ferramenta desligada (Kanban simples)', async () => {
    const { api } = setup(makeDetail({ status: 'todo', inBacklog: false } as never), KANBAN)
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Devolver ao backlog' })).toBeNull()
  })

  it('não aparece para item que já está no backlog', async () => {
    const { api } = setup(makeDetail({ status: 'planning', inBacklog: true } as never))
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Devolver ao backlog' })).toBeNull()
  })

  it('recusa do servidor aparece em pt-BR', async () => {
    const user = userEvent.setup()
    const { sendBack } = setup(makeDetail({ status: 'todo', inBacklog: false } as never))
    sendBack.mockRejectedValue(new ApiError('CONFLICT', 'Tarefa em Desenvolvendo já começou'))
    await user.click(await screen.findByRole('button', { name: 'Devolver ao backlog' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Tarefa em Desenvolvendo já começou')
  })
})
