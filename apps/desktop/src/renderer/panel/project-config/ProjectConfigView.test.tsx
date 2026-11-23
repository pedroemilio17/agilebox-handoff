import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto, SessionUserDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import {
  CapabilitiesContext,
  type Capabilities,
} from '../../shared/capabilities/capabilities-context'
import { createFakeApi } from '../../shared/testing/fake-api'
import { projectModulesView } from '../../shared/testing/project-modules-fixture'
import { panelCopy } from '../copy'
import { ProjectConfigView } from './ProjectConfigView'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const AURORA_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5BC1'
const BOREAL_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5BC2'
const ANA_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const BRUNO_ID = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'

const AURORA: ProjectDto = {
  id: AURORA_ID,
  name: 'Projeto Aurora',
  createdBy: ANA_ID,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: null,
}

const BOREAL: ProjectDto = {
  id: BOREAL_ID,
  name: 'Projeto Boreal',
  createdBy: BRUNO_ID,
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
  archivedAt: null,
}

const USERS: SessionUserDto[] = [
  { id: ANA_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: null },
  { id: BRUNO_ID, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: null },
]

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

function renderConfig({
  project = AURORA,
  canManage = true,
  modules = ['backlog', 'definitionOfDone'],
}: {
  readonly project?: ProjectDto | null
  readonly canManage?: boolean
  readonly modules?: readonly string[]
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(USERS)
  vi.spyOn(api.projectModules, 'get').mockResolvedValue(
    projectModulesView({ enabled: ['backlog'], canManage, projectId: project?.id ?? AURORA_ID }),
  )
  vi.spyOn(api.projects, 'listMembers').mockResolvedValue([
    { id: ANA_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator' },
  ])
  vi.spyOn(api.projects.definitionOfDone, 'list').mockResolvedValue([])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <CapabilitiesContext.Provider value={capabilitiesWith(modules)}>
          <ProjectConfigView project={project} projects={[AURORA, BOREAL]} canManage={canManage} />
        </CapabilitiesContext.Provider>
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, user: userEvent.setup() }
}

describe('Configurações do projeto consolidadas', () => {
  it('abre na aba Módulos por padrão e troca para Membros, Definição de pronto e Geral', async () => {
    const { api, user } = renderConfig()
    expect(await screen.findByRole('region', { name: 'Módulos' })).toBeTruthy()
    const tabs = screen.getByRole('navigation', { name: 'Seções de Configurações do projeto' })
    expect(within(tabs).getByRole('button', { name: 'Módulos' }).getAttribute('aria-current')).toBe(
      'page',
    )

    await user.click(within(tabs).getByRole('button', { name: panelCopy.members }))
    expect(await screen.findByText('Ana Souza', { selector: 'span' })).toBeTruthy()
    const addMember = vi.spyOn(api.projects, 'addMember').mockResolvedValue(undefined)
    await user.selectOptions(screen.getByLabelText(panelCopy.addMember), BRUNO_ID)
    await user.click(screen.getByRole('button', { name: panelCopy.addMember }))
    await waitFor(() =>
      expect(addMember).toHaveBeenCalledWith({ projectId: AURORA_ID, userId: BRUNO_ID }),
    )

    await user.click(within(tabs).getByRole('button', { name: panelCopy.definitionTitle }))
    expect(await screen.findByText(panelCopy.definitionEmpty)).toBeTruthy()

    await user.click(within(tabs).getByRole('button', { name: 'Geral' }))
    expect(screen.getByRole('button', { name: panelCopy.renameProjectAction })).toBeTruthy()
    expect(screen.getByRole('button', { name: panelCopy.archiveProjectAction })).toBeTruthy()
  })

  it('oculta a aba Definição de pronto quando o módulo está desligado', async () => {
    renderConfig({ modules: ['backlog'] })
    await screen.findByRole('region', { name: 'Módulos' })
    const tabs = screen.getByRole('navigation', { name: 'Seções de Configurações do projeto' })
    expect(within(tabs).queryByRole('button', { name: panelCopy.definitionTitle })).toBeNull()
  })

  it('colaborador sem permissão vê Membros e Geral em somente leitura', async () => {
    const { user } = renderConfig({ canManage: false })
    await screen.findByRole('region', { name: 'Módulos' })
    const tabs = screen.getByRole('navigation', { name: 'Seções de Configurações do projeto' })

    await user.click(within(tabs).getByRole('button', { name: panelCopy.members }))
    expect(await screen.findByText(/só o gestor e o criador/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: panelCopy.addMember })).toBeNull()
    expect(screen.queryByRole('button', { name: /Remover Ana Souza/ })).toBeNull()

    await user.click(within(tabs).getByRole('button', { name: 'Geral' }))
    expect(screen.queryByRole('button', { name: panelCopy.renameProjectAction })).toBeNull()
    expect(screen.queryByRole('button', { name: panelCopy.archiveProjectAction })).toBeNull()
  })

  it('renomeia e arquiva o projeto na aba Geral', async () => {
    const { api, user } = renderConfig()
    const rename = vi
      .spyOn(api.projects, 'rename')
      .mockResolvedValue({ ...AURORA, name: 'Aurora V2' })
    const archive = vi
      .spyOn(api.projects, 'archive')
      .mockResolvedValue({ ...AURORA, archivedAt: '2026-11-02T09:00:00.000Z' })

    await screen.findByRole('region', { name: 'Módulos' })
    await user.click(screen.getByRole('button', { name: 'Geral' }))

    await user.click(screen.getByRole('button', { name: panelCopy.renameProjectAction }))
    const input = screen.getByRole('textbox', { name: panelCopy.renameProjectName })
    await user.clear(input)
    await user.type(input, 'Projeto Boreal{Enter}')
    expect(screen.getByText(panelCopy.renameProjectDuplicate)).toBeTruthy()
    expect(rename).not.toHaveBeenCalled()

    await user.clear(input)
    await user.type(input, 'Aurora V2{Enter}')
    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith({ projectId: AURORA_ID, name: 'Aurora V2' }),
    )

    await user.click(screen.getByRole('button', { name: panelCopy.archiveProjectAction }))
    await user.click(screen.getByRole('button', { name: panelCopy.blockConfirm }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith({ projectId: AURORA_ID }))
  })
})
