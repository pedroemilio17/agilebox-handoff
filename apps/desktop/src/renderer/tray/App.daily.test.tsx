import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgileBoxApi, DailyEntryDto, TaskDto } from '@agilebox/contract'
import { makeDetail, makeParticipation } from '../panel/task-detail/fixtures'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi, boardResponse } from '../shared/testing/fake-api'
import { ALL_MODULES, teamToolsView } from '../shared/testing/team-tools-fixture'
import { todayDateOnly } from '../shared/lib/today'
import { App } from './App'

const ME = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ORG = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const DAILY_ID = '01J8Y4G2XK8Z1S6M3Q9W0DAY01'
const TODAY = todayDateOnly()

const EMPTY = { progress: '', nextStep: '', blocker: '' }

const task = (id: string, title: string, projectName = 'Aurora'): TaskDto => ({
  id,
  number: 118,
  key: 'AB-118',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName,
  title,
  description: '',
  status: 'todo',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  commentCount: 0,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
})

const A = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC1', 'Revisão do relatório')
const B = {
  ...task('01J8Y4G2XK8Z1S6M3Q9W0A5BC2', 'Publicar versão', 'Boreal'),
  number: 7,
  key: 'AB-7',
}

function entry(overrides: Partial<DailyEntryDto> = {}): DailyEntryDto {
  return {
    id: DAILY_ID,
    userId: ME,
    userName: 'Pedro',
    date: TODAY,
    answers: EMPTY,
    noNews: false,
    taskRefs: [],
    createdAt: '2026-11-04T12:00:00.000Z',
    updatedAt: '2026-11-04T12:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  // Movimento normal por padrão: a bandeja anima a altura, como no app.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Uma daily por dia: `current` é o que o servidor tem hoje (null = devida). */
function setup({
  current = null,
  tasks = [A, B],
  winding = false,
}: { current?: DailyEntryDto | null; tasks?: TaskDto[]; winding?: boolean } = {}) {
  const shell = {
    minimize: vi.fn(),
    close: vi.fn(),
    toggleTray: vi.fn(),
    openPanel: vi.fn(),
    setTrayHeight: vi.fn(),
  }
  vi.stubGlobal('agilebox', { shell })
  const api = createFakeApi()
  let stored: DailyEntryDto | null = current
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: ME,
    organizationId: ORG,
    role: 'collaborator',
  })
  vi.spyOn(api.tasks, 'listRecent').mockResolvedValue(tasks)
  vi.spyOn(api.tasks, 'listFrequent').mockResolvedValue([])
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  // Check-ins em encerramento: ativo na lista de existentes, como o servidor devolve.
  if (winding)
    vi.spyOn(api.teamTools, 'get').mockResolvedValue(
      teamToolsView({
        modules: ALL_MODULES.filter((id) => id !== 'checkins'),
        level: 'advanced',
        winding: ['checkins'],
      }),
    )
  const board = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse(tasks))
  const getToday = vi
    .spyOn(api.daily, 'getToday')
    .mockImplementation(({ date }) =>
      Promise.resolve({ date, due: stored === null, entry: stored }),
    )
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  const getTask = vi
    .spyOn(api.tasks, 'get')
    .mockImplementation(({ taskId }) =>
      Promise.resolve(
        makeDetail({ id: taskId, participations: [makeParticipation({ hours: 1 })] }),
      ),
    )
  const setHours = vi
    .spyOn(api.participations, 'setHours')
    .mockResolvedValue({} as Awaited<ReturnType<AgileBoxApi['participations']['setHours']>>)
  const save = vi.spyOn(api.daily, 'save').mockImplementation((input) => {
    stored = entry({
      answers: input.answers,
      noNews: input.noNews ?? false,
      taskRefs: input.taskRefs ?? [],
    })
    return Promise.resolve(stored)
  })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App initialScreen="home" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, shell, board, getToday, save, getTask, setHours, user: userEvent.setup() }
}

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Agora' }))
  await screen.findByRole('heading', { name: '1 de 3 · Marque as tarefas trabalhadas hoje' })
}

describe('Bandeja: barra "Registrar o dia?"', () => {
  it('aparece em uma linha só quando a daily de hoje é devida', async () => {
    setup()
    expect(await screen.findByText('Registrar o dia?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agora' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Depois' })).toBeTruthy()
  })

  it('some quando já há daily de hoje', async () => {
    const { getToday } = setup({ current: entry() })
    await waitFor(() => expect(getToday).toHaveBeenCalled())
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(screen.queryByText('Registrar o dia?')).toBeNull()
  })

  it('Depois recolhe a barra nesta sessão', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Depois' }))
    const bar = screen.getByRole('region', { name: 'Atualização do dia' })
    expect(bar.className).toContain('dailyBarHidden')
  })

  it('some durante a busca e volta ao limpar', async () => {
    const { user } = setup()
    await screen.findByText('Registrar o dia?')
    const search = screen.getByLabelText('Buscar tarefas na bandeja')
    await user.type(search, 'rev')
    expect(screen.getByRole('region', { name: 'Atualização do dia' }).className).toContain(
      'dailyBarSearchHidden',
    )
    await user.clear(search)
    expect(screen.getByRole('region', { name: 'Atualização do dia' }).className).not.toContain(
      'dailyBarSearchHidden',
    )
  })

  it('a altura da tela inicial é fixa em 630, com ou sem a barra', async () => {
    const { shell } = setup()
    await screen.findByText('Registrar o dia?')
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
  })
})

describe('Bandeja: daily em três passos', () => {
  it('marca tarefas, ajusta horas, informa bloqueio e foco e conclui com a data local', async () => {
    const { save, setHours, shell, user } = setup()
    await openDaily(user)
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    expect(screen.getByText('1 de 3')).toBeTruthy()
    expect(
      screen.getByRole('progressbar', { name: 'Progresso da atualização do dia' })
        .firstElementChild,
    ).toHaveProperty('style.width', '33%')

    await user.click(screen.getByRole('checkbox', { name: /Revisão do relatório/ }))
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))

    await screen.findByRole('heading', { name: '2 de 3 · Horas dedicadas hoje' })
    expect(screen.getByText('2 de 3')).toBeTruthy()
    expect(screen.getByText('0,0h')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mais 0,5 hora em AB-118' }))
    await user.click(screen.getByRole('button', { name: 'Mais 0,5 hora em AB-118' }))
    expect(screen.getByText('1,0h')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))

    await screen.findByRole('heading', { name: '3 de 3 · Bloqueios e foco de amanhã' })
    await user.type(
      screen.getByLabelText('Bloqueio ou pedido de ajuda (opcional)'),
      'Preciso de acesso',
    )
    await user.type(screen.getByLabelText('Principal foco de amanhã (opcional)'), 'Fechar contrato')
    await user.click(screen.getByRole('button', { name: 'Finalizar dia' }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        date: TODAY,
        answers: {
          progress: 'Avancei em AB-118 · Revisão do relatório.',
          nextStep: 'Fechar contrato',
          blocker: 'Preciso de acesso',
        },
        noNews: false,
        taskRefs: [A.id],
      }),
    )
    await waitFor(() =>
      expect(setHours).toHaveBeenCalledWith(expect.objectContaining({ hours: '2' })),
    )
    expect(await screen.findByText('Daily registrada.')).toBeTruthy()
    expect(screen.queryByText('Registrar o dia?')).toBeNull()
  })

  it('"Sem novidades" no passo 1 marca noNews e conclui sem texto', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('button', { name: 'Sem novidades' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        date: TODAY,
        answers: EMPTY,
        noNews: true,
        taskRefs: [],
      }),
    )
    expect(await screen.findByText('Daily registrada.')).toBeTruthy()
  })

  it('← Voltar nos passos 2 e 3 volta um passo sem salvar', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await screen.findByRole('heading', { name: '2 de 3 · Horas dedicadas hoje' })
    expect(
      screen.getByText(
        'Nenhuma tarefa selecionada no passo 1. Você pode seguir direto ou voltar para marcar.',
      ),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await screen.findByRole('heading', { name: '3 de 3 · Bloqueios e foco de amanhã' })
    expect(screen.getByRole('button', { name: 'Finalizar dia' })).toBeTruthy()
    const footer = screen.getByRole('button', { name: 'Finalizar dia' }).parentElement!
    await user.click(within(footer).getByRole('button', { name: '← Voltar' }))
    await screen.findByRole('heading', { name: '2 de 3 · Horas dedicadas hoje' })
    expect(save).not.toHaveBeenCalled()
  })

  it('finalizar sem nada marcado nem escrito registra "Sem novidades"', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar dia' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        date: TODAY,
        answers: EMPTY,
        noNews: true,
        taskRefs: [],
      }),
    )
  })

  it('bloqueia 501 caracteres com mensagem e sem perder o texto', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    const long = 'a'.repeat(501)
    const field = screen.getByLabelText('Bloqueio ou pedido de ajuda (opcional)')
    await user.click(field)
    await user.paste(long)
    await user.click(screen.getByRole('button', { name: 'Finalizar dia' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
    expect((field as HTMLTextAreaElement).value).toBe(long)
  })

  it('erro ao salvar mostra mensagem curta e mantém o que foi marcado', async () => {
    const { api, user } = setup()
    vi.spyOn(api.daily, 'save').mockRejectedValue(new Error('falhou'))
    await openDaily(user)
    await user.click(screen.getByRole('checkbox', { name: /Revisão do relatório/ }))
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    await user.click(screen.getByRole('button', { name: 'Finalizar dia' }))
    expect(await screen.findByText(/Não foi possível registrar a daily/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finalizar dia' })).toBeTruthy()
  })

  it('← Voltar do cabeçalho sai sem salvar e sem confirmação', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('checkbox', { name: /Revisão do relatório/ }))
    const header = screen.getByRole('banner')
    await user.click(within(header).getByRole('button', { name: '← Voltar' }))
    expect(await screen.findByText('Em foco (2)')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('Bandeja: check-ins encerrando', () => {
  it('sem daily de hoje, não mostra a barra de registrar', async () => {
    const { getToday } = setup({ winding: true })
    await waitFor(() => expect(getToday).toHaveBeenCalled())
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(screen.queryByText('Registrar o dia?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agora' })).toBeNull()
  })
})
