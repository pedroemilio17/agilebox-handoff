import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyEntryDto, DailySummarySuggestionDto, TaskDto } from '@agilebox/contract'
import type { ModuleId } from '@agilebox/core'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi, boardResponse } from '../shared/testing/fake-api'
import { teamToolsView } from '../shared/testing/team-tools-fixture'
import { forbiddenTermsIn, visibleTextOf } from '../shared/testing/forbidden-terms'
import { todayDateOnly } from '../shared/lib/today'
import { trayCopy } from './copy'
import { App } from './App'

const ME = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ORG = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const TODAY = todayDateOnly()
const PROGRESS_LABEL = 'Algo mais que não passou pelo quadro?'
const LINE = 'AB-118 Revisão do relatório: foi para Revisar · lançou 1,5 h'

const A: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
  number: 118,
  key: 'AB-118',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName: 'Aurora',
  title: 'Revisão do relatório',
  description: '',
  status: 'review',
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
}

const READY: DailySummarySuggestionDto = {
  advanced: [LINE],
  nextCandidates: ['AB-118 Revisão do relatório: em Revisar'],
  blockers: [],
}
const EMPTY: DailySummarySuggestionDto = { advanced: [], nextCandidates: [], blockers: [] }

beforeEach(() => {
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

interface SetupOptions {
  /** Módulos ativos do time (além do núcleo). Padrão: check-ins. */
  modules?: ModuleId[]
  suggestion?: () => Promise<DailySummarySuggestionDto>
}

function setup({
  modules = ['checkins'],
  suggestion = () => Promise.resolve(READY),
}: SetupOptions = {}) {
  vi.stubGlobal('agilebox', {
    shell: {
      minimize: vi.fn(),
      close: vi.fn(),
      toggleTray: vi.fn(),
      openPanel: vi.fn(),
      setTrayHeight: vi.fn(),
    },
  })
  const api = createFakeApi()
  let stored: DailyEntryDto | null = null
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: ME,
    organizationId: ORG,
    role: 'collaborator',
  })
  vi.spyOn(api.tasks, 'listRecent').mockResolvedValue([A])
  vi.spyOn(api.tasks, 'listFrequent').mockResolvedValue([])
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([A]))
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(teamToolsView({ modules, level: 'advanced' }))
  vi.spyOn(api.daily, 'getToday').mockImplementation(({ date }) =>
    Promise.resolve({ date, due: stored === null, entry: stored }),
  )
  const save = vi.spyOn(api.daily, 'save').mockImplementation((input) => {
    stored = {
      id: '01J8Y4G2XK8Z1S6M3Q9W0DAY01',
      userId: ME,
      userName: 'Pedro',
      date: TODAY,
      answers: input.answers,
      noNews: input.noNews ?? false,
      taskRefs: input.taskRefs ?? [],
      createdAt: '2026-11-04T12:00:00.000Z',
      updatedAt: '2026-11-04T12:00:00.000Z',
    }
    return Promise.resolve(stored)
  })
  const suggest = vi.spyOn(api.daily, 'suggestSummary').mockImplementation(suggestion)
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App initialScreen="home" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { save, suggest, user: userEvent.setup() }
}

async function openDaily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Atualizar agora' }))
  await screen.findByRole('heading', { name: 'O que você avançou hoje?' })
}

const progressField = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: PROGRESS_LABEL })

describe('Bandeja: sugestão do check-in', () => {
  it('"Usar sugestão" preenche o primeiro passo como texto editável e não grava nada', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(await screen.findByRole('button', { name: trayCopy.dailySuggestionUse }))

    expect(progressField().value).toBe(LINE)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText(trayCopy.dailySuggestionUsed)).toBeTruthy()
  })

  it('o texto usado pode ser editado, e o que é gravado é o texto editado', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(await screen.findByRole('button', { name: trayCopy.dailySuggestionUse }))
    await user.clear(progressField())
    await user.type(progressField(), 'Revisei o relatório com o time')

    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: { progress: 'Revisei o relatório com o time', nextStep: '', blocker: '' },
        }),
      ),
    )
  })

  it('usar com texto já escrito acrescenta a sugestão na linha seguinte, sem apagar o que a pessoa escreveu', async () => {
    const { user } = setup()
    await openDaily(user)
    await user.type(progressField(), 'Atendi o suporte')
    await user.click(await screen.findByRole('button', { name: trayCopy.dailySuggestionUse }))
    expect(progressField().value).toBe(`Atendi o suporte\n${LINE}`)
  })

  it('"Ignorar sugestão" esconde o painel e não grava nem preenche nada', async () => {
    const { save, user } = setup()
    await openDaily(user)
    await user.click(await screen.findByRole('button', { name: trayCopy.dailySuggestionIgnore }))

    expect(screen.queryByRole('button', { name: trayCopy.dailySuggestionUse })).toBeNull()
    expect(screen.queryByText(trayCopy.dailySuggestionTitle)).toBeNull()
    expect(progressField().value).toBe('')
    expect(save).not.toHaveBeenCalled()
  })

  it('mostra carregando enquanto a sugestão não chega', async () => {
    setup({ suggestion: () => new Promise(() => undefined) })
    const user = userEvent.setup()
    await openDaily(user)
    expect(await screen.findByText(trayCopy.dailySuggestionLoading)).toBeTruthy()
    expect(screen.queryByRole('button', { name: trayCopy.dailySuggestionUse })).toBeNull()
  })

  it('erro na sugestão avisa e não impede de escrever a daily', async () => {
    const { user } = setup({ suggestion: () => Promise.reject(new Error('falha')) })
    await openDaily(user)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(trayCopy.dailySuggestionError)).toBeTruthy()
    await user.type(progressField(), 'Escrevi sem sugestão')
    expect(progressField().value).toBe('Escrevi sem sugestão')
  })

  it('dia sem eventos mostra "Nada movido hoje" e nenhum botão de uso', async () => {
    const { user } = setup({ suggestion: () => Promise.resolve(EMPTY) })
    await openDaily(user)
    expect(await screen.findByText('Nada movido hoje')).toBeTruthy()
    expect(screen.queryByRole('button', { name: trayCopy.dailySuggestionUse })).toBeNull()
    expect(progressField().value).toBe('')
  })

  it('sem movimento, mas com próximo passo: "Usar sugestão" fica desligado, pois só o que foi movido vai para o texto', async () => {
    const { user } = setup({
      suggestion: () =>
        Promise.resolve({
          advanced: [],
          nextCandidates: ['AB-118 Revisão: em Revisar'],
          blockers: [],
        }),
    })
    await openDaily(user)
    expect(await screen.findByRole('button', { name: trayCopy.dailySuggestionUse })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByText('AB-118 Revisão: em Revisar')).toBeTruthy()
  })

  it('consulta com a data de hoje e o fuso do computador', async () => {
    const { suggest, user } = setup()
    await openDaily(user)
    await screen.findByRole('button', { name: trayCopy.dailySuggestionUse })
    expect(suggest).toHaveBeenCalledWith({
      date: TODAY,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  })

  it('com check-ins desligado, a sugestão não é consultada e nada do check-in aparece', async () => {
    const { suggest } = setup({ modules: [] })
    // A tela inicial já carregou quando a busca aparece; então o convite teria aparecido se fosse o caso.
    await screen.findByRole('textbox', { name: trayCopy.search })
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    expect(suggest).not.toHaveBeenCalled()
    expect(screen.queryByText(trayCopy.dailySuggestionTitle)).toBeNull()
  })

  it('sem sprints e sem backlog o check-in funciona igual e não menciona esses módulos', async () => {
    const { save, user } = setup({ modules: ['checkins', 'agenda'] })
    await openDaily(user)
    await user.click(await screen.findByRole('button', { name: trayCopy.dailySuggestionUse }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0]).toMatchObject({ answers: { progress: LINE } })
    expect(document.body.textContent ?? '').not.toMatch(/sprint|backlog/i)
  })
})

describe('Bandeja: textos novos da sugestão', () => {
  it('não usam termos proibidos nos perfis sem check-in', () => {
    const copy = Object.entries(trayCopy)
      .filter(([key]) => key.startsWith('dailySuggestion'))
      .flatMap(([, value]) => (typeof value === 'string' ? [value] : []))
    for (const text of copy) expect(forbiddenTermsIn(text)).toEqual([])
  })

  it('o texto da sugestão não aparece no painel quando o módulo está desligado (perfil Kanban simples)', async () => {
    setup({ modules: ['agenda'] })
    await screen.findByRole('textbox', { name: trayCopy.search })
    const visible = visibleTextOf(document.body)
    expect(visible).not.toContain(trayCopy.dailySuggestionTitle)
    expect(visible).not.toContain(trayCopy.dailySuggestionUse)
  })
})
