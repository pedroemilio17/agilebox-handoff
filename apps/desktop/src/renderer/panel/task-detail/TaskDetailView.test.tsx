import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDateOnly } from '@agilebox/core'
import type { GetTaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import {
  CONTRIBUTOR_ID,
  makeChecklistItem,
  makeComment,
  makeDetail,
  makeEvent,
  makeParticipation,
  OTHER_USER_ID,
  TASK_ID,
  USER_ID,
} from './fixtures'
import { TaskDetailView } from './TaskDetailView'

afterEach(cleanup)

function setup(
  overrides: {
    detail?: ReturnType<typeof makeDetail>
    timeline?: ReturnType<typeof makeEvent>[]
  } = {},
) {
  const api = createFakeApi()
  const detail = overrides.detail ?? makeDetail()
  vi.spyOn(api.tasks, 'get').mockResolvedValue(detail)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue(overrides.timeline ?? [])
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

  it('mostra o ID no cabeçalho e copia pelo botão com aviso', async () => {
    const { user } = setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    expect(await screen.findByText('AB-118')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Copiar ID AB-118' }))
    expect(writeText).toHaveBeenCalledWith('AB-118')
    expect(await screen.findByText('ID copiado')).toBeTruthy()
  })

  it('avisa quando a área de transferência não está disponível', async () => {
    const { user } = setup()
    const writeText = vi.fn().mockRejectedValue(new Error('negado'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.click(await screen.findByRole('button', { name: 'Copiar ID AB-118' }))
    expect(await screen.findByText('Não foi possível copiar o ID.')).toBeTruthy()
  })
})

describe('Prioridade no detalhe', () => {
  it('mostra a prioridade atual e salva a troca na hora pela API', async () => {
    const { update, user } = setup()
    const select = await screen.findByLabelText<HTMLSelectElement>('Nível de prioridade')
    expect(select.value).toBe('normal')
    await user.selectOptions(select, 'Alta')
    expect(update).toHaveBeenCalledWith({ taskId: TASK_ID, changes: { priority: 'high' } })
  })

  it('desabilita a prioridade para quem não pode editar', async () => {
    setup({ detail: makeDetail({ canEdit: false, readOnly: true, priority: 'high' }) })
    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(screen.getByLabelText<HTMLSelectElement>('Nível de prioridade').disabled).toBe(true)
  })

  it('mostra o evento de prioridade na linha do tempo com a frase do servidor', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail({ priority: 'high' }))
    vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
    vi.spyOn(api.contributors, 'list').mockResolvedValue([])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([
      { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'manager', defaultRate: null },
    ])
    vi.spyOn(api.timeline, 'list').mockResolvedValue([
      makeEvent({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5E07',
        type: 'priority_changed',
        text: 'alterou a prioridade de Normal para Alta',
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
    expect(await screen.findByText('alterou a prioridade de Normal para Alta')).toBeTruthy()
    expect(screen.getByText('Gestor')).toBeTruthy()
  })
})

describe('Bloqueio no detalhe', () => {
  const REASON = 'Aguardando credenciais do ambiente'

  it('valida o motivo vazio e não chama a API', async () => {
    const { api, user } = setup()
    const block = vi.spyOn(api.tasks, 'block')
    await user.click(await screen.findByRole('button', { name: 'Bloquear' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Informe o motivo do bloqueio.')).toBeTruthy()
    expect(block).not.toHaveBeenCalled()
  })

  it('mostra o contador e recusa motivo com 281 caracteres', async () => {
    const { api, user } = setup()
    const block = vi.spyOn(api.tasks, 'block')
    await user.click(await screen.findByRole('button', { name: 'Bloquear' }))
    fireEvent.change(screen.getByLabelText('Motivo do bloqueio'), {
      target: { value: 'a'.repeat(281) },
    })
    expect(screen.getByText('281/280')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByText('O motivo deve ter até 280 caracteres.')).toBeTruthy()
    expect(block).not.toHaveBeenCalled()
  })

  it('bloqueia com o motivo pela API e fecha o formulário', async () => {
    const { api, user } = setup()
    const blocked = makeDetail({ blockedReason: REASON, blockedAt: '2026-11-01T12:00:00Z' })
    const block = vi.spyOn(api.tasks, 'block').mockResolvedValue(blocked)
    // Depois de gravar, a busca do detalhe volta com a tarefa já bloqueada.
    vi.spyOn(api.tasks, 'get').mockResolvedValue(blocked)
    await user.click(await screen.findByRole('button', { name: 'Bloquear' }))
    await user.type(screen.getByLabelText('Motivo do bloqueio'), REASON)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(block).toHaveBeenCalledWith({ taskId: TASK_ID, reason: REASON })
    expect(await screen.findByText(REASON)).toBeTruthy()
    expect(screen.queryByLabelText('Motivo do bloqueio')).toBeNull()
  })

  it('mostra a faixa com o motivo e desbloqueia pela API', async () => {
    const { api, user } = setup({
      detail: makeDetail({ blockedReason: REASON, blockedAt: '2026-11-01T12:00:00Z' }),
    })
    const unblock = vi.spyOn(api.tasks, 'unblock').mockResolvedValue(makeDetail())
    expect(await screen.findByRole('region', { name: 'Bloqueio' })).toBeTruthy()
    expect(screen.getByText(REASON)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    expect(unblock).toHaveBeenCalledWith({ taskId: TASK_ID })
  })

  it('desabilita bloquear e desbloquear para somente leitura', async () => {
    setup({ detail: makeDetail({ canEdit: false, readOnly: true }) })
    expect((await screen.findByRole('button', { name: 'Bloquear' })).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('desabilita desbloquear para somente leitura', async () => {
    setup({
      detail: makeDetail({
        canEdit: false,
        readOnly: true,
        blockedReason: REASON,
        blockedAt: '2026-11-01T12:00:00Z',
      }),
    })
    expect(
      (await screen.findByRole('button', { name: 'Desbloquear' })).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('tarefa concluída não oferece bloquear', async () => {
    setup({ detail: makeDetail({ status: 'done' }) })
    expect(await screen.findByDisplayValue('Revisar integração')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bloquear' })).toBeNull()
  })

  it('mostra os eventos de bloqueio na linha do tempo com a frase do servidor', async () => {
    setup({
      timeline: [
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E08',
          type: 'blocked',
          text: 'bloqueou a tarefa: Aguardando credenciais',
        }),
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E09',
          type: 'unblocked',
          text: 'desbloqueou a tarefa',
        }),
      ],
    })
    expect(await screen.findByText('bloqueou a tarefa: Aguardando credenciais')).toBeTruthy()
    expect(screen.getByText('desbloqueou a tarefa')).toBeTruthy()
  })
})

describe('Subtarefas no detalhe', () => {
  const ITEMS = [
    makeChecklistItem({
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5K01',
      title: 'Mapear campos',
      done: true,
      position: 0,
    }),
    makeChecklistItem({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5K02', title: 'Criar endpoint', position: 1 }),
    makeChecklistItem({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5K03', title: 'Tratar timeout', position: 2 }),
  ]
  const WITH_ITEMS = () =>
    makeDetail({
      checklist: ITEMS,
      checklistProgress: { done: 1, total: 3, percent: 33 },
    })

  it('mostra cabeçalho com contagem, barra de progresso e os itens', async () => {
    setup({ detail: WITH_ITEMS() })
    const section = await screen.findByRole('region', { name: 'Subtarefas' })
    expect(section.textContent).toContain('1/3')
    expect(
      screen
        .getByRole('progressbar', { name: 'Progresso das subtarefas' })
        .getAttribute('aria-valuetext'),
    ).toBe('1 de 3')
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Concluir subtarefa Mapear campos' }),
    ).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', {
        name: 'Concluir subtarefa Mapear campos',
      }).checked,
    ).toBe(true)
  })

  it('mostra o estado vazio sem barra de progresso', async () => {
    setup()
    expect(await screen.findByText('Nenhuma subtarefa ainda.')).toBeTruthy()
    expect(screen.queryByRole('progressbar', { name: 'Progresso das subtarefas' })).toBeNull()
  })

  it('adiciona pelo Enter, limpa o campo e mantém o foco nele', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const add = vi.spyOn(api.tasks.checklist, 'add').mockResolvedValue(WITH_ITEMS())
    const field = await screen.findByLabelText<HTMLInputElement>('Adicionar subtarefa')
    await user.click(field)
    await user.type(field, '  Testar em homologação  {Enter}')
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ taskId: TASK_ID, title: 'Testar em homologação' }),
    )
    await waitFor(() => expect(field.value).toBe(''))
    expect(document.activeElement).toBe(field)
  })

  it('não adiciona título vazio nem com 201 caracteres', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const add = vi.spyOn(api.tasks.checklist, 'add')
    const field = await screen.findByLabelText<HTMLInputElement>('Adicionar subtarefa')
    await user.type(field, '   {Enter}')
    expect(screen.getByText('Informe o título da subtarefa.')).toBeTruthy()
    fireEvent.change(field, { target: { value: 'a'.repeat(201) } })
    await user.type(field, '{Enter}')
    expect(screen.getByText('A subtarefa deve ter até 200 caracteres.')).toBeTruthy()
    expect(add).not.toHaveBeenCalled()
  })

  it('marca e desmarca com atualização otimista, sem esperar o servidor', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    let resolve: (value: GetTaskDto) => void = () => undefined
    const toggle = vi
      .spyOn(api.tasks.checklist, 'toggle')
      .mockImplementation(() => new Promise<GetTaskDto>((done) => (resolve = done)))
    await user.click(
      await screen.findByRole('checkbox', { name: 'Concluir subtarefa Criar endpoint' }),
    )
    expect(toggle).toHaveBeenCalledWith({
      taskId: TASK_ID,
      itemId: '01J8Y4G2XK8Z1S6M3Q9W0A5K02',
      done: true,
    })
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Concluir subtarefa Criar endpoint' }),
    ).toHaveProperty('checked', true)
    expect(screen.getByRole('region', { name: 'Subtarefas' }).textContent).toContain('2/3')
    resolve(WITH_ITEMS())
  })

  it('volta a marcação e avisa com toast quando o servidor recusa', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    vi.spyOn(api.tasks.checklist, 'toggle').mockRejectedValue(new Error('x'))
    await user.click(
      await screen.findByRole('checkbox', { name: 'Concluir subtarefa Criar endpoint' }),
    )
    expect(await screen.findByText('Não foi possível salvar a subtarefa.')).toBeTruthy()
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('checkbox', {
          name: 'Concluir subtarefa Criar endpoint',
        }).checked,
      ).toBe(false),
    )
  })

  it('renomeia ao clicar no título e salva com Enter', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const rename = vi.spyOn(api.tasks.checklist, 'rename').mockResolvedValue(WITH_ITEMS())
    await user.click(
      await screen.findByRole('button', { name: 'Renomear subtarefa Criar endpoint' }),
    )
    const input = screen.getByRole('textbox', { name: 'Título da subtarefa' })
    await user.clear(input)
    await user.type(input, 'Criar endpoint do webhook{Enter}')
    expect(rename).toHaveBeenCalledWith({
      taskId: TASK_ID,
      itemId: '01J8Y4G2XK8Z1S6M3Q9W0A5K02',
      title: 'Criar endpoint do webhook',
    })
    expect(screen.queryByRole('textbox', { name: 'Título da subtarefa' })).toBeNull()
  })

  it('Esc cancela a renomeação sem chamar a API', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const rename = vi.spyOn(api.tasks.checklist, 'rename')
    await user.click(
      await screen.findByRole('button', { name: 'Renomear subtarefa Criar endpoint' }),
    )
    await user.type(screen.getByRole('textbox', { name: 'Título da subtarefa' }), ' extra{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Título da subtarefa' })).toBeNull()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Renomear subtarefa Criar endpoint' }),
    ).toBeTruthy()
    expect(rename).not.toHaveBeenCalled()
  })

  it('recusa renomear para vazio ou com 201 caracteres', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const rename = vi.spyOn(api.tasks.checklist, 'rename')
    await user.click(
      await screen.findByRole('button', { name: 'Renomear subtarefa Criar endpoint' }),
    )
    const input = screen.getByRole('textbox', { name: 'Título da subtarefa' })
    await user.clear(input)
    await user.type(input, '{Enter}')
    expect(screen.getByText('Informe o título da subtarefa.')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'b'.repeat(201) } })
    await user.type(input, '{Enter}')
    expect(screen.getByText('A subtarefa deve ter até 200 caracteres.')).toBeTruthy()
    expect(rename).not.toHaveBeenCalled()
  })

  it('remove pelo botão com o título no nome acessível', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const remove = vi.spyOn(api.tasks.checklist, 'remove').mockResolvedValue(WITH_ITEMS())
    await user.click(
      await screen.findByRole('button', { name: 'Remover subtarefa Tratar timeout' }),
    )
    expect(remove).toHaveBeenCalledWith({ taskId: TASK_ID, itemId: '01J8Y4G2XK8Z1S6M3Q9W0A5K03' })
  })

  it('move para baixo e desabilita mover para cima no primeiro item', async () => {
    const { api, user } = setup({ detail: WITH_ITEMS() })
    const move = vi.spyOn(api.tasks.checklist, 'move').mockResolvedValue(WITH_ITEMS())
    expect(
      (await screen.findByRole('button', { name: 'Mover Mapear campos para cima' })).hasAttribute(
        'disabled',
      ),
    ).toBe(true)
    await user.click(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Mover Criar endpoint para baixo' }),
    )
    expect(move).toHaveBeenCalledWith({
      taskId: TASK_ID,
      itemId: '01J8Y4G2XK8Z1S6M3Q9W0A5K02',
      position: 2,
    })
  })

  it('somente leitura desabilita marcar, editar, mover, remover e adicionar', async () => {
    setup({ detail: { ...WITH_ITEMS(), canEdit: false, readOnly: true } })
    expect(
      await screen.findByText('Somente leitura: você não pode alterar estas subtarefas.'),
    ).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', {
        name: 'Concluir subtarefa Criar endpoint',
      }).disabled,
    ).toBe(true)
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Renomear subtarefa Criar endpoint',
      }).disabled,
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Remover subtarefa Criar endpoint' })).toBeNull()
    expect(screen.getByLabelText<HTMLInputElement>('Adicionar subtarefa').disabled).toBe(true)
  })

  it('tarefa concluída não mostra campo de adicionar', async () => {
    setup({ detail: { ...WITH_ITEMS(), status: 'done' } })
    expect(await screen.findByText('Tarefas concluídas não aceitam novas subtarefas.')).toBeTruthy()
    expect(screen.queryByLabelText('Adicionar subtarefa')).toBeNull()
  })

  it('ao atingir 50 itens mostra o limite no lugar do campo', async () => {
    const fifty = Array.from({ length: 50 }, (_, index) =>
      makeChecklistItem({
        id: `01J8Y4G2XK8Z1S6M3Q9W0B${String(index).padStart(3, '0')}`,
        title: `Item ${index + 1}`,
        position: index,
      }),
    )
    setup({
      detail: makeDetail({
        checklist: fifty,
        checklistProgress: { done: 0, total: 50, percent: 0 },
      }),
    })
    expect(await screen.findByText('Limite de 50 subtarefas.')).toBeTruthy()
    expect(screen.queryByLabelText('Adicionar subtarefa')).toBeNull()
  })

  it('mostra os quatro eventos de subtarefa na linha do tempo com a frase do servidor', async () => {
    setup({
      timeline: [
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E21',
          type: 'checklist_item_added',
          text: 'adicionou a subtarefa: Mapear campos',
        }),
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E22',
          type: 'checklist_item_done',
          text: 'concluiu a subtarefa: Mapear campos',
        }),
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E23',
          type: 'checklist_item_reopened',
          text: 'reabriu a subtarefa: Mapear campos',
        }),
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E24',
          type: 'checklist_item_removed',
          text: 'removeu a subtarefa: Mapear campos',
        }),
      ],
    })
    expect(await screen.findByText('adicionou a subtarefa: Mapear campos')).toBeTruthy()
    expect(screen.getByText('concluiu a subtarefa: Mapear campos')).toBeTruthy()
    expect(screen.getByText('reabriu a subtarefa: Mapear campos')).toBeTruthy()
    expect(screen.getByText('removeu a subtarefa: Mapear campos')).toBeTruthy()
  })
})

describe('Comentários no detalhe', () => {
  const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
  const COMMENT_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5M01'
  const ALL_COMMENTS = [
    makeComment({
      id: COMMENT_ID,
      authorName: 'Ana Souza',
      body: 'Oi @Ana Souza, o acesso saiu',
      mentions: [{ id: ANA, name: 'Ana Souza' }],
    }),
    makeComment({
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5M02',
      authorName: 'Pedro Gestor',
      asManager: true,
      body: 'Ajustei o prazo',
      editedAt: '2026-10-31T13:00:00.000Z',
      canEdit: false,
      canRemove: false,
    }),
  ]
  const WITH_COMMENTS = () => makeDetail({ comments: ALL_COMMENTS, commentCount: 2 })

  it('lista em ordem com selo Gestor, menção destacada e (editado)', async () => {
    setup({ detail: WITH_COMMENTS() })
    const section = await screen.findByRole('region', { name: 'Comentários' })
    expect(section.textContent).toContain('2')
    const mark = screen.getByRole('mark', { name: '@Ana Souza' })
    expect(mark.textContent).toBe('@Ana Souza')
    expect(mark.getAttribute('title')).toBe('Ana Souza')
    expect(screen.getByText('Gestor')).toBeTruthy()
    expect(screen.getByText('(editado)')).toBeTruthy()
  })

  it('mostra o estado vazio sem comentários', async () => {
    setup()
    expect(await screen.findByText('Nenhum comentário ainda.')).toBeTruthy()
  })

  it('oculta editar e remover quando não há permissão', async () => {
    setup({ detail: WITH_COMMENTS() })
    await screen.findByRole('region', { name: 'Comentários' })
    expect(screen.queryByRole('button', { name: 'Editar comentário de Pedro Gestor' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remover comentário de Pedro Gestor' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar comentário de Ana Souza' })).toBeTruthy()
  })

  it('no somente leitura, esconde o campo e mostra a dica', async () => {
    setup({
      detail: makeDetail({ comments: ALL_COMMENTS, canEdit: false, readOnly: true }),
    })
    expect(
      await screen.findByText('Somente leitura: você não pode comentar nesta tarefa.'),
    ).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Escrever comentário' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar comentário de Ana Souza' })).toBeNull()
  })

  it('adiciona o comentário, sem espaços das pontas, e limpa o campo', async () => {
    const { api, user } = setup()
    const add = vi.spyOn(api.tasks.comments, 'add').mockResolvedValue(ALL_COMMENTS[0]!)
    const field = await screen.findByLabelText<HTMLTextAreaElement>('Escrever comentário')
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Comentar' })
    expect(button.disabled).toBe(true)
    await user.type(field, '  Já testei  ')
    expect(button.disabled).toBe(false)
    await user.click(button)
    await waitFor(() => expect(add).toHaveBeenCalledWith({ taskId: TASK_ID, body: 'Já testei' }))
    await waitFor(() => expect(field.value).toBe(''))
  })

  it('envia com Ctrl+Enter', async () => {
    const { api, user } = setup()
    const add = vi.spyOn(api.tasks.comments, 'add').mockResolvedValue(ALL_COMMENTS[0]!)
    const field = await screen.findByLabelText('Escrever comentário')
    await user.type(field, 'Segue{Control>}{Enter}{/Control}')
    await waitFor(() => expect(add).toHaveBeenCalledWith({ taskId: TASK_ID, body: 'Segue' }))
  })

  it('não envia só espaços nem acima de 2000 caracteres', async () => {
    const { api, user } = setup()
    const add = vi.spyOn(api.tasks.comments, 'add')
    const field = await screen.findByLabelText<HTMLTextAreaElement>('Escrever comentário')
    await user.type(field, '   ')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Comentar' }).disabled).toBe(true)
    fireEvent.change(field, { target: { value: 'a'.repeat(2001) } })
    expect(screen.getByText('2001/2000')).toBeTruthy()
    expect(screen.getByText('O comentário deve ter até 2000 caracteres.')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Comentar' }).disabled).toBe(true)
    expect(add).not.toHaveBeenCalled()
  })

  it('sugere só participantes-usuários ao digitar @ e insere o nome completo', async () => {
    const participants = [
      makeParticipation(),
      makeParticipation({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5P02',
        participant: { kind: 'user', userId: OTHER_USER_ID },
        participantName: 'Bruno Lima',
        role: 'support',
      }),
      makeParticipation({
        id: '01J8Y4G2XK8Z1S6M3Q9W0A5P03',
        participant: { kind: 'contributor', contributorId: CONTRIBUTOR_ID },
        participantName: 'Carlos Entidade',
        role: 'support',
      }),
    ]
    const { user } = setup({ detail: makeDetail({ participations: participants }) })
    const field = await screen.findByLabelText<HTMLTextAreaElement>('Escrever comentário')
    await user.type(field, 'oi @')
    const list = screen.getByRole('listbox', { name: 'Pessoas para mencionar' })
    const options = within(list).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Ana Souza', 'Bruno Lima'])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(field.value).toBe('oi @Bruno Lima ')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('fecha as sugestões com Esc sem perder o texto', async () => {
    const { user } = setup()
    const field = await screen.findByLabelText<HTMLTextAreaElement>('Escrever comentário')
    await user.type(field, '@An')
    expect(screen.getByRole('option', { name: 'Ana Souza' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(field.value).toBe('@An')
  })

  it('edita no lugar e salva pela API', async () => {
    const { api, user } = setup({ detail: WITH_COMMENTS() })
    const edit = vi.spyOn(api.tasks.comments, 'edit').mockResolvedValue(ALL_COMMENTS[0]!)
    await user.click(await screen.findByRole('button', { name: 'Editar comentário de Ana Souza' }))
    const field = screen.getByLabelText<HTMLTextAreaElement>('Editar comentário')
    expect(field.value).toBe('Oi @Ana Souza, o acesso saiu')
    await user.clear(field)
    await user.type(field, 'Acesso voltou')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(edit).toHaveBeenCalledWith({
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      body: 'Acesso voltou',
    })
  })

  it('Esc cancela a edição sem chamar a API', async () => {
    const { api, user } = setup({ detail: WITH_COMMENTS() })
    const edit = vi.spyOn(api.tasks.comments, 'edit')
    await user.click(await screen.findByRole('button', { name: 'Editar comentário de Ana Souza' }))
    const field = screen.getByLabelText('Editar comentário')
    await user.type(field, ' extra{Escape}')
    expect(screen.queryByLabelText('Editar comentário')).toBeNull()
    expect(screen.getByRole('region', { name: 'Comentários' }).textContent).toContain(
      'o acesso saiu',
    )
    expect(edit).not.toHaveBeenCalled()
  })

  it('valida a edição entre 1 e 2000 caracteres', async () => {
    const { api, user } = setup({ detail: WITH_COMMENTS() })
    const edit = vi.spyOn(api.tasks.comments, 'edit')
    await user.click(await screen.findByRole('button', { name: 'Editar comentário de Ana Souza' }))
    const field = screen.getByLabelText('Editar comentário')
    await user.clear(field)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Escreva um comentário antes de enviar.')).toBeTruthy()
    expect(edit).not.toHaveBeenCalled()
  })

  it('remove só depois da confirmação', async () => {
    const { api, user } = setup({ detail: WITH_COMMENTS() })
    const remove = vi.spyOn(api.tasks.comments, 'remove').mockResolvedValue(undefined)
    await user.click(await screen.findByRole('button', { name: 'Remover comentário de Ana Souza' }))
    expect(remove).not.toHaveBeenCalled()
    const confirm = screen.getByRole('group', { name: 'Remover este comentário?' })
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('group', { name: 'Remover este comentário?' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Remover comentário de Ana Souza' }))
    await user.click(
      within(screen.getByRole('group', { name: 'Remover este comentário?' })).getByRole('button', {
        name: 'Remover',
      }),
    )
    expect(remove).toHaveBeenCalledWith({ taskId: TASK_ID, commentId: COMMENT_ID })
  })

  it('mostra aviso quando o servidor recusa a remoção', async () => {
    const { api, user } = setup({ detail: WITH_COMMENTS() })
    vi.spyOn(api.tasks.comments, 'remove').mockRejectedValue(new Error('falha'))
    await user.click(await screen.findByRole('button', { name: 'Remover comentário de Ana Souza' }))
    await user.click(
      within(screen.getByRole('group', { name: 'Remover este comentário?' })).getByRole('button', {
        name: 'Remover',
      }),
    )
    expect(await screen.findByText('Não foi possível remover o comentário.')).toBeTruthy()
  })

  it('mostra os eventos de comentário na linha do tempo com a frase do servidor', async () => {
    setup({
      detail: WITH_COMMENTS(),
      timeline: [
        makeEvent({
          id: '01J8Y4G2XK8Z1S6M3Q9W0A5E02',
          type: 'comment_added',
          text: 'comentou: "Oi @Ana Souza, o acesso saiu"',
        }),
      ],
    })
    expect(await screen.findByText('comentou: "Oi @Ana Souza, o acesso saiu"')).toBeTruthy()
  })
})
