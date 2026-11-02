import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SidebarScreenId } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { PanelShell } from './PanelShell'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderShell(screens?: readonly SidebarScreenId[]) {
  const onViewChange = vi.fn()
  render(
    <PanelShell
      view="projects"
      managerContext={null}
      onViewChange={onViewChange}
      onMinimize={() => undefined}
      onToggleExpand={() => undefined}
      onClose={() => undefined}
      onNewTask={() => undefined}
      {...(screens ? { screens } : {})}
    >
      <p>Conteúdo do quadro</p>
    </PanelShell>,
  )
  return {
    nav: within(screen.getByRole('navigation', { name: 'Navegação principal' })),
    onViewChange,
  }
}

/** Como o servidor devolve para um colaborador no nível Padrão, com Backlog e Sprints ligados. */
const COLLABORATOR_STANDARD: readonly SidebarScreenId[] = [
  'projects',
  'agenda',
  'backlog',
  'sprints',
]

describe('barra lateral por nível, papel e ferramentas', () => {
  it('colaborador não vê Ferramentas nem Dashboard', () => {
    const { nav } = renderShell(COLLABORATOR_STANDARD)

    expect(nav.queryByRole('button', { name: 'Ferramentas' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Dashboard' })).toBeNull()
    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()
  })

  it('Essencial não vê Backlog, Sprints nem Dashboard', () => {
    const { nav } = renderShell(['projects', 'agenda'])

    expect(nav.queryByRole('button', { name: 'Backlog' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Sprints' })).toBeNull()
    expect(nav.getByRole('button', { name: 'Agenda' })).toBeTruthy()
  })

  it('módulo desligado não aparece no menu', () => {
    // Agenda desligada: o servidor não a inclui, mesmo que o nível libere.
    const { nav } = renderShell(['projects', 'backlog', 'sprints', 'dashboard'])

    expect(nav.queryByRole('button', { name: 'Agenda' })).toBeNull()
    expect(nav.getByRole('button', { name: 'Backlog' })).toBeTruthy()
  })

  it('gestor no Avançado vê Impedimentos, Integrações e Ferramentas', () => {
    const { nav } = renderShell([
      'projects',
      'agenda',
      'backlog',
      'sprints',
      'dashboard',
      'impediments',
      'integrations',
      'tools',
    ])

    expect(nav.getByRole('button', { name: 'Impedimentos' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Integrações' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Ferramentas' })).toBeTruthy()
  })

  it('mantém Plug-ins como item desabilitado com a dica "em breve"', () => {
    const { nav } = renderShell(['projects'])

    const plugins = nav.getByRole('button', { name: /Plug-ins, Em breve/ })
    expect(plugins.hasAttribute('disabled')).toBe(true)
    expect(plugins.textContent).toContain('Em breve')
  })

  it('antes de o servidor responder, mostra só Quadro e Agenda', () => {
    const { nav } = renderShell()

    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Agenda' })).toBeTruthy()
    expect(nav.queryByRole('button', { name: 'Backlog' })).toBeNull()
  })

  it('leva para Quadro quando a tela atual não está liberada', () => {
    const onViewChange = vi.fn()
    render(
      <PanelShell
        view="dashboard"
        managerContext={null}
        onViewChange={onViewChange}
        onMinimize={() => undefined}
        onToggleExpand={() => undefined}
        onClose={() => undefined}
        onNewTask={() => undefined}
        screens={COLLABORATOR_STANDARD}
        dashboard={<p>Conteúdo do painel do gestor</p>}
      >
        <p>Conteúdo do quadro</p>
      </PanelShell>,
    )

    // Prova o conteúdo na área principal, não só o rótulo do menu.
    expect(screen.getByText('Conteúdo do quadro')).toBeTruthy()
    expect(screen.queryByText('Conteúdo do painel do gestor')).toBeNull()
    expect(screen.getByRole('button', { name: 'Quadro' }).getAttribute('aria-current')).toBe('page')
  })

  it('clicar em Backlog troca a tela', async () => {
    const { nav, onViewChange } = renderShell(COLLABORATOR_STANDARD)

    await userEvent.click(nav.getByRole('button', { name: 'Backlog' }))

    expect(onViewChange).toHaveBeenCalledWith('backlog')
  })
})

describe('Ferramentas na área principal (M2.10a)', () => {
  const MANAGER_ADVANCED: readonly SidebarScreenId[] = [
    'projects',
    'agenda',
    'backlog',
    'sprints',
    'dashboard',
    'impediments',
    'integrations',
    'tools',
  ]

  /** Renderiza a shell com a API falsa, porque a tela Ferramentas lê o time pela API. */
  function renderToolsShell(screens: readonly SidebarScreenId[]) {
    // A prévia da tela Ferramentas consulta a preferência de movimento; o jsdom não tem matchMedia.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    const api = createFakeApi()
    vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
      userId: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
      organizationId: '01J8Y4G2XK8Z1S6M3Q9W0A5G01',
      role: 'manager',
    })
    vi.spyOn(api.teamModules, 'get').mockResolvedValue({
      level: 'advanced',
      screens: [...screens],
      statuses: [
        { moduleId: 'core', state: 'active' },
        { moduleId: 'agenda', state: 'active' },
      ],
    })
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <PanelShell
            view="tools"
            managerContext={null}
            screens={screens}
            onViewChange={() => undefined}
            onMinimize={() => undefined}
            onToggleExpand={() => undefined}
            onClose={() => undefined}
            onNewTask={() => undefined}
          >
            <p>Conteúdo do quadro</p>
          </PanelShell>
        </QueryProvider>
      </ApiProvider>,
    )
  }

  it('gestor no Avançado abre a tela Ferramentas no lugar do Quadro', async () => {
    renderToolsShell(MANAGER_ADVANCED)

    expect(await screen.findByRole('switch', { name: 'Agenda' })).toBeTruthy()
    expect(screen.queryByText('Conteúdo do quadro')).toBeNull()
  })

  it('sem a liberação do servidor, Ferramentas não aparece e o Quadro segue na área', () => {
    renderToolsShell(['projects', 'agenda'])

    expect(screen.getByText('Conteúdo do quadro')).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
