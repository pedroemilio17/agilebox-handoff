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
    onMinimize: vi.fn(),
    onToggleExpand: vi.fn(),
    onClose: vi.fn(),
    onNewTask: vi.fn(),
    projects,
    selectedProjectId: agil.id,
    onProjectSelect: vi.fn(),
    onNewProject: vi.fn(),
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

/** Nomes acessíveis dos subitens do projeto (o grupo que contém "Quadro"), na ordem da tela. */
function subitemNames(): string[] {
  const group = screen.getByRole('button', { name: 'Quadro' }).parentElement
  if (!group) throw new Error('grupo de subitens não encontrado')
  return Array.from(group.querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent ?? '',
  )
}

describe('barra lateral conforme o design', () => {
  afterEach(cleanup)

  it('mostra o projeto selecionado com a metodologia de partida à direita', () => {
    const { nav } = renderShell()
    const selected = nav.getByRole('button', { name: /App de Chamados/ })
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(within(selected).getByText('Ágil')).toBeTruthy()
    expect(nav.getByText('Projeto')).toBeTruthy()
  })

  it('projeto criado sem o assistente não mostra rótulo de metodologia', () => {
    const { nav } = renderShell({ selectedProjectId: plain.id })
    const row = nav.getByRole('button', { name: /Sem assistente/ })
    expect(row.getAttribute('aria-pressed')).toBe('true')
    expect(row.textContent).not.toMatch(/Ágil|Trad\.|Kanban|Híbrido|Simples/)
  })

  it('subitens do ágil na ordem do design, com S4 e a contagem de módulos fora do nome', () => {
    const { nav } = renderShell()
    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Backlog' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Sprints' }).textContent).toContain('S4')
    expect(nav.getByRole('button', { name: 'Burndown' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Módulos' }).textContent).toContain('6')
    expect(subitemNames().slice(0, 5)).toEqual([
      'Quadro',
      'Backlog',
      'Sprints',
      'Burndown',
      'Entregas (EAP)',
    ])
  })

  it('subitens que dependem de módulo seguem o gate e não aparecem desligados', () => {
    const { nav } = renderShell({}, ['backlog'])
    expect(nav.queryByRole('button', { name: 'Burndown' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Sprints' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Entregas (EAP)' })).toBeNull()
    expect(nav.getByRole('button', { name: 'Backlog' })).toBeTruthy()
  })

  it('o item da tela atual leva aria-current', () => {
    const { nav } = renderShell({ view: 'backlog' })
    expect(nav.getByRole('button', { name: 'Backlog' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('button', { name: 'Quadro' }).getAttribute('aria-current')).toBeNull()
  })

  it('clicar num subitem chama a troca de tela', async () => {
    const { nav, props } = renderShell()
    await userEvent.click(nav.getByRole('button', { name: 'Backlog' }))
    expect(props.onViewChange).toHaveBeenCalledWith('backlog')
  })

  it('"Outros projetos" lista os demais com metodologia, e escolher um troca o projeto', async () => {
    const { nav, props } = renderShell()
    expect(nav.getByText('Outros projetos')).toBeTruthy()
    const other = nav.getByRole('button', { name: /Implantação ERP/ })
    expect(other.getAttribute('aria-pressed')).toBe('false')
    expect(within(other).getByText('Trad.')).toBeTruthy()
    await userEvent.click(other)
    expect(props.onProjectSelect).toHaveBeenCalledWith(traditional.id)
  })

  it('em "Outros projetos" há "Todos os projetos" para voltar à visão geral', async () => {
    const { nav, props } = renderShell()
    await userEvent.click(nav.getByRole('button', { name: 'Todos os projetos' }))
    expect(props.onProjectSelect).toHaveBeenCalledWith(null)
  })

  it('"Novo projeto" com + abre a criação', async () => {
    const { nav, props } = renderShell()
    await userEvent.click(nav.getByRole('button', { name: 'Novo projeto' }))
    expect(props.onNewProject).toHaveBeenCalledTimes(1)
  })

  it('sem projeto selecionado: "Todos os projetos" marcado, lista de projetos e subitens da organização', () => {
    const { nav } = renderShell({ selectedProjectId: null })
    // A seção "Todos os projetos" abre os subitens da organização; não há linha de projeto marcada.
    expect(nav.getByText('Todos os projetos')).toBeTruthy()
    expect(nav.queryByRole('button', { name: 'Todos os projetos' })).toBeNull()
    expect(nav.getByText('Projetos')).toBeTruthy()
    expect(nav.queryByText('Outros projetos')).toBeNull()
    expect(nav.getByRole('button', { name: /App de Chamados/ }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(nav.getByRole('button', { name: 'Quadro' })).toBeTruthy()
    expect(nav.getByRole('button', { name: 'Backlog' })).toBeTruthy()
    expect(nav.queryByRole('button', { name: 'Burndown' })).toBeNull()
    expect(nav.queryByRole('button', { name: 'Módulos' })).toBeNull()
  })

  it('Plug-ins segue em breve e desabilitado; Ajustes e a conta ficam no rodapé', () => {
    const { nav } = renderShell()
    const plugins = nav.getByRole('button', { name: 'Plug-ins, Em breve' })
    expect(plugins.hasAttribute('disabled')).toBe(true)
    expect(nav.getByRole('button', { name: 'Ajustes' })).toBeTruthy()
  })

  it('Início, Agenda e Dashboard ficam no topo, nessa ordem, antes do projeto', () => {
    const { nav } = renderShell()
    const top = nav.getByRole('button', { name: 'Início' }).parentElement!
    const labels = Array.from(top.querySelectorAll('button')).map(
      (button) => button.getAttribute('aria-label') ?? button.textContent ?? '',
    )
    expect(labels).toEqual(['Início', 'Agenda', 'Dashboard'])
  })

  it('o colaborador não vê Dashboard', () => {
    const { nav } = renderShell({ isManager: false })
    expect(nav.queryByRole('button', { name: 'Dashboard' })).toBeNull()
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
