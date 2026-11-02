import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { AcceptanceCard } from './AcceptanceCard'
import {
  CRITERION_FIRST_ID,
  CRITERION_SECOND_ID,
  CRITERION_THIRD_ID,
  makeCriteriaView,
  makeCriterion,
  TASK_ID,
} from './fixtures'

afterEach(cleanup)

const first = makeCriterion()
const second = makeCriterion({
  id: CRITERION_SECOND_ID,
  text: 'Mostra a miniatura no comentário',
  done: true,
})
const third = makeCriterion({
  id: CRITERION_THIRD_ID,
  text: 'Remove o anexo ao apagar o comentário',
})

function setup(
  criteria = [first, second, third],
  options: { readOnly?: boolean; listError?: boolean } = {},
) {
  const api = createFakeApi()
  const view = makeCriteriaView(criteria)
  const list = options.listError
    ? vi.spyOn(api.acceptance, 'list').mockRejectedValue(new Error('offline'))
    : vi.spyOn(api.acceptance, 'list').mockResolvedValue(view)
  const add = vi.spyOn(api.acceptance, 'add').mockResolvedValue(view)
  const edit = vi.spyOn(api.acceptance, 'edit').mockResolvedValue(view)
  const setDone = vi.spyOn(api.acceptance, 'setDone').mockResolvedValue(view)
  const remove = vi.spyOn(api.acceptance, 'remove').mockResolvedValue(view)
  const reorder = vi.spyOn(api.acceptance, 'reorder').mockResolvedValue(view)
  const { container } = render(
    <ApiProvider api={api}>
      <QueryProvider>
        <AcceptanceCard taskId={TASK_ID} readOnly={options.readOnly ?? false} />
      </QueryProvider>
    </ApiProvider>,
  )
  return { add, edit, setDone, remove, reorder, list, container, user: userEvent.setup() }
}

describe('AcceptanceCard', () => {
  it('mostra a contagem n/m e cada critério no próprio campo', async () => {
    setup()
    expect(await screen.findByText('1/3')).toBeTruthy()
    expect(screen.getByDisplayValue('Aceita PNG e JPG até 5 MB')).toBeTruthy()
    expect(screen.getByDisplayValue('Mostra a miniatura no comentário')).toBeTruthy()
  })

  it('renderiza texto como texto, nunca como HTML', async () => {
    const hostile = makeCriterion({ text: '<img src=x onerror=alert(1)><b>oi</b>' })
    const { container } = setup([hostile])
    expect(await screen.findByDisplayValue('<img src=x onerror=alert(1)><b>oi</b>')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('adiciona pelo botão e devolve o foco ao campo de novo critério, limpo', async () => {
    const { add, user } = setup()
    const input = await screen.findByLabelText('Novo critério')
    await user.type(input, 'Revisar logs')
    await user.click(screen.getByRole('button', { name: 'Adicionar critério' }))
    await waitFor(() => expect(add).toHaveBeenCalledWith({ taskId: TASK_ID, text: 'Revisar logs' }))
    await waitFor(() => expect(screen.getByLabelText('Novo critério')).toHaveFocus())
    expect(screen.getByLabelText('Novo critério')).toHaveValue('')
  })

  it('Enter no campo de novo critério também adiciona', async () => {
    const { add, user } = setup()
    const input = await screen.findByLabelText('Novo critério')
    await user.type(input, 'Revisar logs{Enter}')
    await waitFor(() => expect(add).toHaveBeenCalledWith({ taskId: TASK_ID, text: 'Revisar logs' }))
  })

  it('recusa texto vazio ao adicionar, sem chamar a API', async () => {
    const { add, user } = setup()
    await screen.findByLabelText('Novo critério')
    await user.click(screen.getByRole('button', { name: 'Adicionar critério' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Escreva o critério.')
    expect(add).not.toHaveBeenCalled()
  })

  it('recusa critério acima de 200 caracteres, sem chamar a API', async () => {
    const { add, user } = setup()
    const input = await screen.findByLabelText('Novo critério')
    await user.click(input)
    await user.paste('a'.repeat(201))
    await user.click(screen.getByRole('button', { name: 'Adicionar critério' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O critério pode ter no máximo 200 caracteres.',
    )
    expect(add).not.toHaveBeenCalled()
  })

  it('edita o texto ao sair do campo', async () => {
    const { edit, user } = setup()
    const text = await screen.findByLabelText('Texto do critério 2')
    await user.clear(text)
    await user.type(text, 'Miniatura de até 200 px')
    await user.tab()
    await waitFor(() =>
      expect(edit).toHaveBeenCalledWith({
        taskId: TASK_ID,
        criterionId: CRITERION_SECOND_ID,
        text: 'Miniatura de até 200 px',
      }),
    )
  })

  it('texto vazio ao editar volta ao gravado e não chama a API', async () => {
    const { edit, user } = setup()
    const text = await screen.findByLabelText('Texto do critério 2')
    await user.clear(text)
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Escreva o critério.')
    expect(edit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Texto do critério 2')).toHaveValue(
      'Mostra a miniatura no comentário',
    )
  })

  it('marcar um critério chama setDone e atualiza a contagem', async () => {
    const { setDone, user } = setup()
    expect(await screen.findByText('1/3')).toBeTruthy()
    setDone.mockResolvedValueOnce(
      makeCriteriaView([first, { ...second, done: true }, { ...third, done: true }]),
    )
    await user.click(screen.getByRole('checkbox', { name: 'Critério 3 feito' }))
    await waitFor(() =>
      expect(setDone).toHaveBeenCalledWith({
        taskId: TASK_ID,
        criterionId: CRITERION_THIRD_ID,
        done: true,
      }),
    )
    expect(await screen.findByText('2/3')).toBeTruthy()
  })

  it('remover leva o foco ao texto do critério que ficou na mesma posição', async () => {
    const { remove, user } = setup()
    await screen.findByText('1/3')
    remove.mockResolvedValueOnce(makeCriteriaView([first, third]))
    await user.click(screen.getByRole('button', { name: 'Remover critério 2' }))
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith({ taskId: TASK_ID, criterionId: CRITERION_SECOND_ID }),
    )
    await waitFor(() => expect(screen.getByLabelText('Texto do critério 2')).toHaveFocus())
    expect(screen.getByLabelText('Texto do critério 2')).toHaveValue(
      'Remove o anexo ao apagar o comentário',
    )
  })

  it('remover o último leva o foco ao anterior', async () => {
    const { remove, user } = setup()
    await screen.findByText('1/3')
    remove.mockResolvedValueOnce(makeCriteriaView([first, second]))
    await user.click(screen.getByRole('button', { name: 'Remover critério 3' }))
    await waitFor(() => expect(screen.getByLabelText('Texto do critério 2')).toHaveFocus())
  })

  it('mover para cima e para baixo chama reorder com a posição de destino', async () => {
    const { reorder, user } = setup()
    await screen.findByText('1/3')
    reorder.mockResolvedValueOnce(makeCriteriaView([second, first, third]))
    await user.click(screen.getByRole('button', { name: 'Mover critério 2 para cima' }))
    await waitFor(() =>
      expect(reorder).toHaveBeenCalledWith({
        taskId: TASK_ID,
        criterionId: CRITERION_SECOND_ID,
        toIndex: 0,
      }),
    )
    expect(await screen.findByRole('button', { name: 'Mover critério 1 para cima' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mover critério 3 para baixo' })).toBeDisabled()
  })

  it('mover para baixo usa a posição seguinte', async () => {
    const { reorder, user } = setup()
    await screen.findByText('1/3')
    reorder.mockResolvedValueOnce(makeCriteriaView([second, first, third]))
    await user.click(screen.getByRole('button', { name: 'Mover critério 1 para baixo' }))
    await waitFor(() =>
      expect(reorder).toHaveBeenCalledWith({
        taskId: TASK_ID,
        criterionId: CRITERION_FIRST_ID,
        toIndex: 1,
      }),
    )
  })

  it('erro do servidor aparece em alerta de texto', async () => {
    const { setDone, user } = setup()
    await screen.findByText('1/3')
    setDone.mockRejectedValueOnce(new Error('falha'))
    await user.click(screen.getByRole('checkbox', { name: 'Critério 1 feito' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar o critério.',
    )
  })

  it('permissão negada pelo servidor aparece como aviso de permissão', async () => {
    const { remove, user } = setup()
    await screen.findByText('1/3')
    remove.mockRejectedValueOnce(new ApiError('FORBIDDEN', 'sem permissão'))
    await user.click(screen.getByRole('button', { name: 'Remover critério 1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não pode editar os critérios desta tarefa.',
    )
  })

  it('falha ao carregar aparece em alerta', async () => {
    setup([], { listError: true })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os critérios.',
    )
  })

  it('lista vazia mostra estado vazio e o campo de novo critério', async () => {
    setup([])
    expect(await screen.findByText('Nenhum critério ainda.')).toBeTruthy()
    expect(screen.getByLabelText('Novo critério')).toBeTruthy()
  })

  it('somente leitura: texto e contagem, sem campos, botões de ação ou adicionar', async () => {
    setup([first, second], { readOnly: true })
    expect(await screen.findByText('Aceita PNG e JPG até 5 MB')).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Remover|Mover|Adicionar/ })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Critério 1 feito' })).toBeDisabled()
  })
})
