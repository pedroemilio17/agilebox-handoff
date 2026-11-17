import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GetTaskDto } from '@agilebox/contract'
import { ApiError } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { projectModulesView } from '../../shared/testing/project-modules-fixture'
import { deliverableRow, wbsId, wbsView } from '../wbs/wbs-fixtures'
import { panelCopy } from '../copy'
import { DeliverableProperty } from './DeliverableProperty'
import { makeDetail, TASK_ID } from './fixtures'

const INFRA = wbsId('21')
const FINANCE = wbsId('22')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setup(
  task: GetTaskDto,
  {
    wbsOn = true,
    readOnly = false,
  }: { readonly wbsOn?: boolean; readonly readOnly?: boolean } = {},
) {
  const api = createFakeApi()
  vi.spyOn(api.projectModules, 'get').mockResolvedValue(
    projectModulesView({ enabled: wbsOn ? ['wbs'] : [], projectId: task.projectId }),
  )
  vi.spyOn(api.wbs, 'get').mockResolvedValue(
    wbsView([
      deliverableRow(INFRA, { code: '2.1', title: 'Infraestrutura' }),
      deliverableRow(FINANCE, { code: '2.2', title: 'Módulo financeiro' }),
    ]),
  )
  const setDeliverable = vi.spyOn(api.tasks, 'setDeliverable').mockResolvedValue(task)
  renderPanel(
    <dl>
      <DeliverableProperty task={task} readOnly={readOnly} />
    </dl>,
    { api },
  )
  return { api, setDeliverable }
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}

describe('Entrega no detalhe da tarefa', () => {
  it('sem a EAP ligada no projeto da tarefa, o campo não aparece e a EAP não é lida', async () => {
    const { api } = setup(makeDetail(), { wbsOn: false })
    await waitFor(() => expect(api.projectModules.get).toHaveBeenCalled())
    await flush()
    expect(screen.queryByRole('combobox', { name: 'Entrega' })).toBeNull()
    expect(api.wbs.get).not.toHaveBeenCalled()
  })

  it('com a EAP ligada, lista Sem entrega e as entregas com o código', async () => {
    setup(makeDetail({ deliverableId: null }))
    const select = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Entrega' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Sem entrega', '2.1 · Infraestrutura', '2.2 · Módulo financeiro'])
    expect(select.value).toBe('')
  })

  it('mostra a entrega atual da tarefa selecionada', async () => {
    setup(makeDetail({ deliverableId: FINANCE }))
    const select = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Entrega' })
    expect(select.value).toBe(FINANCE)
  })

  it('escolher uma entrega chama tasks.setDeliverable com a entrega', async () => {
    const user = userEvent.setup()
    const { setDeliverable } = setup(makeDetail({ deliverableId: null }))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Entrega' }), FINANCE)
    await waitFor(() =>
      expect(setDeliverable).toHaveBeenCalledWith({ taskId: TASK_ID, deliverableId: FINANCE }),
    )
  })

  it('Sem entrega envia null para desligar a tarefa da entrega', async () => {
    const user = userEvent.setup()
    const { setDeliverable } = setup(makeDetail({ deliverableId: INFRA }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Entrega' }),
      'Sem entrega',
    )
    await waitFor(() =>
      expect(setDeliverable).toHaveBeenCalledWith({ taskId: TASK_ID, deliverableId: null }),
    )
  })

  it('escolher a mesma entrega não chama o servidor', async () => {
    const user = userEvent.setup()
    const { setDeliverable } = setup(makeDetail({ deliverableId: INFRA }))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Entrega' }), INFRA)
    expect(setDeliverable).not.toHaveBeenCalled()
  })

  it('só leitura: mostra o texto da entrega, sem campo editável', async () => {
    setup(makeDetail({ deliverableId: FINANCE }), { readOnly: true })
    expect(await screen.findByText('2.2 · Módulo financeiro')).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Entrega' })).toBeNull()
  })

  it('só leitura sem entrega mostra Sem entrega', async () => {
    setup(makeDetail({ deliverableId: null }), { readOnly: true })
    expect(await screen.findByText('Sem entrega')).toBeTruthy()
  })

  it('permissão negada vira aviso curto', async () => {
    const user = userEvent.setup()
    const { setDeliverable } = setup(makeDetail({ deliverableId: null }))
    setDeliverable.mockRejectedValueOnce(new ApiError('FORBIDDEN', 'Sem permissão'))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Entrega' }), FINANCE)
    expect(await screen.findByText(panelCopy.forbidden)).toBeTruthy()
  })

  it('falha de outro tipo mostra o erro de salvar', async () => {
    const user = userEvent.setup()
    const { setDeliverable } = setup(makeDetail({ deliverableId: null }))
    setDeliverable.mockRejectedValueOnce(new Error('falha'))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Entrega' }), FINANCE)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(panelCopy.saveError)
  })
})
