import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GetTaskDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { EstimateProperty } from './EstimateProperty'
import { makeDetail, TASK_ID } from './fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setup(task: GetTaskDto) {
  const api = createFakeApi()
  const setEstimate = vi.spyOn(api.tasks, 'setEstimate').mockResolvedValue(task)
  renderPanel(
    <dl>
      <EstimateProperty task={task} readOnly={false} />
    </dl>,
    { api },
  )
  return { setEstimate, input: screen.getByRole('textbox', { name: 'Estimativa (h)' }) }
}

describe('Estimativa em horas no detalhe', () => {
  it('sem estimativa mostra o realizado ao lado', () => {
    setup(makeDetail({ estimatedHours: null, actualHours: 0 }))
    expect(screen.getByText('Sem estimativa · 0 h realizado')).toBeTruthy()
  })

  it('estimado × realizado em horas, sem valor em reais quando o servidor não manda', () => {
    setup(makeDetail({ estimatedHours: 2, actualHours: 1.5 }))
    expect(screen.getByText('2 h estimado × 1,5 h realizado')).toBeTruthy()
    expect(screen.queryByText('Custo estimado')).toBeNull()
  })

  it('custo estimado aparece só quando o servidor devolve', () => {
    setup(makeDetail({ estimatedHours: 2, estimatedCost: 80 }))
    expect(screen.getByLabelText('Custo estimado').textContent).toContain('80,00')
  })

  it('valor inválido avisa e não grava', async () => {
    const user = userEvent.setup()
    const { setEstimate, input } = setup(makeDetail({ estimatedHours: null }))
    await user.type(input, '10000')
    fireEvent.blur(input)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(
      'Use um número de 0 a 9999, com até 2 casas decimais.',
    )
    expect(setEstimate).not.toHaveBeenCalled()
  })

  it('grava ao sair do campo com vírgula, em horas', async () => {
    const user = userEvent.setup()
    const { setEstimate, input } = setup(makeDetail({ estimatedHours: null }))
    await user.type(input, '1,5')
    fireEvent.blur(input)
    await waitFor(() =>
      expect(setEstimate).toHaveBeenCalledWith({ taskId: TASK_ID, estimatedHours: 1.5 }),
    )
  })

  it('campo vazio tira a estimativa', async () => {
    const user = userEvent.setup()
    const { setEstimate, input } = setup(makeDetail({ estimatedHours: 3 }))
    await user.clear(input)
    fireEvent.blur(input)
    await waitFor(() =>
      expect(setEstimate).toHaveBeenCalledWith({ taskId: TASK_ID, estimatedHours: null }),
    )
  })

  it('valor igual ao atual não chama o servidor', async () => {
    const user = userEvent.setup()
    const { setEstimate, input } = setup(makeDetail({ estimatedHours: 2 }))
    await user.click(input)
    fireEvent.blur(input)
    expect(setEstimate).not.toHaveBeenCalled()
  })
})
