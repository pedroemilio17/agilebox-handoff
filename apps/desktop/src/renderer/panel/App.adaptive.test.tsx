import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto, TaskDto, TeamToolsViewDto, WipColumnDto } from '@agilebox/contract'
import { presetModules, teamToolsView, ALL_MODULES } from '../shared/testing/team-tools-fixture'
import { ApiProvider } from '../shared/api/ApiProvider'
import { queryKeys } from '../shared/query/keys'
import { createFakeApi } from '../shared/testing/fake-api'
import { App } from './App'
import { makeDetail } from './task-detail/fixtures'

afterEach(cleanup)

const PROJECT: ProjectDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
  name: 'Projeto Aurora',
  createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
}

const BASE_TASK: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 1,
  key: 'AB-1',
  projectId: PROJECT.id,
  projectName: PROJECT.name,
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

const BLOCKED = BASE_TASK
const PLAIN: TaskDto = {
  ...BASE_TASK,
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCE',
  number: 2,
  key: 'AB-2',
  title: 'Revisar texto',
  status: 'todo',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
}

const WIP_COLUMNS: WipColumnDto[] = [{ status: 'in_progress', count: 1, limit: 3, state: 'ok' }]

type TeamToolsMode = 'pending' | 'error' | TeamToolsViewDto

/** Monta o painel com o quadro acima e `teamTools.get` no modo pedido. */
function renderPanel(teamTools: TeamToolsMode) {
  const api = createFakeApi()
  vi.spyOn(api.projects, 'list').mockResolvedValue([PROJECT])
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue({
    tasks: [BLOCKED, PLAIN],
    wipLimits: { in_progress: 3 },
    wipColumns: WIP_COLUMNS,
  })
  const getBoardFlow = vi.spyOn(api.tasks, 'getBoardFlow').mockResolvedValue({
    cycleDays: 2.5,
    weekStart: '2026-11-09',
    updatedAt: '2026-11-16T12:00:00Z',
  })
  vi.spyOn(api.tasks, 'get').mockImplementation(({ taskId }) =>
    Promise.resolve(
      taskId === BLOCKED.id
        ? makeDetail({
            id: BLOCKED.id,
            title: BLOCKED.title,
            key: BLOCKED.key,
            status: 'in_progress',
            blockedReason: BLOCKED.blockedReason,
            blockedAt: BLOCKED.blockedAt,
          })
        : makeDetail({ id: PLAIN.id, title: PLAIN.title, key: PLAIN.key, status: 'todo' }),
    ),
  )
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  const boardSettings = vi.spyOn(api.boardSettings, 'get')
  const teamToolsGet = vi.spyOn(api.teamTools, 'get').mockImplementation(() => {
    if (teamTools === 'pending') return new Promise<TeamToolsViewDto>(() => undefined)
    if (teamTools === 'error') return Promise.reject(new Error('falha de rede'))
    return Promise.resolve(teamTools)
  })
  // Cliente próprio: o teste de subida de nível invalida a consulta de ferramentas pelo cliente.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, queryClient, teamToolsGet, boardSettings, getBoardFlow }
}

/** Cartão do quadro: o nome começa pela chave (o botão de arrastar começa com "Mover"). */
function cardButton(task: TaskDto) {
  return screen.getByRole('button', { name: new RegExp(`^${task.key} · `) })
}

function findCard(task: TaskDto) {
  return screen.findByRole('button', { name: new RegExp(`^${task.key} · `) })
}

async function openTask(user: ReturnType<typeof userEvent.setup>, task: TaskDto) {
  await user.click(await findCard(task))
  return screen.findByRole('dialog', { name: task.title })
}

/** Telas e efeitos do padrão completo, que devem continuar iguais ao de hoje. */
async function expectEverythingVisible(cycle = 'Ciclo médio desta semana: 2,5d') {
  const board = await screen.findByRole('region', { name: 'Concluído, tarefas' })
  expect(screen.getByRole('button', { name: 'Agenda' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Paradas · 0' })).toBeTruthy()
  expect(
    within(screen.getByRole('region', { name: 'Desenvolvendo, tarefas' })).getByRole('img', {
      name: /^Desenvolvendo: 1 de 3/,
    }),
  ).toBeTruthy()
  expect(await within(board).findByText(cycle)).toBeTruthy()
  const card = cardButton(BLOCKED)
  expect(card.getAttribute('aria-label')).toContain('bloqueada')
  expect(card.getAttribute('aria-label')).toContain('1 de 3 subtarefas concluídas')
}

describe('Painel adaptativo (M2.1)', () => {
  it('(a) padrão completo mostra as mesmas telas e efeitos de hoje, e o detalhe tem Bloquear e Subtarefas', async () => {
    const user = userEvent.setup()
    renderPanel(teamToolsView({ modules: ALL_MODULES, level: 'advanced' }))

    await expectEverythingVisible()
    const dialog = await openTask(user, BLOCKED)
    expect(within(dialog).getByRole('button', { name: 'Desbloquear' })).toBeTruthy()
    expect(within(dialog).getByRole('region', { name: 'Subtarefas' })).toBeTruthy()
  })

  it('(b) Kanban simples no Básico: sem Subtarefas, Bloquear, medidor de WIP, fluxo nem daily', async () => {
    const user = userEvent.setup()
    const { boardSettings, getBoardFlow } = renderPanel(
      teamToolsView({ modules: presetModules('kanban'), level: 'basic' }),
    )

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    // Agenda é ferramenta do preset e o nível Básico a alcança (PLANO-2.0 e registro de módulos).
    expect(screen.getByRole('button', { name: 'Agenda' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Bloqueadas/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Paradas/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /^Desenvolvendo:/ })).toBeNull()
    expect(screen.queryByText(/Ciclo médio desta semana/)).toBeNull()
    const card = cardButton(BLOCKED)
    expect(card.getAttribute('aria-label')).not.toContain('bloqueada')
    expect(card.getAttribute('aria-label')).not.toContain('subtarefas')
    expect(getBoardFlow).not.toHaveBeenCalled()
    expect(boardSettings).not.toHaveBeenCalled()

    const dialog = await openTask(user, BLOCKED)
    expect(within(dialog).queryByRole('region', { name: 'Subtarefas' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Bloquear' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Desbloquear' })).toBeNull()
    expect(within(dialog).queryByText('Aguardando API')).toBeNull()
  })

  it('(b) sem a ferramenta Agenda, o item do menu e o atalho G A somem', async () => {
    const user = userEvent.setup()
    renderPanel(teamToolsView({ modules: ['core'], level: 'basic' }))

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull()
    // G A não leva a lugar nenhum: o atalho só existe com a Agenda ligada.
    await user.keyboard('ga')
    expect(screen.getByRole('region', { name: 'Concluído, tarefas' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Visualização da agenda' })).toBeNull()
  })

  it('(c) Scrum no Básico: módulos ativos acima do nível mantêm só os efeitos passivos', async () => {
    const user = userEvent.setup()
    renderPanel(teamToolsView({ modules: presetModules('scrum'), level: 'basic' }))

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    // Bloqueio é passivo: o marcador e o filtro aparecem; o card não mostra o botão Bloquear.
    expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
    expect(cardButton(BLOCKED).getAttribute('aria-label')).toContain('bloqueada')

    const blockedDialog = await openTask(user, BLOCKED)
    expect(within(blockedDialog).getByText('Aguardando API')).toBeTruthy()
    expect(within(blockedDialog).queryByRole('button', { name: 'Desbloquear' })).toBeNull()
    expect(within(blockedDialog).queryByRole('button', { name: 'Bloquear' })).toBeNull()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: BLOCKED.title })).toBeNull())

    const plainDialog = await openTask(user, PLAIN)
    expect(within(plainDialog).queryByRole('button', { name: 'Bloquear' })).toBeNull()
    // Medidor de WIP continua escondido (wip não faz parte do Scrum).
    expect(screen.queryByRole('img', { name: /^Desenvolvendo:/ })).toBeNull()
  })

  it('(d) módulo desligado não deixa nenhum efeito, nem passivo', async () => {
    renderPanel(teamToolsView({ modules: ['core'], level: 'advanced' }))

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    const card = cardButton(BLOCKED)
    expect(card.getAttribute('aria-label')).not.toContain('bloqueada')
    expect(card.getAttribute('aria-label')).not.toContain('subtarefas')
    expect(screen.queryByRole('button', { name: /^Bloqueadas/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Paradas/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /^Desenvolvendo:/ })).toBeNull()
    expect(screen.queryByText(/Ciclo médio desta semana/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agenda' })).toBeNull()
  })

  it('(d) o motivo do bloqueio não aparece no detalhe quando impedimentos está desligado', async () => {
    const user = userEvent.setup()
    renderPanel(teamToolsView({ modules: ['core'], level: 'advanced' }))

    const dialog = await openTask(user, BLOCKED)
    expect(within(dialog).queryByText('Aguardando API')).toBeNull()
    expect(within(dialog).queryByText('Bloqueada')).toBeNull()
    expect(within(dialog).queryByRole('region', { name: 'Subtarefas' })).toBeNull()
  })

  it('(e) boardSettings.get não é chamado com WIP desligado', async () => {
    const { boardSettings } = renderPanel(
      teamToolsView({ modules: presetModules('scrum'), level: 'advanced' }),
    )

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(boardSettings).not.toHaveBeenCalled()
  })

  it('(f) carregando ou com erro em teamTools.get não esconde nada', async () => {
    // Carregando: tudo continua na tela; o valor do ciclo só é pedido quando a lista chega.
    const pending = renderPanel('pending')
    await expectEverythingVisible('Ciclo médio desta semana: —')
    expect(pending.teamToolsGet).toHaveBeenCalled()
    expect(pending.getBoardFlow).not.toHaveBeenCalled()
    cleanup()

    // Erro: a lista não existe, mas nada some e o ciclo é buscado como antes.
    renderPanel('error')
    await expectEverythingVisible()
  })

  it('(g) subir o nível acrescenta telas sem remover nada', async () => {
    const user = userEvent.setup()
    // Kanban com fluxo mais Impedimentos: cobre telas de WIP, subtarefas, fluxo e bloqueio.
    const modules = [...presetModules('kanban-flow'), 'impediments'] as const
    const { teamToolsGet, queryClient } = renderPanel(
      teamToolsView({ modules: [...modules], level: 'basic' }),
    )

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    // Básico: os efeitos passivos dos módulos ativos aparecem no card e no filtro.
    const card = cardButton(BLOCKED)
    expect(card.getAttribute('aria-label')).toContain('bloqueada')
    expect(card.getAttribute('aria-label')).toContain('1 de 3 subtarefas concluídas')
    expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
    // Telas de WIP, subtarefas e fluxo ficam fora do Básico.
    expect(screen.queryByRole('img', { name: /^Desenvolvendo:/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Paradas/ })).toBeNull()
    expect(screen.queryByText(/Ciclo médio desta semana/)).toBeNull()
    const basicDialog = await openTask(user, BLOCKED)
    expect(within(basicDialog).queryByRole('region', { name: 'Subtarefas' })).toBeNull()
    expect(within(basicDialog).queryByRole('button', { name: 'Desbloquear' })).toBeNull()
    expect(within(basicDialog).getByText('Aguardando API')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: BLOCKED.title })).toBeNull())

    teamToolsGet.mockResolvedValue(teamToolsView({ modules: [...modules], level: 'advanced' }))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamTools.all })
    })

    await waitFor(() =>
      expect(screen.getByRole('img', { name: /^Desenvolvendo: 1 de 3/ })).toBeTruthy(),
    )
    expect(screen.getByRole('button', { name: 'Paradas · 0' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
    expect(await screen.findByText('Ciclo médio desta semana: 2,5d')).toBeTruthy()
    // Nada do nível anterior saiu: o marcador de bloqueio e o progresso seguem no card.
    expect(cardButton(BLOCKED).getAttribute('aria-label')).toContain('bloqueada')
    expect(cardButton(BLOCKED).getAttribute('aria-label')).toContain('1 de 3 subtarefas concluídas')
    const advancedDialog = await openTask(user, BLOCKED)
    expect(within(advancedDialog).getByRole('region', { name: 'Subtarefas' })).toBeTruthy()
    expect(within(advancedDialog).getByRole('button', { name: 'Desbloquear' })).toBeTruthy()
  })
})
