import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type { ProjectDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { UndoProvider } from '../layout/UndoProvider'
import { panelCopy } from '../copy'
import { BacklogView } from './BacklogView'
import { backlogCopy } from './copy'

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const COLLABORATOR = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'
const ANA = '01J8Y4G2XK8Z1S6M3Q9W0A5V03'
const BRUNO = '01J8Y4G2XK8Z1S6M3Q9W0A5V04'
const P_A = '01J8Y4G2XK8Z1S6M3Q9W0P0001'
const P_B = '01J8Y4G2XK8Z1S6M3Q9W0P0002'
const T1 = '01J8Y4G2XK8Z1S6M3Q9W0T0001'
const T2 = '01J8Y4G2XK8Z1S6M3Q9W0T0002'
const T3 = '01J8Y4G2XK8Z1S6M3Q9W0T0003'
const NOW = '2026-11-01T12:00:00.000Z'

/** Preferência de movimento do sistema, simulada: o GlassToast e o menu leem `matchMedia`. */
function stubMotion(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

const PROJECTS: ProjectDto[] = [
  { id: P_A, name: 'Projeto A', createdBy: MANAGER, createdAt: NOW },
  { id: P_B, name: 'Projeto B', createdBy: MANAGER, createdAt: NOW },
]

function task(id: string, title: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    projectId: P_A,
    projectName: 'Projeto A',
    title,
    description: '',
    status: 'planning',
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    backlogRank: 1,
    onBoard: false,
    estimatedHours: null,
    estimatedCost: null,
    realizedCost: null,
    acceptance: { done: 0, total: 0 },
    ...overrides,
  }
}

/** Ordem inicial do backlog: T1 (A, 12 h, 1/3), T2 (B, sem estimativa, sem critérios), T3 (A, 2 h, 2/2). */
function initialBacklog(): TaskDto[] {
  return [
    task(T1, 'Integrar webhook', {
      projectId: P_A,
      backlogRank: 1,
      estimatedHours: 12,
      acceptance: { done: 1, total: 3 },
    }),
    task(T2, 'Avisar tarefa parada', {
      projectId: P_B,
      projectName: 'Projeto B',
      backlogRank: 2,
    }),
    task(T3, 'Exportar horas em CSV', {
      projectId: P_A,
      backlogRank: 3,
      estimatedHours: 2,
      acceptance: { done: 2, total: 2 },
    }),
  ]
}

/** Detalhe mínimo de `tasks.get`: responsável e participantes. */
function detailOf(item: TaskDto, participations: unknown[] = []) {
  return {
    ...item,
    participations,
    total: null,
    canEdit: false,
    readOnly: true,
  }
}

function responsible(userId: string, name: string) {
  return {
    id: `01J8Y4G2XK8Z1S6M3Q9W0PA${userId.slice(-4)}`,
    participant: { kind: 'user', userId },
    participantName: name,
    role: 'responsible',
    hours: 0,
    rate: null,
  }
}

function support(userId: string, name: string) {
  return { ...responsible(userId, name), role: 'support' }
}

interface Setup {
  readonly role?: 'manager' | 'collaborator'
  /** Estado do servidor. Cada chamada de reordenar atualiza a lista pelo `apply`. */
  readonly tasks?: TaskDto[]
  readonly participations?: Record<string, unknown[]>
  readonly reorder?: (input: { taskId: string; placement: unknown }) => Promise<void>
  readonly take?: (input: { taskId: string }) => Promise<TaskDto>
  readonly listError?: boolean
}

function renderBacklog(setup: Setup = {}) {
  let current = setup.tasks ?? initialBacklog()
  const participations = setup.participations ?? {
    [T1]: [responsible(ANA, 'Ana'), support(BRUNO, 'Bruno')],
    [T2]: [responsible(COLLABORATOR, 'Carla')],
    [T3]: [],
  }
  const role = setup.role ?? 'manager'
  const reorder = vi.fn(
    setup.reorder ??
      ((input: { taskId: string; placement: unknown }) => {
        // Fake do servidor: aplica a posição pedida e devolve a lista renumerada.
        const from = current.findIndex((item) => item.id === input.taskId)
        const moved = current[from]
        if (!moved) return Promise.reject(new ApiError('NOT_FOUND', 'Tarefa não encontrada'))
        const to =
          input.placement === 'top'
            ? 0
            : input.placement === 'end'
              ? current.length - 1
              : (input.placement as number)
        const next = [...current]
        next.splice(from, 1)
        next.splice(to, 0, moved)
        current = next.map((item, index) => ({ ...item, backlogRank: index + 1 }))
        return Promise.resolve()
      }),
  )
  const take = vi.fn(
    setup.take ??
      (({ taskId }: { taskId: string }) => {
        current = current.filter((item) => item.id !== taskId)
        return Promise.resolve(task(taskId, 'x', { onBoard: true, backlogRank: null }))
      }),
  )
  const create = vi.fn(() => Promise.resolve(task(T3, 'Revisar textos')))
  const api = createFakeApi({
    session: {
      getCurrent: () =>
        Promise.resolve({
          userId: role === 'manager' ? MANAGER : COLLABORATOR,
          organizationId: ORG,
          role,
        }),
    } as never,
    projects: { list: () => Promise.resolve(PROJECTS) } as never,
    backlog: {
      list: () =>
        setup.listError
          ? Promise.reject(new ApiError('CONFLICT', 'Falha de rede'))
          : Promise.resolve(current),
      reorder,
      takeToBoard: take,
      sendToBacklog: vi.fn(),
    },
    tasks: {
      get: vi.fn(({ taskId }: { taskId: string }) => {
        const item = [...current, ...initialBacklog()].find((entry) => entry.id === taskId)
        if (!item) return Promise.reject(new ApiError('NOT_FOUND', 'Tarefa não encontrada'))
        return Promise.resolve(detailOf(item, participations[taskId] ?? []))
      }),
      create,
    } as never,
  })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <UndoProvider>
          <BacklogView />
        </UndoProvider>
      </QueryProvider>
    </ApiProvider>,
  )
  return { reorder, take, create, api }
}

function row(title: string): HTMLElement {
  const found = screen.getByRole('listitem', { name: title })
  return found
}

function gripOf(title: string): HTMLElement {
  return within(row(title)).getByRole('button', { name: backlogCopy.reorderHandle(title) })
}

function titlesInOrder(): string[] {
  return within(screen.getByRole('list', { name: backlogCopy.listLabel }))
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('aria-label') ?? '')
}

beforeEach(() => {
  stubMotion(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('lista única do time', () => {
  it('mostra as tarefas na ordem do backlog, em role=list e role=listitem', async () => {
    renderBacklog()

    await screen.findByRole('listitem', { name: 'Exportar horas em CSV' })
    expect(titlesInOrder()).toEqual([
      'Integrar webhook',
      'Avisar tarefa parada',
      'Exportar horas em CSV',
    ])
  })

  it('a linha traz projeto, estimativa, critérios n/m e responsável', async () => {
    renderBacklog()

    const first = await screen.findByRole('listitem', { name: 'Integrar webhook' })
    expect(within(first).getByText('Projeto A')).toBeTruthy()
    expect(within(first).getByText('12 h')).toBeTruthy()
    expect(within(first).getByText('1/3')).toBeTruthy()
    expect(await within(first).findByRole('img', { name: 'Ana' })).toBeTruthy()
  })

  it('sem estimativa e sem critérios, mostra traço e a frase "sem critérios"', async () => {
    renderBacklog()

    const second = await screen.findByRole('listitem', { name: 'Avisar tarefa parada' })
    expect(within(second).getByText('—')).toBeTruthy()
    expect(within(second).getByText('sem critérios')).toBeTruthy()
  })

  it('chips por projeto filtram a lista e marcam o chip ativo', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    const chipA = screen.getByRole('button', { name: /Projeto A/ })
    await userEvent.click(chipA)

    expect(chipA.getAttribute('aria-pressed')).toBe('true')
    expect(titlesInOrder()).toEqual(['Integrar webhook', 'Exportar horas em CSV'])
  })

  it('estado vazio em uma frase quando não há tarefas', async () => {
    renderBacklog({ tasks: [] })

    expect(await screen.findByText(backlogCopy.emptyTitle)).toBeTruthy()
    expect(screen.getByText(backlogCopy.emptyDescription)).toBeTruthy()
  })

  it('erro de carregamento aparece em role=alert', async () => {
    renderBacklog({ listError: true })

    expect((await screen.findByRole('alert')).textContent).toContain(backlogCopy.loadError)
  })
})

describe('colaborador', () => {
  it('vê a lista sem alça: um cadeado no lugar, e nenhum menu "⋯"', async () => {
    renderBacklog({ role: 'collaborator' })

    await screen.findByRole('listitem', { name: 'Integrar webhook' })
    expect(
      screen.queryByRole('button', { name: backlogCopy.reorderHandle('Integrar webhook') }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: backlogCopy.moreActions('Integrar webhook') }),
    ).toBeNull()
    expect(screen.getAllByRole('img', { name: backlogCopy.lockedHandle })).toHaveLength(3)
  })

  it('Alt+↑/↓ não reordena para colaborador', async () => {
    const { reorder } = renderBacklog({ role: 'collaborator' })
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    fireEvent.keyDown(row('Exportar horas em CSV'), { key: 'ArrowUp', altKey: true })

    expect(reorder).not.toHaveBeenCalled()
  })

  it('continua podendo levar a própria tarefa ao quadro', async () => {
    const { take } = renderBacklog({ role: 'collaborator' })
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    await userEvent.click(
      within(row('Integrar webhook')).getByRole('button', {
        name: backlogCopy.takeToBoardFor('Integrar webhook'),
      }),
    )

    expect(take).toHaveBeenCalledWith({ taskId: T1 })
  })
})

describe('gestor reordena', () => {
  it('Alt+↓ com a linha em foco move a tarefa, anuncia a posição e mantém o foco nela', async () => {
    const { reorder } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    gripOf('Integrar webhook').focus()
    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })

    await waitFor(() => expect(reorder).toHaveBeenCalledWith({ taskId: T1, placement: 1 }))
    expect(
      await screen.findByText('Tarefa Integrar webhook movida para a posição 2 de 3'),
    ).toBeTruthy()
    await waitFor(() => expect(titlesInOrder()[1]).toBe('Integrar webhook'))
    expect(document.activeElement).toBe(gripOf('Integrar webhook'))
  })

  it('Alt+↑ na primeira posição não chama o servidor', async () => {
    const { reorder } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowUp', altKey: true })

    expect(reorder).not.toHaveBeenCalled()
    expect(await screen.findByText(backlogCopy.alreadyTop('Integrar webhook'))).toBeTruthy()
  })

  it('menu "⋯" oferece Mover para o topo e Mover para o fim', async () => {
    const { reorder } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Exportar horas em CSV' })

    await userEvent.click(
      within(row('Exportar horas em CSV')).getByRole('button', {
        name: backlogCopy.moreActions('Exportar horas em CSV'),
      }),
    )
    const menu = screen.getByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitem', { name: backlogCopy.moveTop }))

    expect(reorder).toHaveBeenCalledWith({ taskId: T3, placement: 'top' })
  })

  it('menu: no topo, "Mover para o topo" fica desabilitado', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    await userEvent.click(
      within(row('Integrar webhook')).getByRole('button', {
        name: backlogCopy.moreActions('Integrar webhook'),
      }),
    )

    expect(
      screen.getByRole('menuitem', { name: backlogCopy.moveTop }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('com filtro ativo, Alt+↓ troca com o vizinho do mesmo projeto', async () => {
    const { reorder } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    await userEvent.click(screen.getByRole('button', { name: /Projeto A/ }))
    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })

    // Filtrado: T1, T3. Descer T1 põe a tarefa na posição global de T3, que é 2 (índice).
    await waitFor(() => expect(reorder).toHaveBeenCalledWith({ taskId: T1, placement: 2 }))
  })

  it('aviso de escopo só com outros participantes; Desfazer existe sempre', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })
    expect(
      await screen.findByText('Vale para o time, e os 2 participantes veem a mudança.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /Desfazer/ })).toBeTruthy()
  })

  it('sem outros participantes, não há aviso de escopo, mas há Desfazer', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Exportar horas em CSV' })

    fireEvent.keyDown(gripOf('Exportar horas em CSV'), { key: 'ArrowUp', altKey: true })

    expect(await screen.findByText('Exportar horas em CSV subiu para a posição 2')).toBeTruthy()
    expect(screen.queryByText(/Vale para o time/)).toBeNull()
    expect(screen.getByRole('button', { name: /Desfazer/ })).toBeTruthy()
  })

  it('Desfazer devolve a tarefa à posição anterior', async () => {
    const { reorder } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })
    await userEvent.click(await screen.findByRole('button', { name: /Desfazer/ }))

    await waitFor(() => expect(reorder).toHaveBeenLastCalledWith({ taskId: T1, placement: 0 }))
  })

  it('erro do servidor aparece em role=alert com a razão', async () => {
    renderBacklog({
      reorder: () => Promise.reject(new ApiError('CONFLICT', 'Tarefa saiu do backlog')),
    })
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })

    expect((await screen.findByRole('alert')).textContent).toContain('Tarefa saiu do backlog')
  })
})

describe('Levar ao Quadro e Nova tarefa', () => {
  it('Levar ao Quadro chama o servidor e a tarefa sai da lista', async () => {
    const { take } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Avisar tarefa parada' })

    await userEvent.click(
      within(row('Avisar tarefa parada')).getByRole('button', {
        name: backlogCopy.takeToBoardFor('Avisar tarefa parada'),
      }),
    )

    expect(take).toHaveBeenCalledWith({ taskId: T2 })
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Avisar tarefa parada' })).toBeNull(),
    )
  })

  it('Nova tarefa cria no fim do backlog (inBacklog)', async () => {
    const { create } = renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    await userEvent.click(screen.getByRole('button', { name: backlogCopy.newTask }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: panelCopy.newTaskTitle }),
      'Revisar textos',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: panelCopy.createTask }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        projectId: P_A,
        title: 'Revisar textos',
        inBacklog: true,
      }),
    )
  })
})

describe('foco depois de Levar ao Quadro', () => {
  it('pelo teclado, a alça da linha seguinte recebe o foco', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Avisar tarefa parada' })

    const take = within(row('Avisar tarefa parada')).getByRole('button', {
      name: backlogCopy.takeToBoardFor('Avisar tarefa parada'),
    })
    take.focus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Avisar tarefa parada' })).toBeNull(),
    )
    await waitFor(() => expect(document.activeElement).toBe(gripOf('Exportar horas em CSV')))
  })

  it('sem linha seguinte, a alça da linha anterior recebe o foco', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Exportar horas em CSV' })

    const take = within(row('Exportar horas em CSV')).getByRole('button', {
      name: backlogCopy.takeToBoardFor('Exportar horas em CSV'),
    })
    take.focus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Exportar horas em CSV' })).toBeNull(),
    )
    await waitFor(() => expect(document.activeElement).toBe(gripOf('Avisar tarefa parada')))
  })

  it('sem nenhuma linha restante, o foco vai ao estado vazio (tabIndex -1)', async () => {
    renderBacklog({
      tasks: [task(T2, 'Avisar tarefa parada', { projectId: P_B, projectName: 'Projeto B' })],
    })
    await screen.findByRole('listitem', { name: 'Avisar tarefa parada' })

    const take = within(row('Avisar tarefa parada')).getByRole('button', {
      name: backlogCopy.takeToBoardFor('Avisar tarefa parada'),
    })
    take.focus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText(backlogCopy.emptyTitle)).toBeTruthy())
    await waitFor(() => {
      const active = document.activeElement
      expect(active?.getAttribute('tabindex')).toBe('-1')
      expect(active?.contains(screen.getByText(backlogCopy.emptyTitle))).toBe(true)
    })
  })

  it('colaborador não tem alça: o foco vai ao botão Levar ao Quadro da linha seguinte', async () => {
    renderBacklog({ role: 'collaborator' })
    await screen.findByRole('listitem', { name: 'Avisar tarefa parada' })

    const take = within(row('Avisar tarefa parada')).getByRole('button', {
      name: backlogCopy.takeToBoardFor('Avisar tarefa parada'),
    })
    take.focus()
    await userEvent.keyboard('{Enter}')

    const next = within(row('Exportar horas em CSV')).getByRole('button', {
      name: backlogCopy.takeToBoardFor('Exportar horas em CSV'),
    })
    await waitFor(() => expect(document.activeElement).toBe(next))
  })
})

describe('acessibilidade do arrastar (dnd-kit em pt-BR)', () => {
  it('a alça não traz texto em inglês e descreve o uso honesto (ponteiro, Alt+seta, menu)', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    const grip = gripOf('Integrar webhook')
    expect(grip.getAttribute('aria-roledescription')).toBe(backlogCopy.reorderRoleDescription)
    const describedBy = grip.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await waitFor(() =>
      expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
        backlogCopy.dragInstructions,
      ),
    )
    expect(backlogCopy.dragInstructions).toContain('ponteiro')
    expect(backlogCopy.dragInstructions).toContain('Alt')
    expect(backlogCopy.dragInstructions).toContain('menu')
    expect(document.body.textContent).not.toMatch(/space bar|Draggable|Picked up|sortable/i)
  })

  it('ao começar a arrastar com o ponteiro, anuncia em pt-BR', async () => {
    renderBacklog()
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    const grip = gripOf('Integrar webhook')
    fireEvent.pointerDown(grip, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(grip, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
    })

    expect(await screen.findByText(backlogCopy.dragStarted('Integrar webhook'))).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Picked up|Draggable item/)
  })
})

describe('movimento repetido', () => {
  it('Alt+↓ repetido enquanto o servidor não respondeu envia um só movimento', async () => {
    let release: () => void = () => undefined
    const { reorder } = renderBacklog({
      reorder: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    })
    await screen.findByRole('listitem', { name: 'Integrar webhook' })

    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })
    fireEvent.keyDown(gripOf('Integrar webhook'), { key: 'ArrowDown', altKey: true })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(reorder).toHaveBeenCalledTimes(1)
    release()
  })
})
