import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import {
  FLOW_PROJECT,
  FLOW_TASK_WITH_PLANNING,
  installFlowApi,
  stubDesktopBridge,
  toTaskDto,
} from '../../shared/testing/flow-backend'
import { renderPanel, settleCapabilities } from '../../shared/testing/render-panel'
import { TaskRow } from '../../tray/screens/TaskRow'
import { App } from '../App'
import { sprintCopy } from './sprint-copy'

/**
 * Integração no painel: item de menu, atalho G S, capacidades por preset e nível, filtro Sprint
 * ativa e o marcador "Sprint N" no card, no Backlog, no detalhe e na bandeja.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const KANBAN = presetModules('kanban')
const SCRUM = presetModules('scrum')
const SPRINT_ID = '01J8Y4G2XK8Z1S6M3Q9W0S004'

/** Cartão com a sprint aberta, como o servidor devolve com o módulo ligado. */
const IN_SPRINT = {
  ...FLOW_TASK_WITH_PLANNING,
  sprint: { id: SPRINT_ID, number: 4, name: 'Sprint 4', status: 'active' as const },
}

function renderApp(
  modules: readonly string[],
  level: 'basic' | 'intermediate' | 'advanced' = 'intermediate',
  setup: (api: ReturnType<typeof createFakeApi>) => void = () => undefined,
) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  const tools = teamToolsView({
    modules: modules as never,
    level,
    role: 'manager',
  })
  installFlowApi(api, { role: 'manager', tools, tasks: [IN_SPRINT] })
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([])
  vi.spyOn(api.sprints, 'list').mockResolvedValue([])
  vi.spyOn(api.backlog, 'list').mockResolvedValue([])
  setup(api)
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

const cardLabel = async () =>
  (await screen.findByRole('button', { name: /^AB-118 · / })).getAttribute('aria-label') ?? ''

describe('Sprints no menu e nos atalhos, por ferramenta e nível', () => {
  it('Kanban simples · Básico: sem item, sem atalho e sem filtro de sprint', async () => {
    const { user, api } = renderApp(KANBAN, 'basic')
    await settleCapabilities(api)
    expect(screen.queryByRole('button', { name: 'Sprints' })).toBeNull()
    await user.keyboard('gs')
    expect(screen.queryByRole('region', { name: sprintCopy.title })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Sprint ativa/ })).toBeNull()
    expect(await cardLabel()).not.toMatch(/Sprint/)
  })

  it('Scrum · Básico: o item de menu aparece, sem o filtro Sprint ativa, e o marcador "Sprint 4" no card', async () => {
    const { api, user } = renderApp(SCRUM, 'basic')
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: /Projeto Aurora/ }))
    expect(screen.getByRole('button', { name: 'Sprints' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Sprint ativa/ })).toBeNull()
    expect(await cardLabel()).toMatch(/Sprint 4/)
    expect(screen.getByText('Sprint 4')).toBeTruthy()
  })

  it('Scrum · Intermediário: item de menu e atalho G S', async () => {
    const { user } = renderApp(SCRUM, 'intermediate')
    await user.click(await screen.findByRole('button', { name: /Projeto Aurora/ }))
    await user.click(await screen.findByRole('button', { name: 'Sprints' }))
    expect(await screen.findByRole('region', { name: sprintCopy.title })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await user.keyboard('gs')
    expect(await screen.findByRole('region', { name: sprintCopy.title })).toBeTruthy()
  })
})

describe('Marcador "Sprint N" nas superfícies', () => {
  it('no detalhe da tarefa, como propriedade passiva', async () => {
    const { user, api } = renderApp(SCRUM, 'basic')
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: /^AB-118 · / }))
    const dialog = await screen.findByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })
    await user.click(within(dialog).getByRole('button', { name: /^Pessoas & Prazo/ }))
    const row = within(dialog).getByRole('group', { name: sprintCopy.sprintProperty })
    expect(within(row).getByText('Sprint 4')).toBeTruthy()
  })

  it('no Backlog, na linha do item', async () => {
    const { user, api } = renderApp(SCRUM, 'intermediate', (api) => {
      vi.spyOn(api.backlog, 'list').mockResolvedValue([
        toTaskDto({ ...IN_SPRINT, inBacklog: true }),
      ])
    })
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: /Projeto Aurora/ }))
    await user.click(await screen.findByRole('button', { name: 'Backlog' }))
    expect(await screen.findByText('Sprint 4')).toBeTruthy()
  })

  it('na bandeja, na linha da tarefa', () => {
    const api = createFakeApi()
    vi.spyOn(api.teamTools, 'get').mockResolvedValue(
      teamToolsView({ modules: [...SCRUM], level: 'basic', role: 'manager' }),
    )
    renderPanel(
      <ul>
        <TaskRow
          task={toTaskDto(IN_SPRINT)}
          now={new Date('2026-11-16T12:00:00Z')}
          highlighted={false}
          onOpen={() => undefined}
        />
      </ul>,
      { api },
    )
    expect(screen.getByText(/Sprint 4/)).toBeTruthy()
  })

  it('nada aparece com o módulo desligado (DTO sem sprint)', async () => {
    const { api } = renderApp(KANBAN, 'advanced')
    await settleCapabilities(api)
    expect(await cardLabel()).not.toMatch(/Sprint/)
  })

  it('mover para Concluído na sprint ativa aciona a conferência da Definição de pronto', async () => {
    const DOD_ITEM_ID = '01J8Y4G2XK8Z1S6M3Q9W0DOD01'
    const activeSprint = {
      id: SPRINT_ID,
      projectId: FLOW_PROJECT.id,
      number: 4,
      label: 'Sprint 4',
      name: 'Sprint 4',
      goal: null,
      plannedStart: '2026-11-10',
      plannedEnd: '2026-11-24',
      status: 'active' as const,
      startedAt: '2026-11-10T10:00:00.000Z',
      closedAt: null,
      closePolicy: null,
      createdBy: FLOW_PROJECT.createdBy,
      createdAt: '2026-10-31T12:00:00.000Z',
    }
    const { user, api } = renderApp(SCRUM, 'intermediate', (fakeApi) => {
      vi.spyOn(fakeApi.projects, 'list').mockResolvedValue([
        { ...FLOW_PROJECT, definitionOfDoneCount: 1 },
      ])
      vi.spyOn(fakeApi.projects.definitionOfDone, 'list').mockResolvedValue([
        { id: DOD_ITEM_ID, projectId: FLOW_PROJECT.id, title: 'Revisado por par', position: 0 },
      ])
      vi.spyOn(fakeApi.sprints, 'list').mockResolvedValue([activeSprint])
      vi.spyOn(fakeApi.sprints, 'get').mockResolvedValue({
        sprint: activeSprint,
        items: [toTaskDto(IN_SPRINT)],
        history: [],
      })
    })
    const move = vi
      .spyOn(api.tasks, 'move')
      .mockResolvedValue(toTaskDto({ ...IN_SPRINT, status: 'done' }))
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: /Projeto Aurora/ }))
    await user.click(await screen.findByRole('button', { name: 'Sprints' }))
    // A sprint ativa já é o primeiro tópico do rail; clicar nele confirma o tópico.
    await user.click(await screen.findByRole('button', { name: 'Sprint ativa' }))
    await user.selectOptions(
      await screen.findByRole('combobox', {
        name: `Mover ${IN_SPRINT.title} para outro estado`,
      }),
      'done',
    )

    const dialog = await screen.findByRole('dialog', {
      name: `${IN_SPRINT.key} · ${IN_SPRINT.title}`,
    })
    expect(move).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Revisado por par' }))
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith({
        taskId: IN_SPRINT.id,
        status: 'done',
        confirmedDefinitionItemIds: [DOD_ITEM_ID],
      }),
    )
  })
})
