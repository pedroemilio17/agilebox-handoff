import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { GuideCard } from '../guide/GuideCard'
import { GUIDE_PROJECT_ID, makeGuide } from '../guide/guide-fixtures'
import { useCreateTask } from './use-create-task'

afterEach(cleanup)

const createdTask: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 1,
  key: 'AB-1',
  projectId: GUIDE_PROJECT_ID,
  projectName: 'Projeto Aurora',
  title: 'Nova tarefa',
  description: '',
  status: 'todo',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  commentCount: 0,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
}

/** Cartão do guia ao lado de um botão que cria tarefa, como o diálogo de nova tarefa faz. */
function Harness() {
  const createTask = useCreateTask()
  return (
    <>
      <GuideCard projectId={GUIDE_PROJECT_ID} onNavigate={vi.fn()} />
      <button
        type="button"
        onClick={() => createTask.mutate({ projectId: GUIDE_PROJECT_ID, title: 'Nova tarefa' })}
      >
        Criar tarefa de teste
      </button>
    </>
  )
}

describe('consulta do guia', () => {
  it('é refeita quando uma tarefa é criada, e o cartão atualiza sem recarregar', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    const get = vi
      .spyOn(api.guide, 'get')
      .mockResolvedValueOnce(makeGuide({ doneCount: 0 }))
      .mockResolvedValue(makeGuide({ doneCount: 1 }))
    vi.spyOn(api.tasks, 'create').mockResolvedValue(createdTask)
    renderPanel(<Harness />, { api })

    expect(await screen.findByText('0 de 7')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Criar tarefa de teste' }))

    expect(await screen.findByText('1 de 7')).not.toBeNull()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })
})
