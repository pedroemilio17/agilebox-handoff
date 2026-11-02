import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDateOnly } from '@agilebox/core'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { makeDetail, makeEvent, makeParticipation, TASK_ID, USER_ID } from './fixtures'
import { TaskDetailView } from './TaskDetailView'

afterEach(cleanup)

function setup(overrides: { detail?: ReturnType<typeof makeDetail> } = {}) {
  const api = createFakeApi()
  const detail = overrides.detail ?? makeDetail()
  vi.spyOn(api.tasks, 'get').mockResolvedValue(detail)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  const update = vi.spyOn(api.tasks, 'update').mockResolvedValue(detail)
  const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(detail)
  const onBack = vi.fn()
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <TaskDetailView taskId={TASK_ID} onBack={onBack} today={parseDateOnly('2026-11-01')} />
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
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'get').mockRejectedValue(new Error('x'))
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
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
    const api = createFakeApi()
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
          <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
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
    const api = createFakeApi()
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
          <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
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
    const api = createFakeApi()
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
          <TaskDetailView taskId={TASK_ID} onBack={() => undefined} />
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
