import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type WbsViewDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { WbsView, type WbsViewProps } from './WbsView'
import { deliverableRow, taskRow, WBS_PROJECT_ID, wbsId, wbsView } from './wbs-fixtures'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const ENTREGA_1 = wbsId('1')
const ENTREGA_1_1 = wbsId('2')
const ENTREGA_1_1_1 = wbsId('3')
const ENTREGA_2 = wbsId('4')
const TAREFA = wbsId('5')

/** EAP de exemplo: "Levantamento" > "Entrevistas" > "Mapa", com uma tarefa; "Configuração" ao lado. */
function sampleView(canEdit = true): WbsViewDto {
  return wbsView(
    [
      deliverableRow(ENTREGA_1, {
        code: '1',
        title: 'Levantamento',
        level: 1,
        hours: 100,
        cost: 1800,
        progress: 40,
        tasks: 2,
        milestones: [{ id: wbsId('9'), title: 'Diagnóstico pronto', dueOn: '2027-01-10' }],
      }),
      deliverableRow(ENTREGA_1_1, {
        parentId: ENTREGA_1,
        code: '1.1',
        title: 'Entrevistas',
        level: 2,
        hours: 40,
        cost: 600,
        progress: 100,
      }),
      deliverableRow(ENTREGA_1_1_1, {
        parentId: ENTREGA_1_1,
        code: '1.1.1',
        title: 'Mapa',
        level: 3,
        hours: 12.5,
        cost: 200,
        progress: 0,
      }),
      taskRow(TAREFA, ENTREGA_1_1, {
        title: 'Agendar entrevistas',
        status: 'in_progress',
        responsibleName: 'Ana Souza',
        estimatedHours: 8,
      }),
      deliverableRow(ENTREGA_2, {
        code: '2',
        title: 'Configuração',
        level: 1,
        hours: 60,
        cost: null,
        progress: 0,
      }),
    ],
    {
      canEdit,
      summary: { deliverables: 4, tasks: 10, hours: 160, cost: 2600, progress: 45 },
    },
  )
}

function renderWbs({
  view = sampleView(),
  props = {},
  create,
  rename,
  move,
  remove,
  get,
}: {
  readonly view?: WbsViewDto
  readonly props?: Partial<WbsViewProps>
  readonly create?: () => Promise<WbsViewDto>
  readonly rename?: () => Promise<WbsViewDto>
  readonly move?: () => Promise<WbsViewDto>
  readonly remove?: () => Promise<WbsViewDto>
  readonly get?: () => Promise<WbsViewDto>
} = {}) {
  const api = createFakeApi({
    wbs: {
      get: vi.fn(get ?? (() => Promise.resolve(view))),
      createDeliverable: vi.fn(create ?? (() => Promise.resolve(view))),
      renameDeliverable: vi.fn(rename ?? (() => Promise.resolve(view))),
      moveDeliverable: vi.fn(move ?? (() => Promise.resolve(view))),
      removeDeliverable: vi.fn(remove ?? (() => Promise.resolve(view))),
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <WbsView projectId={WBS_PROJECT_ID} projectName="Projeto Aurora" {...props} />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, user: userEvent.setup() }
}

/** Linha da tabela de uma entrega, pelo texto do título. */
function rowOf(title: string) {
  return screen.getByText(title, { selector: 'span' }).closest('tr') as HTMLElement
}

describe('árvore da EAP', () => {
  it('mostra códigos, totais por entrega e o resumo', async () => {
    renderWbs()
    const table = await screen.findByRole('table', {
      name: 'Estrutura de entregas e tarefas do projeto',
    })
    expect(within(table).getByText('1.1')).toBeTruthy()
    expect(within(table).getByText('1.1.1')).toBeTruthy()
    expect(within(table).getByText('100 h')).toBeTruthy()
    expect(within(table).getByText('12,5 h')).toBeTruthy()
    expect(within(table).getByText(/R\$\s1\.800,00/)).toBeTruthy()
    expect(within(table).getByText(/Diagnóstico pronto · \d{2}\/\d{2}/)).toBeTruthy()

    const summary = screen.getByRole('region', { name: 'Resumo' })
    expect(within(summary).getByText('4 · 10 tarefas')).toBeTruthy()
    expect(within(summary).getByText('160 h')).toBeTruthy()
    expect(within(summary).getByText('45%')).toBeTruthy()
  })

  it('mostra a tarefa com responsável e estado', async () => {
    renderWbs()
    const row = (await screen.findByText('Agendar entrevistas')).closest('tr') as HTMLElement
    expect(within(row).getByText('AS')).toBeTruthy()
    expect(within(row).getByText('Desenvolvendo')).toBeTruthy()
  })

  it('não mostra coluna de período', async () => {
    renderWbs()
    await screen.findByRole('table')
    expect(screen.queryByRole('columnheader', { name: 'Período' })).toBeNull()
  })

  it('não oferece subentrega no nível 3', async () => {
    renderWbs()
    await screen.findByRole('table')
    expect(within(rowOf('Mapa')).queryByRole('button', { name: /Subentrega em/ })).toBeNull()
    expect(
      within(rowOf('Entrevistas')).getByRole('button', { name: 'Subentrega em Entrevistas' }),
    ).toBeTruthy()
  })
})

describe('recolher e expandir', () => {
  it('recolhe os filhos de uma entrega e marca aria-expanded', async () => {
    const user = renderWbs().user
    await screen.findByRole('table')
    const toggle = screen.getByRole('button', { name: 'Recolher Levantamento' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    await user.click(toggle)

    expect(screen.queryByText('Entrevistas')).toBeNull()
    expect(screen.queryByText('Agendar entrevistas')).toBeNull()
    const collapsed = screen.getByRole('button', { name: 'Expandir Levantamento' })
    expect(collapsed.getAttribute('aria-expanded')).toBe('false')

    await user.click(collapsed)
    expect(screen.getByText('Entrevistas')).toBeTruthy()
  })

  it('"Recolher tudo" e "Expandir tudo" mudam todas as entregas com filhos', async () => {
    const user = renderWbs().user
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Recolher tudo' }))
    expect(screen.queryByText('Mapa')).toBeNull()
    expect(screen.getByText('Configuração')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Expandir tudo' }))
    expect(screen.getByText('Mapa')).toBeTruthy()
  })
})

describe('criação', () => {
  it('"Nova entrega" cria no nível raiz (parentId null)', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nova entrega' }))
    const field = screen.getByLabelText('Nome da nova entrega')
    const submit = screen.getByRole('button', { name: 'Criar' })
    expect(submit).toHaveProperty('disabled', true)

    await user.type(field, '  Módulo financeiro  ')
    await user.click(submit)

    await waitFor(() =>
      expect(api.wbs.createDeliverable).toHaveBeenCalledWith({
        projectId: WBS_PROJECT_ID,
        parentId: null,
        title: 'Módulo financeiro',
      }),
    )
  })

  it('subentrega cria com o pai escolhido', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Subentrega em Levantamento' }))
    await user.type(
      screen.getByLabelText('Nome da subentrega de Levantamento'),
      'Entrevistas extras',
    )
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(api.wbs.createDeliverable).toHaveBeenCalledWith({
        projectId: WBS_PROJECT_ID,
        parentId: ENTREGA_1,
        title: 'Entrevistas extras',
      }),
    )
  })

  it('Esc cancela o campo de nova entrega sem criar', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Nova entrega' }))
    await user.type(screen.getByLabelText('Nome da nova entrega'), 'Rascunho{Escape}')

    expect(screen.queryByLabelText('Nome da nova entrega')).toBeNull()
    expect(api.wbs.createDeliverable).not.toHaveBeenCalled()
  })
})

describe('renomear', () => {
  it('Enter salva o novo nome', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Renomear Configuração' }))
    const field = screen.getByLabelText('Novo nome de Configuração')
    await user.clear(field)
    await user.type(field, 'Configuração aprovada{Enter}')

    await waitFor(() =>
      expect(api.wbs.renameDeliverable).toHaveBeenCalledWith({
        deliverableId: ENTREGA_2,
        title: 'Configuração aprovada',
      }),
    )
  })

  it('Esc cancela a renomeação', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Renomear Configuração' }))
    await user.type(screen.getByLabelText('Novo nome de Configuração'), 'x{Escape}')

    expect(screen.queryByLabelText('Novo nome de Configuração')).toBeNull()
    expect(api.wbs.renameDeliverable).not.toHaveBeenCalled()
  })
})

describe('mover', () => {
  it('"Descer" move para a posição seguinte entre os irmãos', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Descer Levantamento' }))

    await waitFor(() =>
      expect(api.wbs.moveDeliverable).toHaveBeenCalledWith({
        deliverableId: ENTREGA_1,
        parentId: null,
        position: 1,
      }),
    )
  })

  it('"Subir" na primeira entrega fica desabilitado; "Subir" na segunda move para a posição 0', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Subir Levantamento' }).disabled,
    ).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Subir Configuração' }))
    await waitFor(() =>
      expect(api.wbs.moveDeliverable).toHaveBeenCalledWith({
        deliverableId: ENTREGA_2,
        parentId: null,
        position: 0,
      }),
    )
  })

  it('move subentregas entre irmãos do mesmo pai', async () => {
    const view = sampleView()
    const { api, user } = renderWbs({
      view: wbsView(
        [
          ...view.deliverables,
          deliverableRow(wbsId('6'), {
            parentId: ENTREGA_1,
            code: '1.2',
            level: 2,
            title: 'Mapa geral',
          }),
        ],
        { canEdit: true },
      ),
    })
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Descer Entrevistas' }))
    await waitFor(() =>
      expect(api.wbs.moveDeliverable).toHaveBeenCalledWith({
        deliverableId: ENTREGA_1_1,
        parentId: ENTREGA_1,
        position: 1,
      }),
    )
  })
})

describe('remover', () => {
  it('pede confirmação e mostra a recusa do servidor em role="alert"', async () => {
    const { api, user } = renderWbs({
      remove: () =>
        Promise.reject(new ApiError('CONFLICT', 'Esta entrega tem tarefas. Mova-as antes.')),
    })
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Remover Levantamento' }))
    expect(api.wbs.removeDeliverable).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar remoção' }))

    expect(api.wbs.removeDeliverable).toHaveBeenCalledWith({ deliverableId: ENTREGA_1 })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Esta entrega tem tarefas. Mova-as antes.')
    // A ação continua visível: a recusa é do servidor, não da tela.
    expect(screen.getByRole('button', { name: 'Remover Levantamento' })).toBeTruthy()
  })

  it('cancelar a confirmação não remove', async () => {
    const { api, user } = renderWbs()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Remover Configuração' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(api.wbs.removeDeliverable).not.toHaveBeenCalled()
  })
})

describe('permissões e valores', () => {
  it('quem não pode editar vê a árvore sem ações e com a nota', async () => {
    renderWbs({ view: sampleView(false) })
    await screen.findByRole('table')

    expect(screen.getByRole('note').textContent).toBe(
      'Só o gestor ou quem criou o projeto edita a EAP.',
    )
    expect(screen.queryByRole('button', { name: 'Nova entrega' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Renomear|Remover|Subir|Descer/ })).toBeNull()
  })

  it('custo nulo aparece como traço', async () => {
    renderWbs({
      view: wbsView(
        [deliverableRow(ENTREGA_2, { code: '1', title: 'Configuração', hours: 60, cost: null })],
        {
          canEdit: false,
          summary: { deliverables: 1, tasks: 0, hours: 60, cost: null, progress: 0 },
        },
      ),
    })
    const table = await screen.findByRole('table')
    const row = within(table)
      .getByRole('rowheader', { name: /Configuração/ })
      .closest('tr') as HTMLElement
    expect(within(row).getByText('—', { selector: 'td' })).toBeTruthy()
    const summary = screen.getByRole('region', { name: 'Resumo' })
    expect(within(summary).getByText('Custo previsto').parentElement?.textContent).toContain('—')
  })

  it('com o módulo cost desligado, somem a coluna Custo, o cartão Custo previsto e a frase do rodapé', async () => {
    const view = wbsView(
      [deliverableRow(ENTREGA_2, { code: '1', title: 'Configuração', hours: 60, cost: null })],
      { summary: { deliverables: 1, tasks: 0, hours: 60, cost: null, progress: 0 } },
    )
    renderWbs({ view: { ...view, costEnabled: false } })
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Horas' })).toBeTruthy()
    expect(within(table).queryByRole('columnheader', { name: 'Custo' })).toBeNull()
    const row = within(table)
      .getByRole('rowheader', { name: /Configuração/ })
      .closest('tr') as HTMLElement
    expect(within(row).queryByText('—', { selector: 'td' })).toBeNull()
    const summary = screen.getByRole('region', { name: 'Resumo' })
    expect(within(summary).queryByText('Custo previsto')).toBeNull()
    expect(screen.queryByText(/Custo = horas/)).toBeNull()
    expect(screen.getByText(/Horas e progresso sobem somando os filhos/)).toBeTruthy()
  })
})

describe('estados', () => {
  it('sem projeto pede para escolher um projeto', () => {
    renderWbs({ props: { projectId: null } })
    expect(screen.getByText('Escolha um projeto para ver as entregas.')).toBeTruthy()
  })

  it('erro de carga mostra aviso e deixa tentar de novo', async () => {
    const get = vi
      .fn<() => Promise<WbsViewDto>>()
      .mockRejectedValueOnce(new ApiError('CONFLICT', 'falhou'))
      .mockResolvedValue(sampleView())
    const { user } = renderWbs({ get })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Não foi possível carregar as entregas deste projeto.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table')).toBeTruthy()
  })
})

describe('estado vazio (passo 1)', () => {
  it('mostra os campos numerados, as dicas e o título do passo', async () => {
    renderWbs({ view: wbsView([], { canEdit: true }) })

    expect(await screen.findByText('Passo 1')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Liste as entregas principais' })).toBeTruthy()
    expect(screen.getByLabelText('Entrega 1')).toBeTruthy()
    expect(screen.getByLabelText('Entrega 2')).toBeTruthy()
    expect(screen.getByText('Use substantivos')).toBeTruthy()
    expect(screen.getByText('Nada fica de fora')).toBeTruthy()
  })

  it('Enter cria a entrega e foca o próximo campo', async () => {
    const created = wbsView([deliverableRow(ENTREGA_1, { code: '1', title: 'Levantamento' })])
    const { api, user } = renderWbs({
      view: wbsView([], { canEdit: true }),
      create: () => Promise.resolve(created),
    })

    await user.type(await screen.findByLabelText('Entrega 1'), 'Levantamento{Enter}')

    await waitFor(() =>
      expect(api.wbs.createDeliverable).toHaveBeenCalledWith({
        projectId: WBS_PROJECT_ID,
        parentId: null,
        title: 'Levantamento',
      }),
    )
    await waitFor(() => expect(screen.getByLabelText('Entrega 2')).toHaveProperty('value', ''))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Entrega 2')))
    // A entrega criada aparece na árvore, e o passo continua aberto para o próximo campo.
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByLabelText('Entrega 1')).toBeTruthy()
  })

  it('Enter em campo vazio não cria nada', async () => {
    const { api, user } = renderWbs({ view: wbsView([], { canEdit: true }) })

    await user.click(await screen.findByLabelText('Entrega 1'))
    await user.keyboard('{Enter}')

    expect(api.wbs.createDeliverable).not.toHaveBeenCalled()
  })

  it('quem não pode editar vê só que não há entregas', async () => {
    renderWbs({ view: wbsView([], { canEdit: false }) })
    expect(await screen.findByText('Nenhuma entrega cadastrada.')).toBeTruthy()
    expect(screen.queryByLabelText('Entrega 1')).toBeNull()
  })
})
