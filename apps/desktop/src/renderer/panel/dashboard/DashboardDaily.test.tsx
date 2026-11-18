import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { format, parseISO } from 'date-fns'
import { ApiError } from '@agilebox/contract'
import type { AgileBoxApi } from '@agilebox/contract'
import type { DailyEntryDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { createFakeApi } from '../../shared/testing/fake-api'
import { DashboardView } from './DashboardView'
import { ANA, BRUNO, dashboardFixture } from './dashboard-fixtures'

afterEach(cleanup)

const TODAY = todayDateOnly()
const TODAY_LABEL = format(parseISO(TODAY), 'dd/MM/yyyy')
const dashboard = dashboardFixture()

const entry: DailyEntryDto = {
  id: '01HZENTRY000000000000000001',
  userId: BRUNO,
  userName: 'Bruno Lima',
  date: TODAY,
  answers: {
    progress: 'Revisei a integração do suporte.',
    nextStep: 'Montar o teste de carga.',
    blocker: '',
  },
  noNews: false,
  taskRefs: ['01HZTASK0000000000000000001'],
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
}

// Só os campos que a daily usa (chave e título); o restante do detalhe não entra no teste.
const task = {
  id: '01HZTASK0000000000000000001',
  key: 'AB-118',
  title: 'Revisar integração',
} as unknown as Awaited<ReturnType<AgileBoxApi['tasks']['get']>>

function setup(
  options: {
    entryResult?: DailyEntryDto | null | Error
    listResult?: { userId: string; userName: string; done: boolean }[] | Error
  } = {},
) {
  const api = createFakeApi()
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboard)
  const list = options.listResult ?? [
    { userId: BRUNO, userName: 'Bruno Lima', done: true },
    { userId: ANA, userName: 'Ana Souza', done: false },
  ]
  vi.spyOn(api.daily, 'listForDate').mockImplementation(() =>
    list instanceof Error ? Promise.reject(list) : Promise.resolve(list),
  )
  const getForUser = vi.spyOn(api.daily, 'getForUser').mockImplementation(() => {
    const result = options.entryResult === undefined ? entry : options.entryResult
    if (result instanceof Error) return Promise.reject(result)
    return Promise.resolve(result)
  })
  vi.spyOn(api.tasks, 'get').mockResolvedValue(task)
  const onNotice = vi.fn()
  const onOpenProjects = vi.fn()
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <DashboardView
          onOpenProjects={onOpenProjects}
          onOpenProject={vi.fn()}
          onOpenTask={vi.fn()}
          onOpenUpdates={vi.fn()}
          onNotice={onNotice}
        />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, getForUser, onNotice, onOpenProjects, user: userEvent.setup() }
}

describe('coluna Daily de hoje no dashboard', () => {
  it('mostra "✓ respondida" e "pendente" na coluna Diária de hoje, sem contador (desenho, tela 19)', async () => {
    setup()
    expect(await screen.findByText('✓ respondida')).toBeTruthy()
    expect(screen.getByText('pendente')).toBeTruthy()
    expect(screen.getByText('Diária de hoje')).toBeTruthy()
    expect(screen.queryByText(/dailies feitas hoje/)).toBeNull()
  })

  it('só quem tem daily ganha o botão Ver, com nome na etiqueta', async () => {
    setup()
    await screen.findByText('✓ respondida')
    expect(screen.getByRole('button', { name: 'Ver a daily de Bruno Lima' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ver a daily de Ana Souza' })).toBeNull()
  })

  it('a linha continua abrindo os projetos da pessoa', async () => {
    const { user, onOpenProjects } = setup()
    await user.click(await screen.findByRole('button', { name: 'Abrir projetos de Ana Souza' }))
    expect(onOpenProjects).toHaveBeenCalledWith(expect.objectContaining({ id: ANA }))
  })

  it('pede a lista da data de hoje', async () => {
    const { api } = setup()
    await screen.findByText('✓ respondida')
    expect(api.daily.listForDate).toHaveBeenCalledWith({ date: TODAY })
  })
})

describe('Ver a daily em somente leitura', () => {
  it('abre o diálogo com as três respostas, as tarefas citadas e sem campos editáveis', async () => {
    const { user, getForUser } = setup()
    await user.click(await screen.findByRole('button', { name: 'Ver a daily de Bruno Lima' }))

    const dialog = await screen.findByRole('dialog', {
      name: `Daily de Bruno Lima · ${TODAY_LABEL}`,
    })
    expect(getForUser).toHaveBeenCalledWith({ userId: BRUNO, date: TODAY })
    expect(within(dialog).getByText('Somente leitura')).toBeTruthy()
    expect(await within(dialog).findByText('Revisei a integração do suporte.')).toBeTruthy()
    expect(within(dialog).getByText('Montar o teste de carga.')).toBeTruthy()
    expect(within(dialog).getByText('Nada escrito.')).toBeTruthy()
    expect(within(dialog).getByText('Revisar integração')).toBeTruthy()
    expect(within(dialog).getByText('AB-118')).toBeTruthy()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: /salvar|editar/i })).toBeNull()
  })

  it('mostra "Sem novidades hoje" quando a daily marca sem novidades', async () => {
    const { user } = setup({
      entryResult: {
        ...entry,
        noNews: true,
        answers: { progress: '', nextStep: '', blocker: '' },
        taskRefs: [],
      },
    })
    await user.click(await screen.findByRole('button', { name: 'Ver a daily de Bruno Lima' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Sem novidades hoje')).toBeTruthy()
  })

  it('fecha com Esc, devolve o foco ao botão Ver e prende o foco no diálogo', async () => {
    const { user } = setup()
    const ver = await screen.findByRole('button', { name: 'Ver a daily de Bruno Lima' })
    await user.click(ver)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(ver)
  })

  it('mostra erro curto com aviso e "Tentar de novo" recarrega a daily', async () => {
    const { user, getForUser, onNotice } = setup({
      entryResult: new ApiError('CONFLICT', 'falhou'),
    })
    await user.click(await screen.findByRole('button', { name: 'Ver a daily de Bruno Lima' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toBeTruthy()
    expect(onNotice).toHaveBeenCalledWith('Não foi possível carregar esta daily.', 'warning')

    getForUser.mockResolvedValueOnce(entry)
    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }))
    expect(await within(dialog).findByText('Revisei a integração do suporte.')).toBeTruthy()
  })

  it('mostra carregando enquanto a daily chega', async () => {
    const { user, getForUser } = setup()
    getForUser.mockReturnValueOnce(new Promise(() => undefined))
    await user.click(await screen.findByRole('button', { name: 'Ver a daily de Bruno Lima' }))
    expect(await screen.findByText('Carregando a daily…')).toBeTruthy()
  })

  it('daily pendente no diálogo diz que ainda não foi registrada', async () => {
    const { user } = setup({ entryResult: null })
    await user.click(await screen.findByRole('button', { name: 'Ver a daily de Bruno Lima' }))
    expect(await screen.findByText('Ainda não registrou a daily de hoje.')).toBeTruthy()
  })
})

describe('falha ao listar as dailies', () => {
  it('avisa uma vez e oferece tentar de novo na coluna', async () => {
    const { api, onNotice, user } = setup({ listResult: new ApiError('CONFLICT', 'falhou') })
    expect(await screen.findByText(/Não foi possível carregar a daily de hoje/)).toBeTruthy()
    expect(onNotice).toHaveBeenCalledTimes(1)
    expect(onNotice).toHaveBeenCalledWith('Não foi possível carregar a daily de hoje.', 'warning')

    vi.mocked(api.daily.listForDate).mockResolvedValueOnce([
      { userId: BRUNO, userName: 'Bruno Lima', done: true },
    ])
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('✓ respondida')).toBeTruthy()
    expect(onNotice).toHaveBeenCalledTimes(1)
  })
})
