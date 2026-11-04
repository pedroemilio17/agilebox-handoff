import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyEntryDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi, boardResponse } from '../shared/testing/fake-api'
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
const B = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC2', 'Publicar versão', 'Boreal')

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

const INVITE = 'Vamos registrar o que foi feito hoje?'

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
}: { current?: DailyEntryDto | null; tasks?: TaskDto[] } = {}) {
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
  const board = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse(tasks))
  const getToday = vi
    .spyOn(api.daily, 'getToday')
    .mockImplementation(({ date }) =>
      Promise.resolve({ date, due: stored === null, entry: stored }),
    )
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
        <App />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, shell, board, getToday, save, user: userEvent.setup() }
}

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Atualizar agora' }))
  await screen.findByRole('heading', { name: 'O que você avançou hoje?' })
}

describe('Bandeja: cartão de convite da daily', () => {
  it('aparece só quando a daily de hoje é devida', async () => {
    setup()
    expect(await screen.findByText(INVITE)).toBeTruthy()
  })

  it('some quando já há daily de hoje, e o atalho passa a editar', async () => {
    setup({ current: entry({ answers: { ...EMPTY, progress: 'Já escrevi' } }) })
    expect(await screen.findByRole('button', { name: 'Editar a daily de hoje' })).toBeTruthy()
    expect(screen.queryByText(INVITE)).toBeNull()
  })

  it('Agora não dispensa nesta sessão e o atalho volta a registrar', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Agora não' }))
    expect(screen.queryByText(INVITE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar a daily de hoje' })).toBeTruthy()
  })

  it('reaparece na próxima abertura do app enquanto não houver daily', async () => {
    const first = setup()
    await first.user.click(await screen.findByRole('button', { name: 'Agora não' }))
    cleanup()
    setup()
    expect(await screen.findByText(INVITE)).toBeTruthy()
  })

  it('não toma o foco ao aparecer', async () => {
    setup()
    await screen.findByText(INVITE)
    expect(document.activeElement).toBe(document.body)
  })

  it('a altura da tela inicial cresce para caber o cartão', async () => {
    const { shell } = setup()
    await screen.findByText(INVITE)
    // Duas linhas (374) mais o cartão (156).
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 530 }))
  })
})

describe('Bandeja: daily em três passos', () => {
  it('preenche os três passos, revisa e conclui com a data local e os campos certos', async () => {
    const { save, user } = setup()
    await openDaily(user)
    const first = screen.getByRole('heading', { name: 'O que você avançou hoje?' })
    await waitFor(() => expect(document.activeElement).toBe(first))
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()

    await user.type(
      screen.getByRole('textbox', { name: 'Algo mais que não passou pelo quadro?' }),
      'Atendi o suporte',
    )
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByText('Passo 2 de 3')).toBeTruthy()
    const second = screen.getByRole('heading', { name: 'Qual é o seu próximo passo?' })
    await waitFor(() => expect(document.activeElement).toBe(second))
    await user.type(screen.getByRole('textbox', { name: 'Próximo passo' }), 'Revisar a proposta')
    await user.click(screen.getByRole('button', { name: 'Próximo' }))

    expect(screen.getByText('Passo 3 de 3')).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: 'Impedimento' }), 'Sem acesso ao servidor')
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('heading', { name: 'Confira antes de concluir' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        date: TODAY,
        answers: {
          progress: 'Atendi o suporte',
          nextStep: 'Revisar a proposta',
          blocker: 'Sem acesso ao servidor',
        },
        noNews: false,
        taskRefs: [],
      }),
    )
    expect(await screen.findByText('Daily registrada.')).toBeTruthy()
    expect(screen.queryByText(INVITE)).toBeNull()
  })

  it('"Sem novidades hoje" marca noNews e conclui sem texto', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('button', { name: 'Sem novidades hoje' }))
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

  it('"Sem novidades" não salva por cima de texto digitado', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Algo mais que não passou pelo quadro?' }),
      'Algo',
    )
    await user.click(screen.getByRole('button', { name: 'Sem novidades hoje' }))
    expect(await screen.findByText('Apague o texto para marcar Sem novidades.')).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })

  it('não conclui vazia: pede texto ou Sem novidades', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    const message = await screen.findByText(
      'Escreva ao menos uma resposta ou marque Sem novidades.',
    )
    expect(message.closest('[aria-live="polite"]')).not.toBeNull()
    expect(save).not.toHaveBeenCalled()
  })

  it('bloqueia 501 caracteres com mensagem e sem perder o texto', async () => {
    const { save, user } = setup()
    await openDaily(user)
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Algo mais que não passou pelo quadro?',
    })
    fireEvent.change(field, { target: { value: 'a'.repeat(501) } })
    expect(screen.getByText('501/500')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(
      await screen.findByText(
        'Esta resposta passa de 500 caracteres. Reduza o texto para continuar.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
    expect(field.value.length).toBe(501)
    expect(save).not.toHaveBeenCalled()
  })

  it('Enter quebra linha e Ctrl+Enter avança', async () => {
    const { user } = setup()
    await openDaily(user)
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Algo mais que não passou pelo quadro?',
    })
    await user.type(field, 'Linha 1{Enter}Linha 2')
    expect(field.value).toBe('Linha 1\nLinha 2')
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(screen.getByText('Passo 2 de 3')).toBeTruthy()
  })

  it('erro ao salvar mostra mensagem curta e mantém o texto digitado', async () => {
    const { save, user } = setup()
    save.mockRejectedValueOnce(new Error('falha'))
    await openDaily(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Algo mais que não passou pelo quadro?' }),
      'Texto que não pode sumir',
    )
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(
      await screen.findByText('Não foi possível registrar a daily. Seu texto continua aqui.'),
    ).toBeTruthy()
    // Volta até o primeiro passo: o texto continua lá.
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Algo mais que não passou pelo quadro?',
      }).value,
    ).toBe('Texto que não pode sumir')
  })

  it('edita a daily existente, preenchida, e troca o título', async () => {
    const existing = entry({
      answers: { progress: 'Já escrevi', nextStep: 'Próximo da lista', blocker: '' },
      taskRefs: [A.id],
    })
    const { save, user } = setup({ current: existing })
    await user.click(await screen.findByRole('button', { name: 'Editar a daily de hoje' }))
    expect(
      await screen.findByRole('heading', { name: 'Editar a daily de hoje', level: 2 }),
    ).toBeTruthy()
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Algo mais que não passou pelo quadro?',
      }).value,
    ).toBe('Já escrevi')
    expect(screen.getByRole('checkbox', { name: 'AB-118 · Revisão do relatório' })).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'AB-118 · Revisão do relatório' })
        .checked,
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Próximo passo' }).value).toBe(
      'Próximo da lista',
    )
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        date: TODAY,
        answers: { progress: 'Já escrevi', nextStep: 'Próximo da lista', blocker: '' },
        noNews: false,
        taskRefs: [A.id],
      }),
    )
  })

  it('cita só tarefas da lista pessoal e leva as marcadas ao salvar', async () => {
    const { save, board, user } = setup()
    await openDaily(user)
    expect(board).toHaveBeenCalledWith({})
    await user.click(screen.getByRole('checkbox', { name: 'AB-118 · Revisão do relatório' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Algo mais que não passou pelo quadro?' }),
      'Revisei',
    )
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByText('AB-118 · Revisão do relatório')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ taskRefs: [A.id] })),
    )
  })

  it('Esc sem texto volta ao início sem confirmação', async () => {
    const { user } = setup()
    await openDaily(user)
    await user.keyboard('{Escape}')
    expect(await screen.findByText(INVITE)).toBeTruthy()
    expect(screen.queryByText('Descartar o que foi escrito?')).toBeNull()
  })

  it('Esc com texto pede confirmação; Esc fecha a confirmação; Descartar volta sem salvar', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Algo mais que não passou pelo quadro?' }),
      'Rascunho',
    )
    await user.keyboard('{Escape}')
    expect(await screen.findByText('Descartar o que foi escrito?')).toBeTruthy()
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Descartar o que foi escrito?')).toBeNull()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(await screen.findByText(INVITE)).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })

  it('Voltar do cabeçalho com texto também pede confirmação', async () => {
    const { user } = setup()
    await openDaily(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Algo mais que não passou pelo quadro?' }),
      'Rascunho',
    )
    await user.click(screen.getByRole('button', { name: '← Voltar' }))
    expect(await screen.findByText('Descartar o que foi escrito?')).toBeTruthy()
    expect(screen.queryByText(INVITE)).toBeNull()
  })

  it('com movimento reduzido, a troca de tela não passa por alturas intermediárias', async () => {
    const reduced = (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: reduced,
    })
    const { shell, user } = setup()
    await screen.findByText(INVITE)
    const before = shell.setTrayHeight.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    await screen.findByRole('heading', { name: 'O que você avançou hoje?' })
    const heights = (shell.setTrayHeight.mock.calls as Array<[{ height: number }]>)
      .slice(before)
      .map(([arg]) => arg.height)
    expect(heights).toEqual([560])
  })
})
