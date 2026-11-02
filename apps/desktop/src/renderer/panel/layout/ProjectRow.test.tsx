import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { PanelShell, type SidebarProject } from './PanelShell'

const ME = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const OTHER = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const AURORA = '01J8Y4G2XK8Z1S6M3Q9W0AUR1'
const BETA = '01J8Y4G2XK8Z1S6M3Q9W0BET1'

const PROJECTS: readonly SidebarProject[] = [
  { id: AURORA, name: 'Projeto Aurora', createdBy: ME },
  { id: BETA, name: 'Projeto Beta', createdBy: OTHER },
]

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup(
  options: {
    readonly selected?: string | null
    readonly canManageProject?: (project: SidebarProject) => boolean
  } = {},
) {
  const api = createFakeApi()
  const archive = vi.spyOn(api.projects, 'archiveProject').mockResolvedValue(undefined)
  const unarchive = vi.spyOn(api.projects, 'unarchiveProject').mockResolvedValue(undefined)
  const rename = vi.spyOn(api.projects, 'renameProject').mockImplementation(({ projectId, name }) =>
    Promise.resolve({
      id: projectId,
      name,
      createdBy: ME,
      createdAt: '2026-10-31T12:00:00.000Z',
    }),
  )
  const onProjectSelect = vi.fn()
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <PanelShell
          view="projects"
          managerContext={null}
          onViewChange={() => undefined}
          onMinimize={() => undefined}
          onToggleExpand={() => undefined}
          onClose={() => undefined}
          onNewTask={() => undefined}
          projects={PROJECTS}
          selectedProjectId={options.selected ?? null}
          onProjectSelect={onProjectSelect}
          account={{ users: [], currentUserId: ME, onSwitch: () => undefined }}
          {...(options.canManageProject ? { canManageProject: options.canManageProject } : {})}
        >
          <p>Conteúdo do quadro</p>
        </PanelShell>
      </QueryProvider>
    </ApiProvider>,
  )
  const nav = within(screen.getByRole('navigation', { name: 'Navegação principal' }))
  return { api, archive, unarchive, rename, onProjectSelect, nav, user: userEvent.setup() }
}

/** O aviso de desfazer (role=status), achado pelo texto: o subtotal de custo também é um `output`. */
async function findToast(text: RegExp): Promise<HTMLElement> {
  const element = await screen.findByText(text)
  const toast = element.closest<HTMLElement>('[role="status"]')
  if (!toast) throw new Error('aviso fora de role=status')
  return toast
}

describe('menu do projeto na barra lateral (M2.12)', () => {
  it('o projeto de quem criou tem ⋯ com nome acessível; o de outra pessoa não tem', () => {
    const { nav } = setup()

    expect(
      nav
        .getByRole('button', { name: 'Ações do projeto Projeto Aurora' })
        .getAttribute('aria-haspopup'),
    ).toBe('menu')
    expect(nav.queryByRole('button', { name: 'Ações do projeto Projeto Beta' })).toBeNull()
  })

  it('o menu traz Renomear com F2 e Arquivar', async () => {
    const { nav, user } = setup()

    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))

    const menu = screen.getByRole('menu', { name: 'Ações do projeto Projeto Aurora' })
    expect(within(menu).getByRole('menuitem', { name: /Renomear/ })).toHaveTextContent('F2')
    expect(within(menu).getByRole('menuitem', { name: /Arquivar/ })).toBeInTheDocument()
  })

  it('pelo teclado, Enter no ⋯ abre o menu com o foco no primeiro item', async () => {
    const { nav, user } = setup()
    const trigger = nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' })
    trigger.focus()

    await user.keyboard('{Enter}')

    expect(screen.getByRole('menuitem', { name: /Renomear/ })).toHaveFocus()
  })

  it('a permissão vem de fora quando a tela passa canManageProject', () => {
    const { nav } = setup({ canManageProject: () => true })

    expect(nav.getByRole('button', { name: 'Ações do projeto Projeto Beta' })).toBeInTheDocument()
  })

  it('quem não criou o projeto não consegue renomear com F2', () => {
    const { nav } = setup()
    const beta = nav.getByRole('button', { name: /^Projeto Beta/ })
    beta.focus()

    fireEvent.keyDown(beta, { key: 'F2' })

    expect(screen.queryByRole('textbox', { name: 'Nome do projeto' })).toBeNull()
  })
})

describe('renomear projeto no lugar', () => {
  it('F2 no nome abre o campo com o texto selecionado', async () => {
    const { nav } = setup()
    const project = nav.getByRole('button', { name: /^Projeto Aurora/ })
    project.focus()

    fireEvent.keyDown(project, { key: 'F2' })

    const field = await screen.findByRole('textbox', { name: 'Nome do projeto' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('Projeto Aurora')
  })

  it('Enter grava o novo nome pela API', async () => {
    const { nav, rename, user } = setup()
    nav.getByRole('button', { name: /^Projeto Aurora/ }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'F2' })
    const field = await screen.findByRole('textbox', { name: 'Nome do projeto' })
    await user.clear(field)
    await user.type(field, 'Aurora 2{Enter}')

    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith({ projectId: AURORA, name: 'Aurora 2' }),
    )
    expect(screen.queryByRole('textbox', { name: 'Nome do projeto' })).toBeNull()
  })

  it('Esc cancela e não chama a API', async () => {
    const { nav, rename, user } = setup()
    nav.getByRole('button', { name: /^Projeto Aurora/ }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'F2' })
    const field = await screen.findByRole('textbox', { name: 'Nome do projeto' })
    await user.clear(field)
    await user.type(field, 'Descartado')

    await user.keyboard('{Escape}')

    expect(rename).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Nome do projeto' })).toBeNull()
    expect(nav.getByRole('button', { name: /^Projeto Aurora/ })).toBeInTheDocument()
  })

  it('nome vazio não grava', async () => {
    const { nav, rename, user } = setup()
    nav.getByRole('button', { name: /^Projeto Aurora/ }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'F2' })
    const field = await screen.findByRole('textbox', { name: 'Nome do projeto' })
    await user.clear(field)

    await user.keyboard('{Enter}')

    expect(rename).not.toHaveBeenCalled()
  })

  it('escolher Renomear no menu abre o campo com o foco', async () => {
    const { nav, user } = setup()
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))

    await user.click(screen.getByRole('menuitem', { name: /Renomear/ }))

    expect(await screen.findByRole('textbox', { name: 'Nome do projeto' })).toHaveFocus()
  })
})

describe('arquivar projeto na barra lateral', () => {
  it('Arquivar no menu chama a API, mostra Desfazer e tira a seleção se ele estava aberto', async () => {
    const { nav, archive, onProjectSelect, user } = setup({ selected: AURORA })
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))

    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))

    await waitFor(() => expect(archive).toHaveBeenCalledWith({ projectId: AURORA }))
    expect(onProjectSelect).toHaveBeenCalledWith(null)
    const toast = await findToast(/Projeto “Projeto Aurora” arquivado/)
    expect(toast).toHaveTextContent('Desfazer')
  })

  it('não pede confirmação: arquivar sem seleção não tira nada', async () => {
    const { nav, archive, onProjectSelect, user } = setup({ selected: BETA })
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))

    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))

    await waitFor(() => expect(archive).toHaveBeenCalledWith({ projectId: AURORA }))
    expect(onProjectSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Desfazer no aviso devolve o projeto pela API', async () => {
    const { nav, unarchive, user } = setup()
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))
    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))
    const toast = await findToast(/Projeto “Projeto Aurora” arquivado/)

    await user.click(within(toast).getByRole('button', { name: /Desfazer/ }))

    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ projectId: AURORA }))
  })

  it('Ctrl Z devolve o projeto arquivado', async () => {
    const { nav, unarchive, user } = setup()
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))
    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))
    await findToast(/Projeto “Projeto Aurora” arquivado/)

    await user.keyboard('{Control>}z{/Control}')

    await waitFor(() => expect(unarchive).toHaveBeenCalledWith({ projectId: AURORA }))
  })

  it('se a API recusar, mostra o erro na barra lateral', async () => {
    const { nav, archive, user } = setup()
    archive.mockRejectedValueOnce(new Error('falhou'))
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))

    await user.click(screen.getByRole('menuitem', { name: /Arquivar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível arquivar')
    expect(screen.queryByText(/Projeto “Projeto Aurora” arquivado/)).toBeNull()
  })
})

describe('fechar o menu do projeto (M2.12-fix)', () => {
  it('clicar fora fecha o menu', async () => {
    const { nav, user } = setup()
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(document.body)

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('o foco indo para fora da linha fecha o menu', async () => {
    const { nav, user } = setup()
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))
    const outside = nav.getByRole('button', { name: 'Todos os projetos' })

    act(() => outside.focus())

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('abrir o menu de outro projeto fecha o que estava aberto', async () => {
    const { nav, user } = setup({ canManageProject: () => true })
    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' }))

    await user.click(nav.getByRole('button', { name: 'Ações do projeto Projeto Beta' }))

    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(screen.getByRole('menu', { name: 'Ações do projeto Projeto Beta' })).toBeInTheDocument()
  })

  it('clicar de novo no ⋯ aberto fecha o menu', async () => {
    const { nav, user } = setup()
    const trigger = nav.getByRole('button', { name: 'Ações do projeto Projeto Aurora' })
    await user.click(trigger)

    await user.click(trigger)

    expect(screen.queryByRole('menu')).toBeNull()
  })
})
