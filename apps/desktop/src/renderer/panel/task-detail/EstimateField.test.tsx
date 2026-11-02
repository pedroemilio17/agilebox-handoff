import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { EstimateField } from './EstimateField'
import { makeDetail, TASK_ID } from './fixtures'

afterEach(cleanup)

function setup(
  overrides: Parameters<typeof makeDetail>[0] = {},
  options: { readOnly?: boolean } = {},
) {
  const api = createFakeApi()
  const task = makeDetail(overrides)
  const set = vi.spyOn(api.estimates, 'set').mockResolvedValue(task)
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <EstimateField task={task} readOnly={options.readOnly ?? false} />
      </QueryProvider>
    </ApiProvider>,
  )
  return { set, user: userEvent.setup() }
}

describe('EstimateField', () => {
  it('mostra a estimativa com vírgula decimal, separada do realizado', () => {
    setup({ estimatedHours: 2.5 })
    expect(screen.getByLabelText('Estimativa (h)')).toHaveValue('2,5')
  })

  it('campo vazio quando não há estimativa', () => {
    setup({ estimatedHours: null })
    expect(screen.getByLabelText('Estimativa (h)')).toHaveValue('')
  })

  it('grava ao sair do campo, com ponto ou vírgula', async () => {
    const { set, user } = setup({ estimatedHours: 2.5 })
    const field = screen.getByLabelText('Estimativa (h)')
    await user.clear(field)
    await user.type(field, '3,25')
    await user.tab()
    await waitFor(() => expect(set).toHaveBeenCalledWith({ taskId: TASK_ID, estimatedHours: 3.25 }))
  })

  it('campo vazio limpa a estimativa', async () => {
    const { set, user } = setup({ estimatedHours: 2.5 })
    const field = screen.getByLabelText('Estimativa (h)')
    await user.clear(field)
    await user.tab()
    await waitFor(() => expect(set).toHaveBeenCalledWith({ taskId: TASK_ID, estimatedHours: null }))
  })

  it('valor fora da faixa não grava e mostra alerta', async () => {
    const { set, user } = setup({ estimatedHours: 2.5 })
    const field = screen.getByLabelText('Estimativa (h)')
    await user.clear(field)
    await user.type(field, '1001')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Use um número de 0 a 1000, com até duas casas decimais.',
    )
    expect(set).not.toHaveBeenCalled()
  })

  it('mostra o custo estimado que o DTO trouxe, sem calcular a partir das horas', () => {
    setup({ estimatedHours: 3, estimatedCost: 195 })
    const cost = screen.getByLabelText('Custo estimado')
    expect(cost.textContent).toBe('R$ 195,00')
  })

  it('sem custo estimado no DTO, não mostra o rótulo nem calcula', () => {
    setup({ estimatedHours: 3, estimatedCost: null })
    expect(screen.queryByLabelText('Custo estimado')).toBeNull()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('somente leitura desabilita o campo', () => {
    setup({ estimatedHours: 2.5, readOnly: true, canEdit: false }, { readOnly: true })
    expect(screen.getByLabelText('Estimativa (h)')).toBeDisabled()
  })

  it('o rótulo de custo fica dentro do próprio bloco', () => {
    setup({ estimatedHours: 3, estimatedCost: 195 })
    const group = screen.getByRole('group', { name: 'Estimativa' })
    expect(within(group).getByLabelText('Custo estimado')).toBeTruthy()
  })
})
