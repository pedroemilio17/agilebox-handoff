import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ImpedimentListItemDto, type SessionUserDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { makeDetail, makeParticipation, OTHER_USER_ID, USER_ID } from '../task-detail/fixtures'
import { impedimentCopy } from './impediment-copy'
import { ImpedimentsView } from './ImpedimentsView'

const ME = USER_ID
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V09'
const ORG = '01J8Y4G2XK8Z1S6M3Q9W0ABCDG'
const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const NOW = Date.now()
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

function imp(overrides: Partial<ImpedimentListItemDto> = {}): ImpedimentListItemDto {
  return {
    id: '01J8Y4G2XK8Z1S6M3Q9W0B1001',
    taskId: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
    status: 'open',
    reason: 'Aguardando credenciais',
    ownerId: null,
    ownerName: null,
    openedBy: ME,
    openedAt: daysAgo(3),
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
    taskKey: 'AB-118',
    taskTitle: 'Revisar integração',
    projectId: PROJECT_ID,
    projectName: 'Projeto Aurora',
    ...overrides,
  }
}

const USERS: SessionUserDto[] = [
  { id: ME, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: 40 },
  { id: OTHER_USER_ID, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: 40 },
  { id: MANAGER, name: 'Lia Gestora', initials: 'LG', role: 'manager', defaultRate: 0 },
]

function setup({
  list = () => Promise.resolve([]),
  role = 'manager',
  onOpenTask = vi.fn(),
}: {
  list?: (
    input: Parameters<ReturnType<typeof createFakeApi>['impediments']['list']>[0],
  ) => Promise<ImpedimentListItemDto[]>
  role?: 'collaborator' | 'manager'
  onOpenTask?: (taskId: string) => void
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({ userId: ME, organizationId: ORG, role })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(USERS)
  vi.spyOn(api.projects, 'list').mockResolvedValue([
    {
      id: PROJECT_ID,
      name: 'Projeto Aurora',
      createdBy: MANAGER,
      createdAt: '2026-10-31T12:00:00.000Z',
      definitionOfDoneCount: 0,
      archivedAt: null,
    },
  ])
  vi.spyOn(api.tasks, 'get').mockResolvedValue(
    makeDetail({ participations: [makeParticipation()] }),
  )
  const listSpy = vi.spyOn(api.impediments, 'list').mockImplementation(list)
  const assign = vi.spyOn(api.impediments, 'assign').mockImplementation((input) =>
    Promise.resolve({
      ...imp(),
      id: input.impedimentId,
      ownerId: input.ownerId,
      ownerName: input.ownerId ? 'Ana Souza' : null,
    }),
  )
  const resolve = vi
    .spyOn(api.impediments, 'resolve')
    .mockImplementation((input) =>
      Promise.resolve({ ...imp(), id: input.impedimentId, status: 'resolved' }),
    )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <ImpedimentsView onOpenTask={onOpenTask} />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { api, list: listSpy, assign, resolve, onOpenTask, user: userEvent.setup() }
}

const rowOf = (title: string) => screen.getByText(title).closest('li') as HTMLElement

describe('Tela de Impedimentos · lista', () => {
  it('pede só os abertos por padrão e mostra do mais antigo para o mais novo', async () => {
    const newer = imp({
      id: '01J8Y4G2XK8Z1S6M3Q9W0B1002',
      taskKey: 'AB-200',
      taskTitle: 'Tarefa nova',
      openedAt: daysAgo(1),
    })
    const older = imp({
      id: '01J8Y4G2XK8Z1S6M3Q9W0B1003',
      taskKey: 'AB-100',
      taskTitle: 'Tarefa antiga',
      openedAt: daysAgo(9),
    })
    const { list } = setup({ list: () => Promise.resolve([newer, older]) })
    const rows = await screen.findAllByRole('listitem')
    expect(rows[0]!.textContent).toContain('Tarefa antiga')
    expect(rows[1]!.textContent).toContain('Tarefa nova')
    expect(list).toHaveBeenCalledWith({})
  })

  it('mostra número, título, motivo, projeto, responsável e tempo aberto', async () => {
    setup({
      list: () =>
        Promise.resolve([imp({ ownerId: USER_ID, ownerName: 'Ana Souza', openedAt: daysAgo(3) })]),
    })
    const row = await waitForRow('Revisar integração')
    expect(within(row).getByRole('button', { name: 'Abrir AB-118' })).toBeTruthy()
    expect(row.textContent).toContain('Aguardando credenciais')
    expect(row.textContent).toContain('Projeto Aurora')
    expect(row.textContent).toContain('Responsável: Ana Souza')
    expect(row.textContent).toContain('Aberto há 3 dias')
  })

  it('sem responsável mostra o texto próprio', async () => {
    setup({ list: () => Promise.resolve([imp()]) })
    const row = await waitForRow('Revisar integração')
    expect(row.textContent).toContain('Sem responsável')
  })

  it('"Mostrar resolvidos" pede os resolvidos e mostra a data e a nota', async () => {
    const resolvedItem = imp({
      status: 'resolved',
      resolvedAt: '2026-11-12T10:00:00.000Z',
      resolution: 'Acesso liberado',
      taskTitle: 'Tarefa resolvida',
    })
    const { list, user } = setup({
      list: (input) => Promise.resolve(input.includeResolved ? [resolvedItem] : []),
    })
    await screen.findByText(impedimentCopy.empty)
    await user.click(screen.getByRole('button', { name: 'Mostrar resolvidos' }))
    const row = await waitForRow('Tarefa resolvida')
    expect(list).toHaveBeenLastCalledWith({ includeResolved: true })
    expect(row.textContent).toContain('Resolvido em')
    expect(row.textContent).toContain('Nota: Acesso liberado')
    // Resolvido não oferece ações.
    expect(within(row).queryByRole('button', { name: 'Resolver' })).toBeNull()
    expect(within(row).queryByRole('button', { name: 'Atribuir' })).toBeNull()
  })

  it('filtra por projeto e por "Meus" (responsável é a pessoa logada)', async () => {
    const { list, user } = setup({ list: () => Promise.resolve([imp()]) })
    await waitForRow('Revisar integração')
    await user.selectOptions(screen.getByLabelText('Projeto'), PROJECT_ID)
    expect(list).toHaveBeenLastCalledWith({ projectId: PROJECT_ID })
    await user.click(screen.getByRole('button', { name: 'Meus' }))
    expect(list).toHaveBeenLastCalledWith({ projectId: PROJECT_ID, ownerId: ME })
    await user.click(screen.getByRole('button', { name: 'Todos' }))
    expect(list).toHaveBeenLastCalledWith({ projectId: PROJECT_ID })
  })

  it('estado vazio com a frase padrão', async () => {
    setup({ list: () => Promise.resolve([]) })
    expect(await screen.findByText('Nenhum impedimento aberto.')).toBeTruthy()
  })

  it('estado carregando enquanto a lista não chega', async () => {
    setup({ list: () => new Promise(() => undefined) })
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(impedimentCopy.loading)).toBeTruthy()
  })

  it('erro com nova tentativa', async () => {
    let calls = 0
    const { user } = setup({
      list: () => {
        calls += 1
        return calls === 1
          ? Promise.reject(new Error('falhou'))
          : Promise.resolve([imp({ taskTitle: 'Depois do erro' })])
      },
    })
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(impedimentCopy.error)).toBeTruthy()
    await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))
    await waitForRow('Depois do erro')
  })

  it('"AB-118" abre o detalhe da tarefa', async () => {
    const { onOpenTask, user } = setup({ list: () => Promise.resolve([imp()]) })
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Abrir AB-118' }))
    expect(onOpenTask).toHaveBeenCalledWith(imp().taskId)
  })
})

describe('Tela de Impedimentos · atribuir', () => {
  it('lista participantes e gestor, com "Sem responsável", e grava o escolhido', async () => {
    const { assign, user } = setup({ list: () => Promise.resolve([imp()]) })
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Atribuir' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.assignTitle })
    const select = within(dialog).getByLabelText(impedimentCopy.assignSelect)
    await waitFor(() => expect(within(select).getByText('Ana Souza')).toBeTruthy())
    const names = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(names).toEqual(['Sem responsável', 'Ana Souza', 'Lia Gestora'])
    await user.selectOptions(select, MANAGER)
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(assign).toHaveBeenCalledWith({ impedimentId: imp().id, ownerId: MANAGER })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText(impedimentCopy.assignDone)).toBeTruthy()
  })

  it('"Sem responsável" limpa o responsável (null)', async () => {
    const { assign, user } = setup({
      list: () => Promise.resolve([imp({ ownerId: USER_ID, ownerName: 'Ana Souza' })]),
    })
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Atribuir' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.assignTitle })
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: 'Ana Souza' })).toBeTruthy(),
    )
    await user.selectOptions(within(dialog).getByLabelText(impedimentCopy.assignSelect), '')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(assign).toHaveBeenCalledWith({ impedimentId: imp().id, ownerId: null })
  })

  it('mostra a recusa do servidor em português', async () => {
    const { assign, user } = setup({ list: () => Promise.resolve([imp()]) })
    assign.mockRejectedValue(
      new ApiError(
        'FORBIDDEN',
        'Responsável pelo impedimento deve participar da tarefa ou ser o gestor',
      ),
    )
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Atribuir' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.assignTitle })
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(
      await within(dialog).findByText(
        'Responsável pelo impedimento deve participar da tarefa ou ser o gestor',
      ),
    ).toBeTruthy()
  })
})

describe('Tela de Impedimentos · resolver', () => {
  it('resolve sem nota: manda null e a linha sai da lista', async () => {
    let open = [imp()]
    const { resolve, user } = setup({ list: () => Promise.resolve(open) })
    resolve.mockImplementation(() => {
      open = []
      return Promise.resolve({ ...imp(), status: 'resolved' })
    })
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Resolver' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.resolveTitle })
    await user.click(within(dialog).getByRole('button', { name: 'Resolver' }))
    expect(resolve).toHaveBeenCalledWith({ impedimentId: imp().id, resolution: null })
    await waitFor(() => expect(screen.queryByText('Revisar integração')).toBeNull())
  })

  it('resolve com nota e manda a nota sem as pontas', async () => {
    const { resolve, user } = setup({ list: () => Promise.resolve([imp()]) })
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Resolver' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.resolveTitle })
    await user.type(
      within(dialog).getByLabelText(impedimentCopy.resolutionLabel),
      '  Acesso liberado  ',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Resolver' }))
    expect(resolve).toHaveBeenCalledWith({ impedimentId: imp().id, resolution: 'Acesso liberado' })
  })

  it('valida a nota: 281 caracteres não grava', async () => {
    const { resolve, user } = setup({ list: () => Promise.resolve([imp()]) })
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Resolver' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.resolveTitle })
    const note = within(dialog).getByLabelText(impedimentCopy.resolutionLabel)
    await user.click(note)
    await user.paste('a'.repeat(281))
    expect(within(dialog).getByText('281/280')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Resolver' }))
    expect(within(dialog).getByRole('alert').textContent).toBe(impedimentCopy.resolutionTooLong)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('mostra o erro do servidor em português quando a recusa vem', async () => {
    const { resolve, user } = setup({ list: () => Promise.resolve([imp()]) })
    resolve.mockRejectedValue(new ApiError('CONFLICT', 'Impedimento já foi resolvido'))
    await waitForRow('Revisar integração')
    await user.click(screen.getByRole('button', { name: 'Resolver' }))
    const dialog = await screen.findByRole('dialog', { name: impedimentCopy.resolveTitle })
    await user.click(within(dialog).getByRole('button', { name: 'Resolver' }))
    expect(await within(dialog).findByText('Impedimento já foi resolvido')).toBeTruthy()
  })
})

async function waitForRow(title: string): Promise<HTMLElement> {
  await screen.findByText(title)
  return rowOf(title)
}
