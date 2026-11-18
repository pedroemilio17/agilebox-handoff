import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcceptanceCriterionDto, GetTaskDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { CriteriaCard } from './CriteriaCard'
import { makeDetail, TASK_ID } from './fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function criterion(
  id: string,
  text: string,
  position: number,
  done = false,
): AcceptanceCriterionDto {
  return {
    id,
    taskId: TASK_ID,
    text,
    done,
    position,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
  }
}

const ID1 = '01J8Y4G2XK8Z1S6M3Q9W0AC001'
const ID2 = '01J8Y4G2XK8Z1S6M3Q9W0AC002'

function detail(criteria: AcceptanceCriterionDto[]): GetTaskDto {
  return makeDetail({ criteria })
}

function setup(task: GetTaskDto, { readOnly = false, windingDown = false } = {}) {
  const api = createFakeApi()
  const spies = {
    add: vi.spyOn(api.tasks.criteria, 'add').mockResolvedValue(task),
    toggle: vi.spyOn(api.tasks.criteria, 'toggle').mockResolvedValue(task),
    rename: vi.spyOn(api.tasks.criteria, 'rename').mockResolvedValue(task),
    remove: vi.spyOn(api.tasks.criteria, 'remove').mockResolvedValue(task),
    move: vi.spyOn(api.tasks.criteria, 'move').mockResolvedValue(task),
  }
  renderPanel(<CriteriaCard task={task} readOnly={readOnly} windingDown={windingDown} />, { api })
  return spies
}

describe('Critérios de aceitação no detalhe', () => {
  it('mostra a lista, o progresso e a contagem feitos/total', () => {
    setup(
      detail([criterion(ID1, 'Login funciona', 0, true), criterion(ID2, 'Erro mostra aviso', 1)]),
    )
    const region = screen.getByRole('region', { name: 'Critérios de aceitação' })
    expect(within(region).getByText('1/2')).toBeTruthy()
    expect(
      within(region).getByRole('checkbox', { name: /Marcar critério Login funciona/ }),
    ).toBeTruthy()
  })

  it('botão "Adicionar critério" inclui o critério pelo criteria.add, sem precisar de Enter', async () => {
    const user = userEvent.setup()
    const spies = setup(detail([]))
    await user.type(
      screen.getByRole('textbox', { name: 'Adicionar critério' }),
      'Pagamento confirma',
    )
    await user.click(screen.getByRole('button', { name: 'Adicionar critério' }))
    await waitFor(() =>
      expect(spies.add).toHaveBeenCalledWith({ taskId: TASK_ID, text: 'Pagamento confirma' }),
    )
  })

  it('Enter adiciona o critério pelo criteria.add e limpa o campo', async () => {
    const user = userEvent.setup()
    const spies = setup(detail([]))
    const field = screen.getByRole('textbox', { name: 'Adicionar critério' })
    await user.type(field, 'Logout limpa a sessão{Enter}')
    await waitFor(() =>
      expect(spies.add).toHaveBeenCalledWith({ taskId: TASK_ID, text: 'Logout limpa a sessão' }),
    )
  })

  it('texto vazio e texto acima de 200 caracteres avisam sem gravar', async () => {
    const user = userEvent.setup()
    const spies = setup(detail([]))
    const field = screen.getByRole('textbox', { name: 'Adicionar critério' })
    await user.type(field, '   {Enter}')
    expect(screen.getByRole('alert').textContent).toBe('Informe o texto do critério.')
    fireEvent.change(field, { target: { value: 'a'.repeat(201) } })
    await user.type(field, '{Enter}')
    expect(screen.getByRole('alert').textContent).toBe('O critério deve ter até 200 caracteres.')
    expect(spies.add).not.toHaveBeenCalled()
  })

  it('no limite de 20 critérios, o campo some e a mensagem aparece', () => {
    const twenty = Array.from({ length: 20 }, (_, index) =>
      criterion(
        `01J8Y4G2XK8Z1S6M3Q9W0AD${String(index).padStart(3, '0')}`,
        `Critério ${index}`,
        index,
      ),
    )
    setup(detail(twenty))
    expect(screen.queryByRole('textbox', { name: 'Adicionar critério' })).toBeNull()
    expect(screen.getByText('Limite de 20 critérios.')).toBeTruthy()
  })

  it('marcar, renomear, remover e reordenar chamam o servidor com os identificadores certos', async () => {
    const user = userEvent.setup()
    const spies = setup(
      detail([criterion(ID1, 'Login funciona', 0), criterion(ID2, 'Erro mostra aviso', 1)]),
    )

    await user.click(screen.getByRole('checkbox', { name: /Marcar critério Login funciona/ }))
    expect(spies.toggle).toHaveBeenCalledWith({ taskId: TASK_ID, criterionId: ID1, done: true })

    await user.click(
      screen.getByRole('button', { name: 'Mover critério Erro mostra aviso para cima' }),
    )
    expect(spies.move).toHaveBeenCalledWith({ taskId: TASK_ID, criterionId: ID2, position: 0 })

    await user.click(
      screen.getByRole('button', { name: 'Mover critério Login funciona para baixo' }),
    )
    expect(spies.move).toHaveBeenLastCalledWith({ taskId: TASK_ID, criterionId: ID1, position: 1 })

    await user.click(screen.getByRole('button', { name: 'Remover critério Erro mostra aviso' }))
    expect(spies.remove).toHaveBeenCalledWith({ taskId: TASK_ID, criterionId: ID2 })
  })

  it('renomear abre o campo, grava com Enter e não grava texto inválido', async () => {
    const user = userEvent.setup()
    const spies = setup(detail([criterion(ID1, 'Login funciona', 0)]))
    await user.click(screen.getByRole('button', { name: 'Renomear critério Login funciona' }))
    const input = screen.getByRole('textbox', { name: 'Texto do critério' })
    await user.clear(input)
    await user.type(input, 'Login e logout funcionam{Enter}')
    await waitFor(() =>
      expect(spies.rename).toHaveBeenCalledWith({
        taskId: TASK_ID,
        criterionId: ID1,
        text: 'Login e logout funcionam',
      }),
    )
  })

  it('encerrando: não entra critério novo, mas marcar e reordenar seguem', async () => {
    const user = userEvent.setup()
    const spies = setup(detail([criterion(ID1, 'Login funciona', 0)]), { windingDown: true })
    expect(screen.queryByRole('textbox', { name: 'Adicionar critério' })).toBeNull()
    expect(screen.getByText('Critérios em encerramento: não aceitam critérios novos.')).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: /Marcar critério Login funciona/ }))
    expect(spies.toggle).toHaveBeenCalled()
  })

  it('somente leitura: sem campo, sem controles e com aviso', () => {
    setup(detail([criterion(ID1, 'Login funciona', 0)]), { readOnly: true })
    expect(screen.queryByRole('textbox', { name: 'Adicionar critério' })).toBeNull()
    expect(screen.getByText('Somente leitura: você não pode alterar estes critérios.')).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: /Marcar critério/ }).disabled,
    ).toBe(true)
  })
})
