import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { FLOW_TASK, installFlowApi, stubDesktopBridge } from '../shared/testing/flow-backend'
import { forbiddenTermsIn, visibleTextOf } from '../shared/testing/forbidden-terms'
import { makeDetail, USER_ID } from './task-detail/fixtures'
import { App } from './App'
import { impedimentCopy } from './impediments/impediment-copy'

/**
 * Efeitos e telas de impedimento por time e nível: a barra lateral, a tela, o atalho G I e o
 * marcador "Bloqueada" com o responsável. O que não é do nível não aparece nem é pedido.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SCRUM = presetModules('scrum')
const KANBAN = presetModules('kanban')
const ENDING = SCRUM.filter((module) => module !== 'impediments')

const BLOCKED = makeDetail({
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCH',
  number: 121,
  key: 'AB-121',
  title: 'Integrar pagamento',
  status: 'in_progress',
  blockedReason: 'Aguardando API',
  blockedAt: '2026-11-10T10:00:00.000Z',
  canArchive: true,
  impediment: {
    id: '01J8Y4G2XK8Z1S6M3Q9W0B1001',
    status: 'open',
    reason: 'Aguardando API',
    ownerId: USER_ID,
    ownerName: 'Ana Souza',
    openedAt: '2026-11-10T10:00:00.000Z',
  },
})

function renderApp({
  modules,
  level,
  winding = [],
  tasks = [FLOW_TASK, BLOCKED],
}: {
  modules: readonly string[]
  level: 'basic' | 'intermediate' | 'advanced'
  winding?: readonly string[]
  tasks?: ReturnType<typeof makeDetail>[]
}) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  installFlowApi(api, {
    role: 'collaborator',
    tools: teamToolsView({
      modules: modules as never,
      level,
      winding: winding as never,
    }),
    tasks,
  })
  vi.spyOn(api.impediments, 'list').mockResolvedValue([])
  vi.spyOn(api.backlog, 'list').mockResolvedValue([])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, user: userEvent.setup() }
}

function railNames(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
  return Array.from(nav.querySelectorAll('button'))
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .filter((name) => !/^(Recolher|Expandir|Abrir Bandeja|Buscar ou criar)/.test(name))
}

describe('Impedimentos por time e nível', () => {
  it('Kanban simples · Básico: sem o item, sem a tela, sem o atalho e sem termos de impedimento', async () => {
    const { user } = renderApp({ modules: KANBAN, level: 'basic' })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(railNames()).not.toContain('Impedimentos')
    expect(railNames()).not.toContain('Sprints')
    await user.keyboard('gi')
    expect(screen.queryByRole('region', { name: impedimentCopy.title })).toBeNull()
    expect(forbiddenTermsIn(visibleTextOf(document.body))).toEqual([])
  })

  it('Scrum · Básico: a tela abre dentro de Sprints, e o card mostra o marcador com o responsável', async () => {
    const { user } = renderApp({ modules: SCRUM, level: 'basic' })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(railNames()).toContain('Sprints')

    const card = screen.getByRole('button', { name: /^AB-121 · / })
    expect(card.getAttribute('aria-label')).toContain('bloqueada, responsável Ana Souza')
    expect(card.getAttribute('title')).toBe('Bloqueada: Aguardando API · Responsável: Ana Souza')
    expect(within(card).getByText('Bloqueada')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Sprints' }))
    await user.click(
      within(await screen.findByRole('navigation', { name: 'Seções de Sprints' })).getByRole(
        'button',
        { name: 'Impedimentos' },
      ),
    )
    expect(await screen.findByRole('region', { name: impedimentCopy.title })).toBeTruthy()
  })

  it('Scrum · Intermediário: aba dentro de Sprints e atalho G I abrem a tela', async () => {
    const { user } = renderApp({ modules: SCRUM, level: 'intermediate' })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(railNames()).toContain('Sprints')
    await user.click(screen.getByRole('button', { name: 'Sprints' }))
    await user.click(
      within(await screen.findByRole('navigation', { name: 'Seções de Sprints' })).getByRole(
        'button',
        { name: 'Impedimentos' },
      ),
    )
    expect(await screen.findByRole('region', { name: impedimentCopy.title })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    await user.keyboard('gi')
    expect(await screen.findByRole('region', { name: impedimentCopy.title })).toBeTruthy()
  })

  it('Scrum · Intermediário: o marcador traz o responsável no rótulo', async () => {
    renderApp({ modules: SCRUM, level: 'intermediate' })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    const card = screen.getByRole('button', { name: /^AB-121 · / })
    expect(card.getAttribute('aria-label')).toContain('responsável Ana Souza')
  })

  it('Encerrando: a tela e a aba seguem (só o abrir some, testado no detalhe)', async () => {
    const { user } = renderApp({ modules: ENDING, level: 'intermediate', winding: ['impediments'] })
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(railNames()).toContain('Sprints')
    await user.click(screen.getByRole('button', { name: 'Sprints' }))
    await user.click(
      within(await screen.findByRole('navigation', { name: 'Seções de Sprints' })).getByRole(
        'button',
        { name: 'Impedimentos' },
      ),
    )
    expect(await screen.findByRole('region', { name: impedimentCopy.title })).toBeTruthy()
  })

  it('a lista de backlog mostra "Bloqueada" com o responsável no title', async () => {
    const { api, user } = renderApp({ modules: SCRUM, level: 'intermediate' })
    vi.spyOn(api.projects, 'listMembers').mockResolvedValue([
      { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator' },
    ])
    vi.spyOn(api.backlog, 'list').mockResolvedValue([
      {
        ...BLOCKED,
        id: BLOCKED.id,
        number: BLOCKED.number,
        key: BLOCKED.key,
        projectId: BLOCKED.projectId,
        projectName: BLOCKED.projectName,
        inBacklog: true,
        backlogRank: 1,
        priority: 'normal',
        checklistProgress: { done: 0, total: 0, percent: 0 },
        commentCount: 0,
        criteriaProgress: undefined,
        sprint: null,
      } as never,
    ])
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    await user.click(screen.getByRole('button', { name: 'Backlog' }))
    const marker = await screen.findByText('Bloqueada')
    expect(marker.parentElement?.getAttribute('title')).toBe(
      'Bloqueada: Aguardando API · Responsável: Ana Souza',
    )
  })
})
