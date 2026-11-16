import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import {
  forbiddenTermsIn,
  PASSIVE_IMPEDIMENT_TERMS,
  PASSIVE_TOOL_TERMS,
  visibleTextOf,
} from '../shared/testing/forbidden-terms'
import {
  FLOW_TASK_WITH_PLANNING,
  installFlowApi,
  managerDashboard,
  stubDesktopBridge,
} from '../shared/testing/flow-backend'
import { App } from './App'
import { panelCopy } from './copy'

/**
 * Preset Scrum no nível Básico: os módulos de Scrum estão ativos, mas acima do nível. Só os efeitos
 * passivos aparecem (marcador de bloqueio, filtro de bloqueadas), sem o botão de bloquear e sem as
 * telas de planejamento. Na tela de ferramentas, o aviso de nível aparece para cada módulo acima.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CARD = /^AB-118 · /
const PASSIVE_SOURCES = [...PASSIVE_IMPEDIMENT_TERMS, ...PASSIVE_TOOL_TERMS].map(
  (term) => term.source,
)

function renderScrumBasic(role: 'collaborator' | 'manager' = 'collaborator') {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  const flow = installFlowApi(api, {
    role,
    tools: teamToolsView({ modules: presetModules('scrum'), level: 'basic', role }),
    tasks: [FLOW_TASK_WITH_PLANNING],
    dashboard: managerDashboard(),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { user: userEvent.setup(), ...flow }
}

/** Só os efeitos passivos (impedimento, critérios e estimativa) podem aparecer; o resto de Scrum é falha. */
function expectOnlyPassiveTerms(skip?: Element) {
  const found = forbiddenTermsIn(visibleTextOf(document.body, skip))
  expect(found.filter((source) => !PASSIVE_SOURCES.includes(source))).toEqual([])
}

describe('Scrum no Básico · efeitos passivos sem a tela', () => {
  it('o quadro mostra o marcador e o filtro de bloqueio, sem o medidor de WIP nem fluxo', async () => {
    renderScrumBasic()

    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: CARD }).getAttribute('aria-label')).toContain(
      'bloqueada',
    )
    expect(screen.queryByRole('img', { name: /: \d+ de \d+/ })).toBeNull()
    expect(screen.queryByText(/Ciclo médio desta semana/)).toBeNull()
    expectOnlyPassiveTerms()
  })

  it('o detalhe mostra o motivo do bloqueio, sem Bloquear, Desbloquear nem Subtarefas', async () => {
    const { user } = renderScrumBasic()

    await user.click(await screen.findByRole('button', { name: CARD }))
    const dialog = await screen.findByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })
    expect(within(dialog).getByText('Aguardando API')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Bloquear' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Desbloquear' })).toBeNull()
    expect(within(dialog).queryByRole('region', { name: 'Subtarefas' })).toBeNull()
    // Critérios e estimativa: o marcador no card é passivo, mas a tela não existe no Básico.
    expect(within(dialog).queryByRole('region', { name: 'Critérios de aceitação' })).toBeNull()
    expect(within(dialog).queryByRole('group', { name: 'Estimativa (h)' })).toBeNull()
    expectOnlyPassiveTerms(dialog)
  })

  it('Ajustes avisa o nível de cada ferramenta acima do Básico; o colaborador só lê', async () => {
    const { user } = renderScrumBasic()

    await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
    const team = screen.getByRole('region', { name: panelCopy.teamToolsTitle })
    const notes = within(team)
      .getAllByRole('note')
      .map((note) => note.textContent)
    expect(notes).toContain(panelCopy.teamToolsLevelWarning('Sprints', 'Intermediário'))
    expect(notes).toContain(panelCopy.teamToolsLevelWarning('Backlog', 'Intermediário'))
    expect(within(team).getByText(panelCopy.teamToolsReadOnly)).toBeTruthy()
    expect(within(team).queryByRole('button', { name: /Subir para/ })).toBeNull()
  })

  it('o gestor vê o mesmo aviso e o botão para subir o nível da equipe', async () => {
    const { user } = renderScrumBasic('manager')

    await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
    const team = screen.getByRole('region', { name: panelCopy.teamToolsTitle })
    expect(
      within(team).getByRole('button', { name: panelCopy.teamToolsLevelRaise('Intermediário') }),
    ).toBeTruthy()
  })

  it('o dashboard do gestor mostra o bloqueio passivo, sem WIP, daily nem fluxo', async () => {
    const { user } = renderScrumBasic('manager')

    await user.click(await screen.findByRole('button', { name: 'Dashboard' }))
    expect(await screen.findByRole('button', { name: /^Bloqueadas/ })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Colunas acima do limite' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Fluxo de seis semanas' })).toBeNull()
    expect(screen.queryByText(/Daily de hoje/)).toBeNull()
    expectOnlyPassiveTerms()
  })
})
