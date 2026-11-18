import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type MilestoneDto, type MilestoneListItemDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { deliverableRow, wbsId, wbsView } from '../wbs/wbs-fixtures'
import { MilestonesView } from './MilestonesView'

const PROJECT = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const FINANCE = wbsId('22')
const M_PILOT = wbsId('M1')
const M_FINAL = wbsId('M2')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function item(overrides: Partial<MilestoneListItemDto> = {}): MilestoneListItemDto {
  return {
    id: M_PILOT,
    projectId: PROJECT,
    title: 'Piloto',
    dueOn: '2026-06-01',
    deliverableId: null,
    deliverableTitle: null,
    criterion: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  }
}

function saved(overrides: Partial<MilestoneDto> = {}): MilestoneDto {
  return {
    id: M_FINAL,
    projectId: PROJECT,
    title: 'Homologação',
    dueOn: '2026-12-18',
    deliverableId: null,
    criterion: null,
    createdAt: '2026-11-16T12:00:00.000Z',
    ...overrides,
  }
}

function setup({
  milestones = [],
  canEdit = true,
}: { readonly milestones?: readonly MilestoneListItemDto[]; readonly canEdit?: boolean } = {}) {
  const api = createFakeApi()
  vi.spyOn(api.milestones, 'list').mockResolvedValue({
    projectId: PROJECT,
    canEdit,
    milestones: [...milestones],
  })
  vi.spyOn(api.wbs, 'get').mockResolvedValue(
    wbsView([
      deliverableRow(wbsId('21'), { code: '2.1', title: 'Infraestrutura' }),
      deliverableRow(FINANCE, { code: '2.2', title: 'Módulo financeiro' }),
    ]),
  )
  const create = vi.spyOn(api.milestones, 'create').mockResolvedValue(saved())
  const update = vi.spyOn(api.milestones, 'update').mockResolvedValue(saved({ id: M_PILOT }))
  const remove = vi.spyOn(api.milestones, 'remove').mockResolvedValue(undefined)
  renderPanel(<MilestonesView projectId={PROJECT} projectName="Projeto Aurora" />, { api })
  return { api, create, update, remove }
}

function listItems() {
  return within(screen.getByRole('list', { name: 'Lista de marcos' })).getAllByRole('listitem')
}

describe('tela Marcos: leitura', () => {
  it('lista os marcos na ordem que o servidor manda, com data curta e entrega', async () => {
    setup({
      milestones: [
        item({ id: M_PILOT, title: 'Piloto', dueOn: '2026-06-01' }),
        item({
          id: M_FINAL,
          title: 'Homologação',
          dueOn: '2026-12-18',
          deliverableId: FINANCE,
          deliverableTitle: 'Módulo financeiro',
          criterion: 'Aprovada pelo cliente',
        }),
      ],
    })
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByRole('heading', { name: 'Piloto' })).toBeTruthy()
    expect(within(rows[1]!).getByRole('heading', { name: 'Homologação' })).toBeTruthy()
    expect(within(rows[1]!).getByText('sex 18/12')).toBeTruthy()
    expect(within(rows[1]!).getByText('Entrega: Módulo financeiro')).toBeTruthy()
    expect(within(rows[1]!).getByText('Critério: Aprovada pelo cliente')).toBeTruthy()
  })

  it('marco futuro mostra os dias restantes', async () => {
    setup({ milestones: [item({ dueOn: '2099-01-10' })] })
    expect(await screen.findByText(/faltam \d+ dias/)).toBeTruthy()
  })

  it('colaborador lê, sem ações e com a nota de leitura', async () => {
    setup({ milestones: [item()], canEdit: false })
    expect(await screen.findByRole('note')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toBe(
      'Só o gestor ou quem criou o projeto edita os marcos.',
    )
    expect(screen.queryByRole('button', { name: 'Novo marco' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()
  })

  it('estado vazio ensina com o manifesto do módulo', async () => {
    setup({ milestones: [], canEdit: false })
    expect(await screen.findByText('Nenhum marco ainda.')).toBeTruthy()
    expect(await screen.findByText(/Um marco tem nome, data/)).toBeTruthy()
  })

  it('carregando e erro da leitura', async () => {
    const api = createFakeApi()
    vi.spyOn(api.milestones, 'list').mockRejectedValue(new Error('falha'))
    renderPanel(<MilestonesView projectId={PROJECT} projectName={null} />, { api })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('sem projeto, pede para escolher um', () => {
    renderPanel(<MilestonesView projectId={null} projectName={null} />, { api: createFakeApi() })
    expect(screen.getByText('Escolha um projeto para ver os marcos.')).toBeTruthy()
  })
})

describe('tela Marcos: criar, editar e remover', () => {
  it('criar envia título, data, entrega e critério', async () => {
    const user = userEvent.setup()
    const { create } = setup({ milestones: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Novo marco' }))
    await user.type(screen.getByLabelText('Título do marco'), 'Homologação')
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-18' } })
    const deliverable = screen.getByLabelText('Entrega')
    await within(deliverable).findByRole('option', { name: '2.2 · Módulo financeiro' })
    await user.selectOptions(deliverable, FINANCE)
    await user.type(screen.getByLabelText('Critério (opcional)'), 'Aprovada')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        projectId: PROJECT,
        title: 'Homologação',
        dueOn: '2026-12-18',
        deliverableId: FINANCE,
        criterion: 'Aprovada',
      }),
    )
  })

  it('sem entrega e sem critério, envia nulos', async () => {
    const user = userEvent.setup()
    const { create } = setup({ milestones: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Novo marco' }))
    await user.type(screen.getByLabelText('Título do marco'), 'Homologação')
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-18' } })
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        projectId: PROJECT,
        title: 'Homologação',
        dueOn: '2026-12-18',
        deliverableId: null,
        criterion: null,
      }),
    )
  })

  it('validação mostra o que falta e não envia', async () => {
    const user = userEvent.setup()
    const { create } = setup({ milestones: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Novo marco' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Dê um título ao marco.')).toBeTruthy()
    expect(screen.getByText('Escolha a data do marco.')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it('erro do servidor aparece em alerta e o formulário continua aberto', async () => {
    const user = userEvent.setup()
    const { create } = setup({ milestones: [item()] })
    create.mockRejectedValueOnce(new ApiError('CONFLICT', 'Projeto arquivado: não aceita marcos.'))
    await user.click(await screen.findByRole('button', { name: 'Novo marco' }))
    await user.type(screen.getByLabelText('Título do marco'), 'Homologação')
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-18' } })
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Projeto arquivado: não aceita marcos.')
    expect(screen.getByLabelText('Título do marco')).toBeTruthy()
  })

  it('editar abre o formulário preenchido e envia só a edição', async () => {
    const user = userEvent.setup()
    const { update } = setup({
      milestones: [item({ criterion: 'Piloto rodando' })],
    })
    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    const title = screen.getByLabelText<HTMLInputElement>('Título do marco')
    expect(title.value).toBe('Piloto')
    await user.clear(title)
    await user.type(title, 'Piloto v2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        milestoneId: M_PILOT,
        title: 'Piloto v2',
        dueOn: '2026-06-01',
        deliverableId: null,
        criterion: 'Piloto rodando',
      }),
    )
  })

  it('remover pede confirmação inline antes de chamar o servidor', async () => {
    const user = userEvent.setup()
    const { remove } = setup({ milestones: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Remover' }))
    const confirm = screen.getByRole('group', { name: 'Confirmar remoção de Piloto' })
    expect(remove).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar remoção' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ milestoneId: M_PILOT }))
  })

  it('cancelar a remoção não chama o servidor', async () => {
    const user = userEvent.setup()
    const { remove } = setup({ milestones: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Remover' }))
    const confirm = screen.getByRole('group', { name: 'Confirmar remoção de Piloto' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
    expect(remove).not.toHaveBeenCalled()
    expect(listItems()).toHaveLength(1)
  })
})
