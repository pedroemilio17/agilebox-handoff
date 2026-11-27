import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDto, SessionUserDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../../shared/testing/fake-api'
import { KanAssistant } from './KanAssistant'

const project: ProjectDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
  name: 'Projeto Aurora',
  createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
  createdAt: '2026-10-31T12:00:00.000Z',
  definitionOfDoneCount: 0,
}

const userPedro: SessionUserDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
  name: 'Pedro Gomes',
  initials: 'PG',
  role: 'collaborator',
  defaultRate: null,
}

const taskSample: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCD',
  number: 5,
  key: 'AB-5',
  projectId: project.id,
  projectName: project.name,
  title: 'Revisar contrato com Cliente ACME',
  description: '',
  status: 'in_progress',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  commentCount: 0,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(cleanup)

describe('KanAssistant', () => {
  it('alterna abertura pelo FAB e pela tecla F1 e navega entre as 4 abas', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    const onOpenChange = vi.fn()

    const { rerender } = render(
      <ApiProvider api={api}>
        <QueryProvider>
          <KanAssistant
            open={false}
            onOpenChange={onOpenChange}
            currentView="projects"
            selectedProject={project}
            activeProjects={[project]}
            boardTasks={[taskSample]}
            users={[userPedro]}
            actor={{ userId: userPedro.id, name: userPedro.name, isManager: false }}
          />
        </QueryProvider>
      </ApiProvider>,
    )

    const fab = screen.getByRole('button', { name: /Kan · Abrir chat assistente/i })
    await user.click(fab)
    expect(onOpenChange).toHaveBeenCalledWith(true)

    fireEvent.keyDown(window, { key: 'F1' })
    expect(onOpenChange).toHaveBeenCalledTimes(2)

    rerender(
      <ApiProvider api={api}>
        <QueryProvider>
          <KanAssistant
            open
            onOpenChange={onOpenChange}
            currentView="projects"
            selectedProject={project}
            activeProjects={[project]}
            boardTasks={[taskSample]}
            users={[userPedro]}
            actor={{ userId: userPedro.id, name: userPedro.name, isManager: false }}
          />
        </QueryProvider>
      </ApiProvider>,
    )

    expect(screen.getByText('Kan · Assistente')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Esta tela' }))
    expect(screen.getByText(/Você está em: Quadro Kanban/i)).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Passos' }))
    expect(screen.getByText('Trilha para Colaborador')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Dúvidas' }))
    const search = screen.getByRole('searchbox', { name: /Buscar no dicionário/i })
    await user.type(search, 'WIP')
    expect(screen.getByText(/Limite simultâneo/i)).toBeTruthy()
  })

  it('cria tarefa real pela API no modo local e permite desfazer arquivando-a', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    const createdTask: TaskDto = {
      ...taskSample,
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5BCE',
      number: 6,
      key: 'AB-6',
      title: 'Validar webhook de pagamento',
      status: 'todo',
    }
    const createSpy = vi.spyOn(api.tasks, 'create').mockResolvedValue(createdTask)
    const archiveSpy = vi.spyOn(api.tasks, 'archive').mockResolvedValue(createdTask)
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([taskSample]))

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <KanAssistant
            open
            onOpenChange={() => undefined}
            currentView="projects"
            selectedProject={project}
            activeProjects={[project]}
            boardTasks={[taskSample]}
            users={[userPedro]}
            actor={{ userId: userPedro.id, name: userPedro.name, isManager: false }}
          />
        </QueryProvider>
      </ApiProvider>,
    )

    const input = screen.getByRole('textbox', { name: 'Mensagem para o Kan' })
    await user.type(input, 'Criar tarefa Validar webhook de pagamento em A fazer{enter}')

    expect((await screen.findAllByText('Tarefa AB-6 criada')).length).toBeGreaterThanOrEqual(1)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.id,
        title: 'Validar webhook de pagamento',
        status: 'todo',
      }),
    )

    const undoBtn = screen.getByRole('button', { name: 'Desfazer' })
    await user.click(undoBtn)
    expect(archiveSpy).toHaveBeenCalledWith({ taskId: createdTask.id })
    const undoneBtn = await screen.findByRole('button', { name: 'Desfeito' })
    expect(undoneBtn.hasAttribute('disabled')).toBe(true)
  })

  it('move tarefa real de estado via comando no chat', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([taskSample]))
    const moveSpy = vi.spyOn(api.tasks, 'move').mockResolvedValue({
      ...taskSample,
      status: 'review',
    })

    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <KanAssistant
            open
            onOpenChange={() => undefined}
            currentView="projects"
            selectedProject={project}
            activeProjects={[project]}
            boardTasks={[taskSample]}
            users={[userPedro]}
            actor={{ userId: userPedro.id, name: userPedro.name, isManager: false }}
          />
        </QueryProvider>
      </ApiProvider>,
    )

    const input = screen.getByRole('textbox', { name: 'Mensagem para o Kan' })
    await user.type(input, 'Mover AB-5 para Revisar{enter}')

    expect((await screen.findAllByText('AB-5 atualizada')).length).toBeGreaterThanOrEqual(1)
    expect(moveSpy).toHaveBeenCalledWith({ taskId: taskSample.id, status: 'review' })
  })
})
