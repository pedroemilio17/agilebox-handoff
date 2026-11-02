import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type { CurrentSessionDto, ProjectDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { ArchivedProjectsSection } from './ArchivedProjectsSection'

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const COLLABORATOR = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const OTHER = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'
const CREATED_AT = '2026-10-01T10:00:00.000Z'

const ACTIVE = project('01J8Y4G2XK8Z1S6M3Q9W0A5P01', 'Obra ativa', OTHER)
const ARCHIVED_BY_OTHER = project('01J8Y4G2XK8Z1S6M3Q9W0A5P02', 'Obra antiga', OTHER)
const ARCHIVED_BY_ME = project('01J8Y4G2XK8Z1S6M3Q9W0A5P03', 'Obra minha', COLLABORATOR)

function project(id: string, name: string, createdBy: string): ProjectDto {
  return { id, name, createdBy, createdAt: CREATED_AT }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

interface Options {
  readonly role?: CurrentSessionDto['role']
  readonly projects?: readonly ProjectDto[]
  readonly archivedIds?: readonly string[]
  readonly unarchiveError?: ApiError
  readonly listArchivedError?: Error
  readonly session?: 'loaded' | 'pending'
}

/**
 * Renderiza a seção com a API falsa. A lista ativa oculta os arquivados, como o caso de uso
 * `ListProjects` faz por padrão; `includeArchived` devolve tudo. `unarchiveProject` tira o
 * projeto da lista de arquivados, como o servidor faria.
 */
function renderSection({
  role = 'collaborator',
  projects = [ACTIVE, ARCHIVED_BY_OTHER, ARCHIVED_BY_ME],
  archivedIds = [ARCHIVED_BY_OTHER.id, ARCHIVED_BY_ME.id],
  unarchiveError,
  listArchivedError,
  session = 'loaded',
}: Options = {}) {
  const api = createFakeApi()
  const archived = new Set(archivedIds)
  const sessionCall: Promise<CurrentSessionDto> =
    session === 'loaded'
      ? Promise.resolve({
          userId: role === 'manager' ? MANAGER : COLLABORATOR,
          organizationId: ORG,
          role,
        })
      : new Promise<CurrentSessionDto>(() => undefined)
  vi.spyOn(api.session, 'getCurrent').mockReturnValue(sessionCall)
  const list = vi.spyOn(api.projects, 'list').mockImplementation((input) => {
    if (input?.includeArchived && listArchivedError) return Promise.reject(listArchivedError)
    const visible = projects.filter((item) => input?.includeArchived || !archived.has(item.id))
    return Promise.resolve(visible)
  })
  const unarchive = vi
    .spyOn(api.projects, 'unarchiveProject')
    .mockImplementation(({ projectId }) => {
      if (unarchiveError) return Promise.reject(unarchiveError)
      archived.delete(projectId)
      return Promise.resolve()
    })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <ArchivedProjectsSection />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, list, unarchive }
}

describe('Ajustes: projetos arquivados', () => {
  it('lista só os projetos arquivados, sem os ativos', async () => {
    renderSection()

    expect(await screen.findByText('Obra antiga')).toBeTruthy()
    expect(screen.getByText('Obra minha')).toBeTruthy()
    expect(screen.queryByText('Obra ativa')).toBeNull()
  })

  it('mostra o título da seção', () => {
    renderSection()

    expect(screen.getByRole('heading', { name: 'Projetos arquivados' })).toBeTruthy()
  })

  it('mostra o estado vazio em texto quando não há arquivados', async () => {
    renderSection({ projects: [ACTIVE], archivedIds: [] })

    expect(await screen.findByText('Nenhum projeto arquivado.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('desarquiva pelo botão que cita o projeto, invalida as listas e tira o item', async () => {
    const user = userEvent.setup()
    const { list, unarchive } = renderSection({ role: 'manager' })
    const button = await screen.findByRole('button', { name: 'Desarquivar projeto Obra antiga' })

    await user.click(button)

    expect(unarchive).toHaveBeenCalledWith({ projectId: ARCHIVED_BY_OTHER.id })
    await waitFor(() => expect(screen.queryByText('Obra antiga')).toBeNull())
    // Depois de desarquivar, a lista ativa e a de arquivados são buscadas de novo.
    expect(list.mock.calls.filter(([input]) => !input?.includeArchived).length).toBeGreaterThan(1)
    expect(list.mock.calls.filter(([input]) => input?.includeArchived).length).toBeGreaterThan(1)
    expect(screen.getByText('Obra minha')).toBeTruthy()
  })

  it('mostra o estado vazio quando o último arquivado é desarquivado', async () => {
    const user = userEvent.setup()
    renderSection({ role: 'manager', archivedIds: [ARCHIVED_BY_OTHER.id] })

    await user.click(await screen.findByRole('button', { name: 'Desarquivar projeto Obra antiga' }))

    expect(await screen.findByText('Nenhum projeto arquivado.')).toBeTruthy()
  })

  it('mostra o erro do servidor em role=alert quando recusa e mantém o item', async () => {
    const user = userEvent.setup()
    renderSection({
      role: 'manager',
      unarchiveError: new ApiError('FORBIDDEN', 'Só o criador ou o gestor pode desarquivar.'),
    })

    await user.click(await screen.findByRole('button', { name: 'Desarquivar projeto Obra antiga' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Só o criador ou o gestor pode desarquivar.')
    expect(screen.getByText('Obra antiga')).toBeTruthy()
  })

  it('mostra erro genérico em role=alert quando a lista de arquivados falha', async () => {
    renderSection({ listArchivedError: new Error('falha de rede') })

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Não foi possível carregar os projetos arquivados.')
  })

  it('não dispara o desarquivar de novo enquanto o pedido anterior está em andamento', async () => {
    const user = userEvent.setup()
    const { unarchive } = renderSection({ role: 'manager', archivedIds: [ARCHIVED_BY_OTHER.id] })
    const button = await screen.findByRole('button', { name: 'Desarquivar projeto Obra antiga' })
    unarchive.mockImplementation(() => new Promise<void>(() => undefined))

    await user.click(button)
    await user.click(button)

    expect(unarchive).toHaveBeenCalledTimes(1)
    expect(button.hasAttribute('disabled')).toBe(true)
  })
})

describe('Ajustes: quem vê o botão Desarquivar', () => {
  it('gestor vê o botão em todos os arquivados', async () => {
    renderSection({ role: 'manager' })

    expect(
      await screen.findByRole('button', { name: 'Desarquivar projeto Obra antiga' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Desarquivar projeto Obra minha' })).toBeTruthy()
  })

  it('colaborador vê o botão só no projeto que criou', async () => {
    renderSection({ role: 'collaborator' })

    await screen.findByText('Obra antiga')
    expect(screen.getByRole('button', { name: 'Desarquivar projeto Obra minha' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Desarquivar projeto Obra antiga' })).toBeNull()
  })

  it('não mostra botão enquanto a sessão não chegou', async () => {
    renderSection({ session: 'pending' })

    expect(await screen.findByText('Obra antiga')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a lista ativa do quadro não aparece aqui', async () => {
    renderSection({ role: 'manager' })

    const list = await screen.findByRole('list', { name: 'Projetos arquivados' })
    expect(within(list).queryByText('Obra ativa')).toBeNull()
  })
})
