import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TaskDto, TeamToolsViewDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { todayDateOnly } from '../shared/lib/today'
import { App } from './App'

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

const TASK: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 1,
  key: 'AB-1',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
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

function renderTray(teamTools: TeamToolsViewDto) {
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
    userId: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    role: 'collaborator',
  })
  vi.spyOn(api.tasks, 'listRecent').mockResolvedValue([TASK])
  vi.spyOn(api.tasks, 'listFrequent').mockResolvedValue([])
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([TASK]))
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(teamTools)
  const getToday = vi
    .spyOn(api.daily, 'getToday')
    .mockImplementation(({ date }) =>
      Promise.resolve({ date: date ?? todayDateOnly(), due: true, entry: null }),
    )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App initialScreen="home" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { getToday }
}

describe('Bandeja adaptativa (M2.1)', () => {
  it('Kanban simples no Básico: sem cartão de daily, sem pedido de daily e sem marcadores de módulos', async () => {
    const { getToday } = renderTray(
      teamToolsView({ modules: presetModules('kanban'), level: 'basic' }),
    )

    expect(await screen.findByText('Integração com API')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Integração com API')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    expect(screen.queryByText('Vamos registrar o que foi feito hoje?')).toBeNull()
    expect(screen.queryByText('Bloqueada')).toBeNull()
    expect(getToday).not.toHaveBeenCalled()
  })

  it('Scrum com check-ins no Intermediário: cartão de daily e marcador de bloqueio aparecem', async () => {
    const { getToday } = renderTray(
      teamToolsView({ modules: presetModules('scrum'), level: 'intermediate' }),
    )

    expect(await screen.findByText('Vamos registrar o que foi feito hoje?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Atualizar agora' })).toBeTruthy()
    expect(screen.getByText('Bloqueada')).toBeTruthy()
    expect(getToday).toHaveBeenCalled()
  })

  it('Scrum no Básico: o marcador de bloqueio continua, mas o cartão de daily não aparece', async () => {
    const { getToday } = renderTray(
      teamToolsView({ modules: presetModules('scrum'), level: 'basic' }),
    )

    expect(await screen.findByText('Bloqueada')).toBeTruthy()
    expect(screen.queryByText('Vamos registrar o que foi feito hoje?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).toBeNull()
    expect(getToday).not.toHaveBeenCalled()
  })
})
