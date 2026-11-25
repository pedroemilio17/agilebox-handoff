import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TaskDto, TeamToolsViewDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../shared/testing/fake-api'
import { forbiddenTermsIn, visibleTextOf } from '../shared/testing/forbidden-terms'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { todayDateOnly } from '../shared/lib/today'
import { makeDetail } from '../panel/task-detail/fixtures'
import { App } from './App'

/**
 * Bandeja no Kanban simples, nível Básico: criar e atualizar tarefa sem daily, sem bloqueio e sem
 * termos de Scrum (PLANO-2.0, time Básico).
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom não traz matchMedia; sem movimento reduzido, a bandeja anima a altura como no app.
beforeAll(() => {
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

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const USER_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'

/** Tarefa com bloqueio registrado: no Básico o motivo não aparece na bandeja. */
const BLOCKED: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 118,
  key: 'AB-118',
  projectId: PROJECT_ID,
  projectName: 'Projeto Aurora',
  title: 'Integração com API',
  description: '',
  status: 'in_progress',
  priority: 'normal',
  blockedReason: 'Aguardando API',
  blockedAt: '2026-11-10T10:00:00.000Z',
  checklistProgress: { done: 1, total: 3, percent: 33 },
  commentCount: 0,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
}

function renderTray(
  tools: TeamToolsViewDto = teamToolsView({ modules: presetModules('kanban'), level: 'basic' }),
  initialScreen: 'prompt' | 'home' = 'home',
) {
  const shell = {
    minimize: vi.fn(),
    close: vi.fn(),
    toggleTray: vi.fn(),
    openPanel: vi.fn(),
    setTrayHeight: vi.fn(),
  }
  vi.stubGlobal('agilebox', { shell })
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: USER_ID,
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    role: 'collaborator',
  })
  vi.spyOn(api.projects, 'list').mockResolvedValue([
    {
      id: PROJECT_ID,
      name: 'Projeto Aurora',
      createdBy: USER_ID,
      createdAt: '2026-10-31T12:00:00.000Z',
      definitionOfDoneCount: 0,
      archivedAt: null,
    },
  ])
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  const listRecent = vi.spyOn(api.tasks, 'listRecent').mockResolvedValue([BLOCKED])
  vi.spyOn(api.tasks, 'listFrequent').mockResolvedValue([])
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([BLOCKED]))
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(tools)
  const getToday = vi
    .spyOn(api.daily, 'getToday')
    .mockImplementation(({ date }) =>
      Promise.resolve({ date: date ?? todayDateOnly(), due: true, entry: null }),
    )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App initialScreen={initialScreen} />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, shell, listRecent, getToday, user: userEvent.setup() }
}

function expectNoScrumTerms() {
  expect(forbiddenTermsIn(visibleTextOf(document.body))).toEqual([])
}

describe('Bandeja · Kanban simples · Básico', () => {
  it('tela inicial sem barra de daily, sem pedido de daily, sem bloqueio e sem termos de Scrum', async () => {
    const { getToday } = renderTray()

    expect(await screen.findByText(BLOCKED.title)).toBeTruthy()
    expect(screen.queryByText('Registrar o dia?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agora' })).toBeNull()
    expect(screen.queryByText('Bloqueada')).toBeNull()
    expect(getToday).not.toHaveBeenCalled()
    expectNoScrumTerms()
  })

  it('cria pela criação rápida com o título digitado e sem termos de Scrum na tela', async () => {
    const { api, user } = renderTray()
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue({
      ...BLOCKED,
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCE',
      key: 'AB-119',
      title: 'Preparar entrega',
      blockedReason: null,
      blockedAt: null,
      status: 'todo',
    })
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCE', title: 'Preparar entrega', key: 'AB-119' }),
    )

    await user.type(
      await screen.findByRole('textbox', { name: 'Criação rápida' }),
      'Preparar entrega',
    )
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Preparar entrega', projectId: PROJECT_ID }),
      ),
    )
  })

  it('abre uma tarefa, muda o estado e salva; o detalhe não mostra impedimento nem Scrum', async () => {
    const { api, user, shell } = renderTray()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({
        id: BLOCKED.id,
        title: BLOCKED.title,
        key: BLOCKED.key,
        blockedReason: 'Aguardando API',
      }),
    )
    vi.spyOn(api.tasks, 'update').mockResolvedValue(BLOCKED)
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(BLOCKED)

    await user.click(await screen.findByRole('button', { name: /Integração com API/ }))
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    expect(await screen.findByLabelText('Estado da tarefa')).toBeTruthy()
    expect(screen.queryByText('Aguardando API')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /Marcar como bloqueada/ })).toBeNull()
    expect(screen.queryByText('Subtarefas')).toBeNull()
    expectNoScrumTerms()

    await user.selectOptions(screen.getByLabelText('Estado da tarefa'), 'review')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(move).toHaveBeenCalledWith({ taskId: BLOCKED.id, status: 'review' }))
    expect(await screen.findByText('Atualização salva')).toBeTruthy()
  })

  it('fluxo padrão inicia no aviso compacto e abre o Kan sem termos de Scrum no Básico', async () => {
    const { user, shell } = renderTray(
      teamToolsView({ modules: presetModules('kanban'), level: 'basic' }),
      'prompt',
    )

    expect(await screen.findByText('Vamos atualizar as atividades de hoje?')).toBeTruthy()
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 62, width: 340 }),
    )
    expectNoScrumTerms()

    await user.click(
      screen.getByRole('button', { name: 'Expandir bandeja para atualizar atividades' }),
    )
    expect(await screen.findByText(BLOCKED.title)).toBeTruthy()
    expectNoScrumTerms()

    await user.click(screen.getByRole('button', { name: 'Abrir chat com o Kan' }))
    expect(await screen.findByRole('log', { name: 'Conversa com o Kan' })).toBeTruthy()
    expectNoScrumTerms()
  })
})
