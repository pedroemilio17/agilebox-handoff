import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type { TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { queryKeys } from '../../shared/query/keys'
import { createFakeApi } from '../../shared/testing/fake-api'
import { ArchivedTasksSection } from './ArchivedTasksSection'

const CREATED_AT = '2026-10-01T10:00:00.000Z'
const ALFA = { id: '01J8Y4G2XK8Z1S6M3Q9W0A5P01', name: 'Projeto Alfa' }
const BETA = { id: '01J8Y4G2XK8Z1S6M3Q9W0A5P02', name: 'Projeto Beta' }
const ALFA_BIS = { id: '01J8Y4G2XK8Z1S6M3Q9W0A5P03', name: 'Projeto Alfa' }

const TASK_A = task('01J8Y4G2XK8Z1S6M3Q9W0A5T01', 'Relatório mensal', ALFA)
const TASK_B = task('01J8Y4G2XK8Z1S6M3Q9W0A5T02', 'Ata da reunião', ALFA)
const TASK_C = task('01J8Y4G2XK8Z1S6M3Q9W0A5T03', 'Migrar dados', BETA)
const TASK_D = task('01J8Y4G2XK8Z1S6M3Q9W0A5T04', 'Revisão antiga', ALFA_BIS)

function task(id: string, title: string, project: { id: string; name: string }): TaskDto {
  return {
    id,
    projectId: project.id,
    projectName: project.name,
    title,
    description: '',
    status: 'done',
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    backlogRank: null,
    onBoard: true,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

interface Options {
  readonly archived?: readonly TaskDto[]
  readonly listError?: Error
  readonly unarchiveError?: ApiError
}

/**
 * Renderiza a seção com a API falsa. `listArchived` devolve as arquivadas que ainda restam, e
 * `unarchive` tira a tarefa dessa lista, como o servidor faria ao desarquivar.
 * `boardFetches` conta quantas vezes o quadro (`tasks.board`, sob `tasks.all`) foi buscado: serve
 * para provar que a invalidação atinge o prefixo inteiro.
 */
function renderSection({
  archived = [TASK_A, TASK_B, TASK_C],
  listError,
  unarchiveError,
}: Options = {}) {
  const api = createFakeApi()
  let remaining = [...archived]
  const list = vi.spyOn(api.tasks, 'listArchived').mockImplementation(() => {
    if (listError) return Promise.reject(listError)
    return Promise.resolve(remaining)
  })
  const unarchive = vi.spyOn(api.tasks, 'unarchive').mockImplementation(({ taskId }) => {
    if (unarchiveError) return Promise.reject(unarchiveError)
    const restored = remaining.find((item) => item.id === taskId)!
    remaining = remaining.filter((item) => item.id !== taskId)
    return Promise.resolve(restored)
  })
  const boardFetches: number[] = []
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <BoardProbe onFetch={() => boardFetches.push(boardFetches.length + 1)} />
        <ArchivedTasksSection />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, list, unarchive, boardFetches }
}

/** Consulta do quadro, montada ao lado da seção só para observar a invalidação de `tasks.all`. */
function BoardProbe({ onFetch }: { readonly onFetch: () => void }) {
  useQuery({
    queryKey: queryKeys.tasks.board(),
    queryFn: () => {
      onFetch()
      return Promise.resolve([])
    },
  })
  return null
}

describe('Ajustes: tarefas arquivadas', () => {
  it('mostra o título da seção', () => {
    renderSection()

    expect(screen.getByRole('heading', { name: 'Tarefas arquivadas' })).toBeTruthy()
  })

  it('a seção é uma região rotulada pelo próprio título, sem aria-label no div', () => {
    renderSection()

    const region = screen.getByRole('region', { name: 'Tarefas arquivadas' })
    expect(region.contains(screen.getByRole('heading', { name: 'Tarefas arquivadas' }))).toBe(true)
    expect(region.hasAttribute('aria-label')).toBe(false)
  })

  it('agrupa as tarefas pelo nome do projeto', async () => {
    renderSection()

    const alfa = await screen.findByRole('list', { name: 'Projeto Alfa' })
    expect(within(alfa).getByText('Relatório mensal')).toBeTruthy()
    expect(within(alfa).getByText('Ata da reunião')).toBeTruthy()
    const beta = screen.getByRole('list', { name: 'Projeto Beta' })
    expect(within(beta).getByText('Migrar dados')).toBeTruthy()
    expect(within(beta).queryByText('Relatório mensal')).toBeNull()
  })

  it('dois projetos com o mesmo nome têm listas com nomes acessíveis distintos', async () => {
    renderSection({ archived: [TASK_A, TASK_B, TASK_D] })

    const first = await screen.findByRole('list', { name: 'Projeto Alfa (1)' })
    const second = screen.getByRole('list', { name: 'Projeto Alfa (2)' })
    expect(within(first).getByText('Relatório mensal')).toBeTruthy()
    expect(within(second).getByText('Revisão antiga')).toBeTruthy()
    expect(within(second).queryByText('Relatório mensal')).toBeNull()
  })

  it('mostra o estado vazio em texto quando não há tarefas arquivadas', async () => {
    renderSection({ archived: [] })

    expect(await screen.findByText('Nenhuma tarefa arquivada.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('desarquiva pelo botão que cita a tarefa, invalida tasks.all e tira o item', async () => {
    const user = userEvent.setup()
    const { list, unarchive, boardFetches } = renderSection()
    const button = await screen.findByRole('button', { name: 'Desarquivar tarefa Ata da reunião' })
    await waitFor(() => expect(boardFetches.length).toBeGreaterThan(0))
    const boardBefore = boardFetches.length

    await user.click(button)

    expect(unarchive).toHaveBeenCalledWith({ taskId: TASK_B.id })
    await waitFor(() => expect(screen.queryByText('Ata da reunião')).toBeNull())
    // Depois de desarquivar, a lista de arquivadas é buscada de novo.
    expect(list.mock.calls.length).toBeGreaterThan(1)
    // O quadro está sob `tasks.all`, então a invalidação precisa refazer a busca dele também.
    await waitFor(() => expect(boardFetches.length).toBeGreaterThan(boardBefore))
    expect(screen.getByText('Relatório mensal')).toBeTruthy()
  })

  it('mostra o estado vazio quando a última tarefa arquivada é desarquivada', async () => {
    const user = userEvent.setup()
    renderSection({ archived: [TASK_C] })

    await user.click(await screen.findByRole('button', { name: 'Desarquivar tarefa Migrar dados' }))

    expect(await screen.findByText('Nenhuma tarefa arquivada.')).toBeTruthy()
  })

  it('mostra o erro do servidor em role=alert com o nome da tarefa e mantém a tarefa', async () => {
    const user = userEvent.setup()
    renderSection({
      unarchiveError: new ApiError('FORBIDDEN', 'Sem permissão para editar esta tarefa'),
    })

    await user.click(await screen.findByRole('button', { name: 'Desarquivar tarefa Migrar dados' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Migrar dados')
    expect(alert.textContent).toContain('Sem permissão para editar esta tarefa')
    expect(screen.getByText('Migrar dados')).toBeTruthy()
  })

  it('mostra erro genérico em role=alert quando a lista de arquivadas falha', async () => {
    renderSection({ listError: new Error('falha de rede') })

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Não foi possível carregar as tarefas arquivadas.')
  })

  it('quando a lista falha ao atualizar, mantém a lista antiga e mostra o alerta', async () => {
    const user = userEvent.setup()
    const { list } = renderSection()
    const button = await screen.findByRole('button', { name: 'Desarquivar tarefa Migrar dados' })
    list.mockImplementation(() => Promise.reject(new Error('falha de rede')))

    await user.click(button)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Não foi possível carregar as tarefas arquivadas.')
    expect(screen.getByText('Relatório mensal')).toBeTruthy()
    expect(screen.getByText('Migrar dados')).toBeTruthy()
  })

  it('durante o envio mostra o texto de carregamento e bloqueia o clique repetido', async () => {
    const user = userEvent.setup()
    const { unarchive } = renderSection()
    const button = await screen.findByRole('button', { name: 'Desarquivar tarefa Ata da reunião' })
    unarchive.mockImplementation(() => new Promise(() => undefined))

    await user.click(button)
    await user.click(button)

    expect(unarchive).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.textContent).toBe('Desarquivando…')
  })

  it('enquanto uma tarefa é desarquivada, as outras continuam acionáveis', async () => {
    const user = userEvent.setup()
    const { unarchive } = renderSection()
    const pending = await screen.findByRole('button', { name: 'Desarquivar tarefa Ata da reunião' })
    const other = screen.getByRole('button', { name: 'Desarquivar tarefa Migrar dados' })
    const defaultImpl = unarchive.getMockImplementation()!
    unarchive.mockImplementation((input) =>
      input.taskId === TASK_B.id ? new Promise(() => undefined) : defaultImpl(input),
    )

    await user.click(pending)
    expect(pending.getAttribute('aria-disabled')).toBe('true')
    expect(other.getAttribute('aria-disabled')).not.toBe('true')

    await user.click(other)

    expect(unarchive).toHaveBeenCalledWith({ taskId: TASK_C.id })
    await waitFor(() => expect(screen.queryByText('Migrar dados')).toBeNull())
  })

  it('dois desarquivamentos seguidos: A falha depois de B dar certo, o erro de A continua visível e A segue travada até responder', async () => {
    const user = userEvent.setup()
    const { unarchive } = renderSection()
    const buttonA = await screen.findByRole('button', {
      name: 'Desarquivar tarefa Relatório mensal',
    })
    const buttonB = screen.getByRole('button', { name: 'Desarquivar tarefa Ata da reunião' })
    const defaultImpl = unarchive.getMockImplementation()!
    let rejectA!: (error: Error) => void
    const pendingA = new Promise<TaskDto>((_, reject) => {
      rejectA = reject
    })
    unarchive.mockImplementation((input) =>
      input.taskId === TASK_A.id ? pendingA : defaultImpl(input),
    )

    await user.click(buttonA)
    await user.click(buttonA)
    await user.click(buttonB)
    await waitFor(() => expect(screen.queryByText('Ata da reunião')).toBeNull())

    // B terminou, mas A continua em andamento: não pode ser reabilitada nem disparada de novo.
    expect(buttonA.getAttribute('aria-disabled')).toBe('true')
    expect(unarchive.mock.calls.filter(([input]) => input.taskId === TASK_A.id)).toHaveLength(1)

    rejectA(new ApiError('FORBIDDEN', 'Sem permissão para editar esta tarefa'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Relatório mensal')
    expect(alert.textContent).toContain('Sem permissão para editar esta tarefa')
    expect(buttonA.getAttribute('aria-disabled')).not.toBe('true')
    expect(screen.getByText('Relatório mensal')).toBeTruthy()
  })

  describe('foco depois de desarquivar', () => {
    it('pelo teclado, o foco vai para o botão do item seguinte', async () => {
      const user = userEvent.setup()
      renderSection()
      const button = await screen.findByRole('button', {
        name: 'Desarquivar tarefa Ata da reunião',
      })

      button.focus()
      await user.keyboard('{Enter}')

      const next = screen.getByRole('button', { name: 'Desarquivar tarefa Migrar dados' })
      await waitFor(() => expect(document.activeElement).toBe(next))
    })

    it('sem item seguinte, o foco vai para o botão do item anterior', async () => {
      const user = userEvent.setup()
      renderSection()
      const previous = await screen.findByRole('button', {
        name: 'Desarquivar tarefa Ata da reunião',
      })
      const last = screen.getByRole('button', { name: 'Desarquivar tarefa Migrar dados' })

      last.focus()
      await user.keyboard('{Enter}')

      await waitFor(() => expect(document.activeElement).toBe(previous))
    })

    it('sem nenhum item restante, o foco vai para o título da seção', async () => {
      const user = userEvent.setup()
      renderSection({ archived: [TASK_C] })
      const button = await screen.findByRole('button', { name: 'Desarquivar tarefa Migrar dados' })

      button.focus()
      await user.keyboard('{Enter}')

      await screen.findByText('Nenhuma tarefa arquivada.')
      const heading = screen.getByRole('heading', { name: 'Tarefas arquivadas' })
      await waitFor(() => expect(document.activeElement).toBe(heading))
    })

    it('durante o envio o foco continua no botão da tarefa', async () => {
      const user = userEvent.setup()
      const { unarchive } = renderSection()
      const button = await screen.findByRole('button', {
        name: 'Desarquivar tarefa Ata da reunião',
      })
      unarchive.mockImplementation(() => new Promise(() => undefined))

      button.focus()
      await user.keyboard('{Enter}')

      expect(document.activeElement).toBe(button)
      expect(button.getAttribute('aria-disabled')).toBe('true')
    })

    it('quando o servidor recusa, o foco continua no botão da tarefa que falhou', async () => {
      const user = userEvent.setup()
      renderSection({
        unarchiveError: new ApiError('FORBIDDEN', 'Sem permissão para editar esta tarefa'),
      })
      const button = await screen.findByRole('button', { name: 'Desarquivar tarefa Migrar dados' })

      button.focus()
      await user.keyboard('{Enter}')

      await screen.findByRole('alert')
      expect(document.activeElement).toBe(button)
    })
  })
})
