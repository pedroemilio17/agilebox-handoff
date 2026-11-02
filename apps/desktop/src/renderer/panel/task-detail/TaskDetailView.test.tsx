import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEAM_MODULE_IDS } from '@agilebox/contract'
import { parseDateOnly } from '@agilebox/core'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { UndoProvider } from '../layout/UndoProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import {
  makeCriteriaView,
  makeCriterion,
  makeDetail,
  makeEvent,
  makeParticipation,
  TASK_ID,
  USER_ID,
} from './fixtures'
import { TaskDetailView } from './TaskDetailView'

afterEach(cleanup)

type Level = 'basic' | 'intermediate' | 'advanced'

/** Nível do time e ferramentas ligadas, como `teamModules.get` devolve. Padrão: tudo ligado. */
function allowTeam(
  api: ReturnType<typeof createFakeApi>,
  level: Level,
  active: readonly string[] = TEAM_MODULE_IDS,
) {
  return vi.spyOn(api.teamModules, 'get').mockResolvedValue({
    level,
    screens: [],
    statuses: TEAM_MODULE_IDS.map((moduleId) => ({
      moduleId,
      state: active.includes(moduleId) ? 'active' : 'disabled',
    })),
  })
}

/** API falsa com o time já liberado no nível pedido (padrão: Avançado, tudo ligado). */
function fakeApi(level: Level = 'advanced', active?: readonly string[]) {
  const api = createFakeApi()
  allowTeam(api, level, active)
  return api
}

function setup(
  overrides: {
    detail?: ReturnType<typeof makeDetail>
    level?: Level
    active?: readonly string[]
  } = {},
) {
  const api = fakeApi(overrides.level ?? 'advanced', overrides.active)
  const detail = overrides.detail ?? makeDetail()
  vi.spyOn(api.tasks, 'get').mockResolvedValue(detail)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.acceptance, 'list').mockResolvedValue(makeCriteriaView([]))
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  const update = vi.spyOn(api.tasks, 'update').mockResolvedValue(detail)
  const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(detail)
  const onBack = vi.fn()
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <UndoProvider>
          <TaskDetailView taskId={TASK_ID} onBack={onBack} today={parseDateOnly('2026-11-01')} />
        </UndoProvider>
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, update, move, onBack, user: userEvent.setup() }
}

describe('Detalhe da tarefa', () => {
  it('mostra o alerta de parada e confirma andamento pela API', async () => {
    const { update, user } = setup({ detail: makeDetail({ agingDays: 5 }) })
    expect(
      await screen.findByText('Parada há 5 dias em Desenvolvendo. Algo está travando?'),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Segue em andamento' }))
    expect(update).toHaveBeenCalledWith({ taskId: TASK_ID, changes: { progressConfirmed: true } })
  })
  it('desabilita confirmação para somente leitura', async () => {
    setup({ detail: makeDetail({ agingDays: 5, readOnly: true, canEdit: false }) })
    expect(
      (await screen.findByRole('button', { name: 'Segue em andamento' })).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('registra a abertura e mostra título e descrição', async () => {
    const { api } = setup()
    expect(await screen.findByDisplayValue('Revisar integração')).toBeTruthy()
    expect(screen.getByDisplayValue('Descrição inicial')).toBeTruthy()
    expect(api.tasks.recordOpen).toHaveBeenCalledWith({ taskId: TASK_ID })
  })

  it('grava a descrição uma única vez ao sair do campo', async () => {
    const { update, user } = setup()
    const field = await screen.findByLabelText('Descrição')
    await user.clear(field)
    await user.type(field, 'Nova descrição')
    expect(update).not.toHaveBeenCalled()
    await user.tab()
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith({
      taskId: TASK_ID,
      changes: { description: 'Nova descrição' },
    })
  })

  it('não grava quando o campo é editado e volta ao mesmo valor', async () => {
    const { update, user } = setup()
    const field = await screen.findByLabelText('Descrição')
    await user.click(field)
    await user.tab()
    expect(update).not.toHaveBeenCalled()
  })

  it('renomeia pelo cabeçalho e ignora título vazio', async () => {
    const { update, user } = setup()
    const title = await screen.findByLabelText('Título da tarefa')
    await user.clear(title)
    await user.tab()
    expect(update).not.toHaveBeenCalled()
    expect((title as HTMLInputElement).value).toBe('Revisar integração')
    await user.clear(title)
    await user.type(title, 'Outro título')
    await user.tab()
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ taskId: TASK_ID, changes: { title: 'Outro título' } }),
    )
  })

  it('muda o estado pelo menu', async () => {
    const { move, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Status' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Revisar' }))
    expect(move).toHaveBeenCalledWith({ taskId: TASK_ID, status: 'review' })
  })

  it('grava o chamado: número, link e limpeza', async () => {
    const { update, user } = setup()
    const id = await screen.findByLabelText('Número do chamado')
    await user.type(id, '12a3')
    await user.tab()
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ taskId: TASK_ID, changes: { ticketId: 123 } }),
    )
  })

  it('mostra o responsável', async () => {
    setup()
    const row = await screen.findByRole('group', { name: 'Responsável' })
    expect(row.textContent).toContain('Ana Souza')
  })

  it('desabilita os campos e mostra o selo no modo somente leitura', async () => {
    setup({ detail: makeDetail({ canEdit: false, readOnly: true }) })
    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>('Título da tarefa').disabled).toBe(true)
    expect(screen.getByLabelText<HTMLTextAreaElement>('Descrição').disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Status' }).disabled).toBe(true)
  })

  it('volta ao quadro', async () => {
    const { onBack, user } = setup()
    await user.click(await screen.findByRole('button', { name: /Voltar ao quadro/ }))
    expect(onBack).toHaveBeenCalled()
  })

  it('mostra erro curto quando a tarefa não carrega', async () => {
    const api = fakeApi()
    vi.spyOn(api.tasks, 'get').mockRejectedValue(new Error('x'))
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <UndoProvider>
            <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
          </UndoProvider>
        </QueryProvider>
      </ApiProvider>,
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})

describe('Card Prazo', () => {
  const cases: [Partial<ReturnType<typeof makeDetail>>, string][] = [
    [{ deadline: '2026-11-06' }, 'Em 5 dias'],
    [{ deadline: '2026-11-01' }, 'Vence hoje'],
    [{ deadline: '2026-11-02' }, 'Vence amanhã'],
    [{ deadline: '2026-10-29' }, 'Venceu há 3 dias'],
    [{ deadline: '2026-10-31' }, 'Venceu há 1 dia'],
    [{ deadline: null }, 'Sem prazo definido'],
    [{ status: 'done', deadline: '2026-10-01' }, 'Concluída'],
  ]
  it.each(cases)('mostra a frase de %j', async (overrides, text) => {
    setup({ detail: makeDetail(overrides) })
    expect((await screen.findByTestId('deadline-label')).textContent).toBe(text)
  })

  it('grava a data ao sair do campo e limpa o prazo', async () => {
    const { update, user } = setup()
    const field = await screen.findByLabelText('Data de entrega')
    await user.clear(field)
    await user.tab()
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ taskId: TASK_ID, changes: { deadline: null } }),
    )
  })
})

describe('Card Linha do tempo', () => {
  it('expande um grupo e conserva textos, horários e marca de gestor de cada alteração', async () => {
    const api = fakeApi()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail())
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.contributors, 'list').mockResolvedValue([])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([
      { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'manager', defaultRate: null },
    ])
    vi.spyOn(api.timeline, 'list').mockResolvedValue([
      makeEvent({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5E01',
        at: '2026-10-31T10:00:00Z',
        text: 'Primeira mudança',
        asManager: true,
      }),
      makeEvent({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5E02',
        at: '2026-10-31T12:00:00Z',
        text: 'Segunda mudança',
        asManager: true,
      }),
    ])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <UndoProvider>
            <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
          </UndoProvider>
        </QueryProvider>
      </ApiProvider>,
    )
    const summary = await screen.findByText(/Ana Souza moveu esta tarefa 2 vezes/)
    const details = summary.closest('details')!
    expect(details.open).toBe(false)
    await userEvent.click(summary)
    expect(details.open).toBe(true)
    expect(details.textContent).toContain('Primeira mudança')
    expect(details.textContent).toContain('Segunda mudança')
    expect(details.querySelectorAll('ol li')).toHaveLength(2)
    expect(details.querySelectorAll('ol li')[0]!.textContent).toContain('Gestor')
  })

  it('lista a mais recente no topo, marca Gestor e mostra o autor', async () => {
    const api = fakeApi()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail())
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.contributors, 'list').mockResolvedValue([])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([
      { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
    ])
    vi.spyOn(api.timeline, 'list').mockResolvedValue([
      makeEvent({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5E01',
        at: '2026-10-30T10:00:00.000Z',
        text: 'Antiga',
      }),
      makeEvent({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5E02',
        at: '2026-10-31T10:00:00.000Z',
        text: 'Recente',
        asManager: true,
      }),
    ])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <UndoProvider>
            <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
          </UndoProvider>
        </QueryProvider>
      </ApiProvider>,
    )
    await screen.findByText('Recente')
    const texts = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')
    const recent = texts.findIndex((text) => text.includes('Recente'))
    const old = texts.findIndex((text) => text.includes('Antiga'))
    expect(recent).toBeGreaterThanOrEqual(0)
    expect(recent).toBeLessThan(old)
    expect(texts[recent]).toContain('Gestor')
    expect(texts[recent]).toContain('Ana Souza')
    expect(texts[old]).not.toContain('Gestor')
  })

  it('mostra o estado vazio', async () => {
    setup()
    expect(await screen.findByText('Sem atualizações ainda.')).toBeTruthy()
  })
})

describe('Card Custo', () => {
  it('recalcula subtotal e total na hora, com vírgula decimal', async () => {
    const { user } = setup()
    const hours = await screen.findByLabelText('Horas de Ana Souza')
    expect(screen.getByLabelText('Total').textContent).toBe('R$ 100,00')
    await user.clear(hours)
    await user.type(hours, '3,5')
    expect(screen.getByLabelText('Total').textContent).toBe('R$ 140,00')
  })

  it('grava horas ao sair do campo como texto', async () => {
    const { api, user } = setup()
    const setHours = vi.spyOn(api.participations, 'setHours').mockResolvedValue(makeParticipation())
    const hours = await screen.findByLabelText('Horas de Ana Souza')
    await user.clear(hours)
    await user.type(hours, '3,5')
    await user.tab()
    await waitFor(() =>
      expect(setHours).toHaveBeenCalledWith({
        taskId: TASK_ID,
        participationId: makeParticipation().id,
        hours: '3,5',
      }),
    )
  })

  it('o valor/hora editado também atualiza o padrão do envolvido', async () => {
    const { api, user } = setup()
    const setRate = vi.spyOn(api.participations, 'setRate').mockResolvedValue(makeParticipation())
    const setDefault = vi.spyOn(api.users, 'setDefaultRate').mockResolvedValue({
      id: USER_ID,
      name: 'Ana',
      email: 'a@b.com',
      initials: 'A',
      role: 'collaborator',
      defaultRate: 50,
    })
    const rate = await screen.findByLabelText('Valor/hora de Ana Souza')
    await user.clear(rate)
    await user.type(rate, '50,50')
    await user.tab()
    await waitFor(() =>
      expect(setDefault).toHaveBeenCalledWith({ userId: USER_ID, rateCents: 5050 }),
    )
    expect(setRate).toHaveBeenCalledWith({
      taskId: TASK_ID,
      participationId: makeParticipation().id,
      rateCents: 5050,
    })
  })

  it('não mostra valores em R$ nem total quando o DTO vem com null', async () => {
    setup({
      detail: makeDetail({ total: null, participations: [makeParticipation({ rate: null })] }),
    })
    expect(await screen.findByLabelText('Horas de Ana Souza')).toBeTruthy()
    expect(screen.queryByLabelText('Total')).toBeNull()
    expect(screen.queryByLabelText('Valor/hora de Ana Souza')).toBeNull()
    expect(document.body.textContent).not.toMatch(/R\$/)
  })

  it('colaborador vê só o próprio valor e nenhum total', async () => {
    setup({
      detail: makeDetail({
        total: null,
        participations: [
          makeParticipation(),
          makeParticipation({
            id: '01J8Y4G2XK8Z1S6M3Q9W0A5P02',
            participantName: 'Bruno Lima',
            role: 'support',
            rate: null,
            participant: { kind: 'user', userId: '01J8Y4G2XK8Z1S6M3Q9W0A5V02' },
          }),
        ],
      }),
    })
    expect(await screen.findByLabelText('Valor/hora de Ana Souza')).toBeTruthy()
    expect(screen.queryByLabelText('Valor/hora de Bruno Lima')).toBeNull()
    expect(screen.queryByLabelText('Total')).toBeNull()
  })
})

describe('Card Custo com o próprio valor/hora', () => {
  it('colaborador com o próprio valor/hora e total nulo mostra o valor e esconde o total', async () => {
    setup({ detail: makeDetail({ total: null }) })
    expect(await screen.findByLabelText('Valor/hora de Ana Souza')).toHaveValue('40,00')
    expect(screen.queryByLabelText('Total')).toBeNull()
    // A linha mostra o próprio subtotal (2,5 h × R$ 40,00), sem total do cartão.
    const line = screen.getByLabelText('Valor/hora de Ana Souza').closest('li')
    expect(line?.textContent).toContain('R$\u00a0100,00')
  })

  it('sem a estimativa, o total usa as horas gravadas mesmo com rascunho digitado', async () => {
    const api = fakeApi()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail())
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.timeline, 'list').mockResolvedValue([])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
    vi.spyOn(api.contributors, 'list').mockResolvedValue([])
    // Cliente próprio, para poder pedir de novo o nível do time depois de digitar.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <UndoProvider>
            <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
          </UndoProvider>
        </QueryClientProvider>
      </ApiProvider>,
    )
    const user = userEvent.setup()
    const hours = await screen.findByLabelText('Horas de Ana Souza')
    await user.clear(hours)
    await user.type(hours, '3,5')
    expect(screen.getByLabelText('Total').textContent).toBe('R$\u00a0140,00')

    // O time desliga a estimativa enquanto o rascunho ainda está na tela.
    allowTeam(
      api,
      'advanced',
      TEAM_MODULE_IDS.filter((id) => id !== 'estimates.hours'),
    )
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamModules.capabilities })
    })

    await waitFor(() => expect(screen.queryByLabelText('Horas de Ana Souza')).toBeNull())
    expect(screen.getByLabelText('Total').textContent).toBe('R$\u00a0100,00')
  })
})

describe('Card Envolvidos', () => {
  it('remove um envolvido', async () => {
    const { api, user } = setup()
    const remove = vi.spyOn(api.participations, 'remove').mockResolvedValue(undefined)
    await user.click(await screen.findByRole('button', { name: 'Remover Ana Souza' }))
    expect(remove).toHaveBeenCalledWith({
      taskId: TASK_ID,
      participationId: makeParticipation().id,
    })
  })

  it('adiciona uma entidade como Apoio e permite criar entidade', async () => {
    const api = fakeApi()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail())
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.timeline, 'list').mockResolvedValue([])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
    vi.spyOn(api.contributors, 'list').mockResolvedValue([
      { id: '01J8Y4G2XK8Z1S6M3Q9W0A5C01', name: 'Fornecedor X', defaultRate: null },
    ])
    const add = vi.spyOn(api.participations, 'add').mockResolvedValue(makeParticipation())
    const create = vi
      .spyOn(api.contributors, 'create')
      .mockResolvedValue({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5C02', name: 'Nova', defaultRate: null })
    const user = userEvent.setup()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <UndoProvider>
            <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
          </UndoProvider>
        </QueryProvider>
      </ApiProvider>,
    )
    await screen.findByRole('option', { name: 'Fornecedor X' })
    await user.selectOptions(screen.getByLabelText('Pessoa ou entidade'), 'Fornecedor X')
    expect(screen.getByRole<HTMLOptionElement>('option', { name: 'Responsável' }).disabled).toBe(
      true,
    )
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        taskId: TASK_ID,
        participant: { kind: 'contributor', contributorId: '01J8Y4G2XK8Z1S6M3Q9W0A5C01' },
        role: 'support',
      }),
    )
    await user.type(screen.getByLabelText('Nome da nova entidade'), 'Nova')
    await user.click(screen.getByRole('button', { name: 'Criar entidade' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Nova' }))
  })

  it('esconde adicionar e remover no modo somente leitura', async () => {
    setup({ detail: makeDetail({ canEdit: false, readOnly: true }) })
    await screen.findByText('Somente leitura')
    expect(screen.queryByRole('button', { name: 'Remover Ana Souza' })).toBeNull()
    expect(screen.queryByLabelText('Pessoa ou entidade')).toBeNull()
  })
})

describe('Campos por nível (M2.11)', () => {
  function renderAt(
    level: Level,
    options: {
      active?: readonly string[]
      detail?: ReturnType<typeof makeDetail>
      teamFails?: boolean
    } = {},
  ) {
    const api = fakeApi(level, options.active)
    const detail = options.detail ?? makeDetail()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(detail)
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.timeline, 'list').mockResolvedValue([makeEvent()])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
    vi.spyOn(api.contributors, 'list').mockResolvedValue([])
    const update = vi.spyOn(api.tasks, 'update').mockResolvedValue(detail)
    const setRate = vi.spyOn(api.participations, 'setRate').mockResolvedValue(makeParticipation())
    const setHours = vi.spyOn(api.participations, 'setHours').mockResolvedValue(makeParticipation())
    const teamGet = vi.spyOn(api.teamModules, 'get')
    if (options.teamFails) teamGet.mockRejectedValue(new Error('x'))
    const view = render(
      <ApiProvider api={api}>
        <QueryProvider>
          <UndoProvider>
            <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
          </UndoProvider>
        </QueryProvider>
      </ApiProvider>,
    )
    return { ...view, user: userEvent.setup(), update, setRate, setHours, teamGet }
  }

  it('Essencial mostra só título, estado e prazo', async () => {
    renderAt('basic')
    expect(await screen.findByDisplayValue('Revisar integração')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByLabelText('Data de entrega')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Responsável' })).toBeNull()
    expect(screen.queryByLabelText('Pessoa ou entidade')).toBeNull()
    expect(screen.queryByLabelText('Horas de Ana Souza')).toBeNull()
    expect(screen.queryByLabelText('Valor/hora de Ana Souza')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Atividade' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Campos avançados' })).toBeNull()
  })

  it('Padrão mostra responsáveis, estimativa e atividade', async () => {
    renderAt('intermediate')
    expect(await screen.findByRole('group', { name: 'Responsável' })).toHaveTextContent('Ana Souza')
    expect(screen.getByLabelText('Pessoa ou entidade')).toBeVisible()
    expect(screen.getByLabelText('Horas de Ana Souza')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Atividade' })).toBeVisible()
  })

  it('Padrão recolhe o valor/hora em Campos avançados, fechado por padrão', async () => {
    renderAt('intermediate')
    const toggle = await screen.findByRole('button', { name: 'Campos avançados' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(region).not.toBeNull()
    expect(region).not.toBeVisible()
    expect(screen.getByLabelText('Valor/hora de Ana Souza')).not.toBeVisible()
  })

  it('Campos avançados abre e fecha pelo próprio botão', async () => {
    const { user } = renderAt('intermediate')
    const toggle = await screen.findByRole('button', { name: 'Campos avançados' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Valor/hora de Ana Souza')).toBeVisible()
    expect(screen.getByLabelText('Total')).toHaveTextContent('R$ 100,00')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Valor/hora de Ana Souza')).not.toBeVisible()
  })

  it('Avançado mostra valor/hora e total sempre, sem botão de recolher', async () => {
    renderAt('advanced')
    expect(await screen.findByLabelText('Valor/hora de Ana Souza')).toBeVisible()
    expect(screen.getByLabelText('Total')).toHaveTextContent('R$ 100,00')
    expect(screen.queryByRole('button', { name: 'Campos avançados' })).toBeNull()
  })

  it('esconde a estimativa sem o módulo estimates.hours, em Padrão e em Avançado', async () => {
    const active = TEAM_MODULE_IDS.filter((id) => id !== 'estimates.hours')
    const low = renderAt('intermediate', { active })
    expect(await screen.findByRole('group', { name: 'Responsável' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Horas de Ana Souza')).toBeNull()
    low.unmount()
    renderAt('advanced', { active })
    expect(await screen.findByLabelText('Valor/hora de Ana Souza')).toBeVisible()
    expect(screen.queryByLabelText('Horas de Ana Souza')).toBeNull()
  })

  it('valor/hora e total não aparecem sem permissão, nem recolhidos', async () => {
    const { user } = renderAt('intermediate', {
      detail: makeDetail({
        total: null,
        participations: [makeParticipation({ rate: null })],
      }),
    })
    await user.click(await screen.findByRole('button', { name: 'Campos avançados' }))
    expect(screen.queryByLabelText('Valor/hora de Ana Souza')).toBeNull()
    expect(screen.queryByLabelText('Total')).toBeNull()
    expect(document.body.textContent).not.toMatch(/R\$/)
  })

  it('subir de nível não perde dado: valor, horas e total voltam como estavam', async () => {
    const low = renderAt('basic')
    expect(await screen.findByDisplayValue('Revisar integração')).toBeInTheDocument()
    low.unmount()
    const high = renderAt('advanced')
    expect(await screen.findByLabelText('Valor/hora de Ana Souza')).toHaveValue('40,00')
    expect(screen.getByLabelText('Horas de Ana Souza')).toHaveValue('2,5')
    expect(screen.getByLabelText('Total')).toHaveTextContent('R$ 100,00')
    expect(high.update).not.toHaveBeenCalled()
    expect(high.setRate).not.toHaveBeenCalled()
    expect(high.setHours).not.toHaveBeenCalled()
  })

  it('se o time não carrega, pede o nível, recebe a rejeição e mostra só o Essencial', async () => {
    const { teamGet } = renderAt('advanced', { teamFails: true })
    expect(await screen.findByDisplayValue('Revisar integração')).toBeInTheDocument()
    await waitFor(() => expect(teamGet).toHaveBeenCalledTimes(1))
    await expect(teamGet.mock.results[0]!.value).rejects.toThrow('x')
    expect(screen.queryByRole('group', { name: 'Responsável' })).toBeNull()
    expect(screen.queryByLabelText('Valor/hora de Ana Souza')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Campos avançados' })).toBeNull()
  })
})

describe('Critérios e estimativa no detalhe (M3.13)', () => {
  const withoutModule = (module: string) => TEAM_MODULE_IDS.filter((id) => id !== module)

  it('Avançado com Aceite ligado mostra os critérios, sempre visíveis', async () => {
    setup()
    expect(await screen.findByRole('region', { name: 'Critérios de aceite' })).toBeTruthy()
  })

  it('Padrão não mostra os critérios', async () => {
    setup({ level: 'intermediate' })
    await screen.findByDisplayValue('Revisar integração')
    expect(screen.queryByRole('region', { name: 'Critérios de aceite' })).toBeNull()
  })

  it('sem o módulo Aceite, o Avançado também não mostra os critérios', async () => {
    setup({ active: withoutModule('acceptance') })
    await screen.findByDisplayValue('Revisar integração')
    expect(screen.queryByRole('region', { name: 'Critérios de aceite' })).toBeNull()
  })

  it('carrega e mostra os critérios da tarefa com a contagem', async () => {
    const { api } = setup()
    vi.spyOn(api.acceptance, 'list').mockResolvedValue(
      makeCriteriaView([
        makeCriterion({ done: true }),
        makeCriterion({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5K02', text: 'Segundo' }),
      ]),
    )
    expect(await screen.findByText('1/2')).toBeTruthy()
    expect(screen.getByDisplayValue('Segundo')).toBeTruthy()
  })

  it('Padrão e Avançado mostram Estimativa (h); o bloco do realizado se chama Realizado', async () => {
    setup({ level: 'intermediate' })
    expect(await screen.findByLabelText('Estimativa (h)')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Realizado' })).toBeTruthy()
    expect(screen.queryByText('Estimativa de horas')).toBeNull()
  })

  it('sem o módulo estimates.hours, não há campo de estimativa', async () => {
    setup({ active: withoutModule('estimates.hours') })
    await screen.findByDisplayValue('Revisar integração')
    expect(screen.queryByLabelText('Estimativa (h)')).toBeNull()
  })

  it('mostra o custo realizado que o DTO traz e nada quando vem nulo', async () => {
    setup({ detail: makeDetail({ realizedCost: 100 }) })
    expect((await screen.findByLabelText('Custo realizado')).textContent).toBe('R$\u00a0100,00')
  })

  it('custo realizado nulo não aparece', async () => {
    setup({ detail: makeDetail({ realizedCost: null }) })
    await screen.findByDisplayValue('Revisar integração')
    expect(screen.queryByLabelText('Custo realizado')).toBeNull()
  })

  it('gravar a estimativa não muda as horas realizadas por participação', async () => {
    const { api, user } = setup({ detail: makeDetail({ estimatedHours: 4 }) })
    const set = vi.spyOn(api.estimates, 'set').mockResolvedValue(makeDetail({ estimatedHours: 3 }))
    const field = await screen.findByLabelText('Estimativa (h)')
    expect(field).toHaveValue('4')
    await user.clear(field)
    await user.type(field, '3')
    await user.tab()
    await waitFor(() => expect(set).toHaveBeenCalledWith({ taskId: TASK_ID, estimatedHours: 3 }))
    expect(screen.getByLabelText('Horas de Ana Souza')).toHaveValue('2,5')
  })

  it('a linha do tempo mostra o evento de critério com a marca Gestor', async () => {
    const { api } = setup()
    vi.spyOn(api.timeline, 'list').mockResolvedValue([
      makeEvent({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5E09',
        type: 'criterion_added',
        asManager: true,
        text: 'Critério “Revisar logs” adicionado',
      }),
    ])
    expect(await screen.findByText('Critério “Revisar logs” adicionado')).toBeTruthy()
    expect(screen.getByText('Gestor')).toBeTruthy()
  })
})
