import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type RiskDto, type RiskListItemDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { deliverableRow, wbsId, wbsView } from '../wbs/wbs-fixtures'
import { RisksView } from './RisksView'

const PROJECT = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const R_HIGH = '01J8Y4G2XK8Z1S6M3Q9W0RISK1'
const R_LOW = '01J8Y4G2XK8Z1S6M3Q9W0RISK2'
const R_NEW = '01J8Y4G2XK8Z1S6M3Q9W0RISK3'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0USERA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function item(overrides: Partial<RiskListItemDto> = {}): RiskListItemDto {
  return {
    id: R_HIGH,
    projectId: PROJECT,
    title: 'Fornecedor atrasa a entrega',
    description: 'Contrato com prazo apertado',
    probability: 3,
    impact: 3,
    response: 'Antecipar o pedido',
    ownerId: ANA,
    ownerName: 'Ana',
    deliverableId: null,
    deliverableTitle: null,
    status: 'open',
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  }
}

function saved(overrides: Partial<RiskDto> = {}): RiskDto {
  return {
    id: R_NEW,
    projectId: PROJECT,
    title: 'Equipe reduzida',
    description: null,
    probability: 2,
    impact: 2,
    response: null,
    ownerId: null,
    ownerName: null,
    deliverableId: null,
    status: 'open',
    createdAt: '2026-11-16T12:00:00.000Z',
    updatedAt: '2026-11-16T12:00:00.000Z',
    ...overrides,
  }
}

function setup({
  risks = [],
  canEdit = true,
}: { readonly risks?: readonly RiskListItemDto[]; readonly canEdit?: boolean } = {}) {
  const api = createFakeApi()
  vi.spyOn(api.risks, 'list').mockResolvedValue({ projectId: PROJECT, canEdit, risks: [...risks] })
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([
    { id: ANA, name: 'Ana', initials: 'A', role: 'collaborator' },
  ])
  vi.spyOn(api.wbs, 'get').mockResolvedValue(
    wbsView([deliverableRow(wbsId('21'), { code: '2.1', title: 'Infraestrutura' })]),
  )
  const create = vi.spyOn(api.risks, 'create').mockResolvedValue(saved())
  const update = vi.spyOn(api.risks, 'update').mockResolvedValue(saved({ id: R_HIGH }))
  const remove = vi.spyOn(api.risks, 'remove').mockResolvedValue(undefined)
  renderPanel(<RisksView projectId={PROJECT} projectName="Projeto Aurora" />, { api })
  return { api, create, update, remove }
}

function listItems() {
  return within(screen.getByRole('list', { name: 'Lista de riscos' })).getAllByRole('listitem')
}

describe('tela Riscos: lista', () => {
  it('mostra os riscos na ordem recebida, com faixa em texto, dono e resposta', async () => {
    setup({
      risks: [
        item(),
        item({
          id: R_LOW,
          title: 'Documentação incompleta',
          probability: 1,
          impact: 2,
          description: null,
          response: null,
          ownerId: null,
          ownerName: null,
          status: 'mitigated',
        }),
      ],
    })
    const rows = await waitFor(() => listItems())
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByText('Alto · pontuação 9')).toBeTruthy()
    expect(
      within(rows[0]!).getByRole('heading', { name: 'Fornecedor atrasa a entrega' }),
    ).toBeTruthy()
    expect(within(rows[0]!).getByText('Dono: Ana')).toBeTruthy()
    expect(within(rows[0]!).getByText('Resposta: Antecipar o pedido')).toBeTruthy()
    expect(within(rows[1]!).getByText('Baixo · pontuação 2')).toBeTruthy()
    expect(within(rows[1]!).getByText('Dono: Sem dono')).toBeTruthy()
    expect(within(rows[1]!).getByText('Mitigado')).toBeTruthy()
  })

  it('mostra a entrega quando a lista traz o título dela', async () => {
    setup({ risks: [item({ deliverableId: wbsId('21'), deliverableTitle: 'Infraestrutura' })] })
    const [row] = await waitFor(() => listItems())
    expect(within(row!).getByText('Entrega: Infraestrutura')).toBeTruthy()
  })

  it('sem riscos, mostra o estado vazio com o botão de criar', async () => {
    setup()
    expect(await screen.findByRole('button', { name: 'Novo risco' })).toBeTruthy()
    expect(screen.getByText('Nenhum risco registrado.')).toBeTruthy()
  })

  it('sem projeto selecionado, pede para escolher um', () => {
    const api = createFakeApi()
    renderPanel(<RisksView projectId={null} projectName={null} />, { api })
    expect(screen.getByText('Escolha um projeto para ver os riscos.')).toBeTruthy()
  })

  it('quem não edita vê a lista em leitura, sem ações', async () => {
    setup({ risks: [item()], canEdit: false })
    expect((await screen.findByRole('note')).textContent).toContain(
      'Só o gestor ou quem criou o projeto edita os riscos.',
    )
    expect(screen.queryByRole('button', { name: 'Novo risco' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  })
})

describe('tela Riscos: criar', () => {
  it('cria com probabilidade e impacto padrão médios, sem dono e sem entrega', async () => {
    const user = userEvent.setup()
    const { create } = setup({ risks: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Novo risco' }))
    await user.type(screen.getByLabelText('Título do risco'), 'Equipe reduzida')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith({
      projectId: PROJECT,
      title: 'Equipe reduzida',
      description: null,
      probability: 2,
      impact: 2,
      response: null,
      ownerId: null,
      deliverableId: null,
    })
  })

  it('título vazio não envia e mostra o erro no campo', async () => {
    const user = userEvent.setup()
    const { create } = setup({ risks: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Novo risco' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Dê um título ao risco.')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it('escolhe probabilidade, impacto, dono e entrega antes de salvar', async () => {
    const user = userEvent.setup()
    const { create } = setup()
    await user.click(await screen.findByRole('button', { name: 'Novo risco' }))
    await user.type(screen.getByLabelText('Título do risco'), 'Fornecedor atrasa')
    await user.selectOptions(screen.getByLabelText('Probabilidade'), 'Alta')
    await user.selectOptions(screen.getByLabelText('Impacto'), 'Baixa')
    await user.selectOptions(screen.getByLabelText('Dono'), ANA)
    await user.selectOptions(await screen.findByLabelText('Entrega'), wbsId('21'))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        probability: 3,
        impact: 1,
        ownerId: ANA,
        deliverableId: wbsId('21'),
      }),
    )
  })

  it('erro do servidor aparece na tela e o formulário continua aberto', async () => {
    const user = userEvent.setup()
    const { create } = setup({ risks: [item()] })
    create.mockRejectedValue(
      new ApiError('CONFLICT', 'Projeto arquivado não aceita mudanças nos riscos.'),
    )
    await user.click(await screen.findByRole('button', { name: 'Novo risco' }))
    await user.type(screen.getByLabelText('Título do risco'), 'Equipe reduzida')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Projeto arquivado não aceita mudanças nos riscos.',
    )
    expect(screen.getByLabelText('Título do risco')).toBeTruthy()
  })
})

describe('tela Riscos: editar e remover', () => {
  it('edita com situação, e salva só o que mudou além dos campos atuais', async () => {
    const user = userEvent.setup()
    const { update } = setup({ risks: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    await user.selectOptions(screen.getByLabelText('Situação'), 'Mitigado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        riskId: R_HIGH,
        title: 'Fornecedor atrasa a entrega',
        probability: 3,
        impact: 3,
        ownerId: ANA,
        status: 'mitigated',
      }),
    )
  })

  it('remove só depois de confirmar', async () => {
    const user = userEvent.setup()
    const { remove } = setup({ risks: [item()] })
    await user.click(await screen.findByRole('button', { name: 'Remover' }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar remoção' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ riskId: R_HIGH }))
  })
})
