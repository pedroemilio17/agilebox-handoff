import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CapabilitiesContext,
  type Capabilities,
} from '../../shared/capabilities/capabilities-context'
import { PanelShell, type PanelShellProps, type RailProject } from './PanelShell'

const agil: RailProject = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FA1',
  name: 'App de Chamados',
  startedFromPreset: 'agil',
}
const traditional: RailProject = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FA2',
  name: 'Implantação ERP',
  startedFromPreset: 'tradicional',
}
const plain: RailProject = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FA3',
  name: 'Sem assistente',
  startedFromPreset: null,
}
const projects = [agil, traditional, plain]

/** Capacidades de teste: a tela aparece só se o módulo estiver na lista. */
function capabilitiesWith(modules: readonly string[]): Capabilities {
  const set = new Set(modules)
  return {
    known: true,
    loading: false,
    can: () => true,
    showScreen: (moduleId) => moduleId === 'core' || set.has(moduleId),
    canFetch: () => true,
    isWindingDown: () => false,
  }
}

function renderShell(
  overrides: Partial<PanelShellProps> = {},
  modules: readonly string[] = [
    'backlog',
    'sprints',
    'burndown',
    'wbs',
    'milestones',
    'schedule',
    'impediments',
    'agenda',
  ],
) {
  const props: PanelShellProps = {
    view: 'projects',
    isManager: true,
    onViewChange: vi.fn(),
    onBack: vi.fn(),
    canGoBack: false,
    onMinimize: vi.fn(),
    onToggleExpand: vi.fn(),
    onClose: vi.fn(),
    onNewTask: vi.fn(),
    projects,
    selectedProjectId: agil.id,
    onProjectSelect: vi.fn(),
    onNewProject: vi.fn(),
    onOpenTray: vi.fn(),
    activeSprintNumber: 4,
    projectModuleCount: 6,
    ...overrides,
  }
  render(
    <CapabilitiesContext.Provider value={capabilitiesWith(modules)}>
      <PanelShell {...props}>
        <p>Conteúdo</p>
      </PanelShell>
    </CapabilitiesContext.Provider>,
  )
  return { props, nav: within(screen.getByRole('navigation', { name: 'Navegação principal' })) }
}

/** Nomes acessíveis dos sub-itens do projeto ativo (o grupo que contém "Quadro"), na ordem da tela. */
function subitemNames(): string[] {
  const group = screen.getByRole('button', { name: 'Quadro' }).parentElement
  if (!group) throw new Error('grupo de subitens não encontrado')
  return Array.from(group.querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent ?? '',
  )
}

describe('barra lateral estilo Claude e cabeçalho revisado', () => {
  afterEach(cleanup)

  it('mostra a seção unificada Projetos + e destaca o projeto selecionado com acordeão aberto', () => {
    const { nav } = renderShell()
    expect(nav.getByText('Projetos')).toBeTruthy()
    expect(nav.queryByText('Outros projetos')).toBeNull()
    const selected = nav.getByRole('button', { name: /App de Chamados/ })
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(selected.getAttribute('aria-expanded')).toBe('true')
    expect(within(selected).getByText('Ágil')).toBeTruthy()
  })

  it('recolhe e reabre o acordeão ao clicar no cabeçalho do projeto já selecionado', async () => {
    const { nav } = renderShell()
    const toggle = nav.getByRole('button', { name: /App de Chamados/ })
    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()

    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(nav.queryByRole('button', { name: 'Quadro' })).toBeNull()

    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()
  })

  it('projeto criado sem o assistente não mostra rótulo de metodologia', () => {
    const { nav } = renderShell({ selectedProjectId: plain.id })
    const row = nav.getByRole('button', { name: /Sem assistente/ })
    expect(row.getAttribute('aria-pressed')).toBe('true')
    expect(row.textContent).not.toMatch(/Ágil|Trad\.|Kanban|Híbrido|Simples/)
  })

  it('consolida em no máximo 6 sub-itens na árvore, com S4 e contagem fora do nome acessível', () => {
    const { nav } = renderShell()
    expect(subitemNames()).toEqual([
      'Quadro',
      'Backlog',
      'Sprints',
      'Entregas',
      'Cronograma',
      'Configurações',
    ])
    expect(nav.getByRole('button', { name: 'Sprints' }).textContent).toContain('S4')
    expect(nav.getByRole('button', { name: 'Configurações' }).textContent).toContain('6')
  })

  it('sub-itens seguem o gate dos módulos sem mostrar o que está desligado', () => {
    const { nav } = renderShell({}, ['backlog'])
    expect(subitemNames()).toEqual(['Quadro', 'Backlog', 'Configurações'])
    expect(nav.queryByRole('button', { name: 'Sprints' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Entregas' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Cronograma' })).toBeNull()
  })

  it('exibe TopicTabs nas telas consolidadas e destaca o grupo pai na árvore', async () => {
    const { nav, props } = renderShell({ view: 'burndown', burndown: <p>Burndown tela</p> })
    expect(nav.getByRole('button', { name: 'Sprints' }).getAttribute('aria-current')).toBe('page')
    const tabs = within(screen.getByRole('navigation', { name: 'Seções de Sprints' }))
    expect(tabs.getByRole('button', { name: 'Burndown' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Burndown tela')).toBeTruthy()

    await userEvent.click(tabs.getByRole('button', { name: 'Impedimentos' }))
    expect(props.onViewChange).toHaveBeenCalledWith('impediments')
  })

  it('o item da tela atual leva aria-current; planSprint destaca Entregas sem exibir TopicTabs', () => {
    const { nav } = renderShell({ view: 'backlog', backlog: <p>Backlog tela</p> })
    expect(nav.getByRole('button', { name: 'Backlog' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('button', { name: 'Quadro' }).getAttribute('aria-current')).toBeNull()
    cleanup()

    const inSprint = renderShell({ view: 'planSprint', planSprint: <p>Sprint na entrega</p> })
    expect(
      inSprint.nav.getByRole('button', { name: 'Entregas' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.queryByRole('navigation', { name: 'Seções de Entregas' })).toBeNull()
    expect(screen.getByText('Sprint na entrega')).toBeTruthy()
  })

  it('lista outros projetos na mesma seção e clicar troca o projeto', async () => {
    const { nav, props } = renderShell()
    const other = nav.getByRole('button', { name: /Implantação ERP/ })
    expect(other.getAttribute('aria-pressed')).toBe('false')
    expect(other.getAttribute('aria-expanded')).toBe('false')
    expect(within(other).getByText('Trad.')).toBeTruthy()
    await userEvent.click(other)
    expect(props.onProjectSelect).toHaveBeenCalledWith(traditional.id)
  })

  it('clicar em Todos os projetos chama onProjectSelect(null)', async () => {
    const { nav, props } = renderShell()
    await userEvent.click(nav.getByRole('button', { name: 'Todos os projetos' }))
    expect(props.onProjectSelect).toHaveBeenCalledWith(null)
  })

  it('botão + de Novo projeto abre a criação', async () => {
    const { nav, props } = renderShell()
    await userEvent.click(nav.getByRole('button', { name: 'Novo projeto' }))
    expect(props.onNewProject).toHaveBeenCalledTimes(1)
  })

  it('sem projeto selecionado: Todos os projetos fica marcado e expandido sem Configurações', () => {
    const { nav } = renderShell({ selectedProjectId: null })
    const allBtn = nav.getByRole('button', { name: 'Todos os projetos' })
    expect(allBtn.getAttribute('aria-pressed')).toBe('true')
    expect(allBtn.getAttribute('aria-expanded')).toBe('true')
    expect(nav.getByRole('button', { name: /App de Chamados/ }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(subitemNames()).toEqual(['Quadro', 'Backlog', 'Sprints'])
  })

  it('TitleBar exibe Voltar e breadcrumb em telas do projeto e omite projeto em telas globais', async () => {
    const { props } = renderShell({ view: 'backlog', canGoBack: true, backlog: <p>B</p> })
    const banner = within(screen.getByRole('banner'))
    expect(banner.getByText('App de Chamados')).toBeTruthy()
    expect(banner.getByRole('heading', { level: 1, name: 'Backlog' })).toBeTruthy()
    const back = banner.getByRole<HTMLButtonElement>('button', { name: 'Voltar' })
    expect(back.disabled).toBe(false)
    await userEvent.click(back)
    expect(props.onBack).toHaveBeenCalledTimes(1)
    cleanup()

    renderShell({ view: 'dashboard', canGoBack: false, dashboard: <p>Dash</p> })
    const dashBanner = within(screen.getByRole('banner'))
    expect(dashBanner.queryByText('App de Chamados')).toBeNull()
    expect(dashBanner.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(dashBanner.getByRole<HTMLButtonElement>('button', { name: 'Voltar' }).disabled).toBe(
      true,
    )
  })

  it('Global exibe Dashboard e Agenda nessa ordem; colaborador não vê Dashboard', () => {
    const { nav } = renderShell()
    const top = nav.getByRole('button', { name: 'Dashboard' }).parentElement!
    const labels = Array.from(top.querySelectorAll('button')).map(
      (button) => button.getAttribute('aria-label') ?? button.textContent ?? '',
    )
    expect(labels).toEqual(['Dashboard', 'Agenda'])
    cleanup()

    const collab = renderShell({ isManager: false })
    expect(collab.nav.queryByRole('button', { name: 'Dashboard' })).toBeNull()
  })

  it('Plug-ins, Ajustes e Abrir Bandeja ficam no rodapé', async () => {
    const { nav, props } = renderShell()
    const plugins = nav.getByRole('button', { name: 'Plug-ins, Em breve' })
    expect(plugins.hasAttribute('disabled')).toBe(true)
    expect(nav.getByRole('button', { name: 'Ajustes' })).toBeTruthy()
    await userEvent.click(nav.getByRole('button', { name: 'Abrir Bandeja' }))
    expect(props.onOpenTray).toHaveBeenCalledTimes(1)
  })

  it('recolher a barra mantém os itens e troca o rótulo do botão', async () => {
    const { nav } = renderShell()
    const toggle = screen.getByRole('button', { name: 'Recolher barra lateral' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(toggle)
    expect(
      screen.getByRole('button', { name: 'Expandir barra lateral' }).getAttribute('aria-expanded'),
    ).toBe('false')
    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()
  })
})
