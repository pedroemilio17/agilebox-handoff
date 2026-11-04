import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto, WipColumnDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { makeDetail, makeParticipation } from '../task-detail/fixtures'
import { BoardView } from './BoardView'

afterEach(cleanup)

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

function makeTask(id: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    number: Number(id.slice(-3)) || 1,
    key: `AB-${id.slice(-3)}`,
    projectId: PROJECT_ID,
    projectName: 'Projeto Aurora',
    title: `Tarefa ${id.slice(-3)}`,
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
    ...overrides,
  }
}

const ana = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B01', { status: 'in_progress' })
const bruno = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B02', { status: 'review', priority: 'high' })
const carla = makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B03', {
  status: 'todo',
  blockedReason: 'Aguardando GLPI',
  blockedAt: '2026-11-01T12:00:00.000Z',
})

const teamTasks = [ana, bruno, carla]

function renderTeam(props: Partial<ComponentProps<typeof BoardView>> = {}, api = createFakeApi()) {
  return render(
    <ApiProvider api={api}>
      <QueryProvider>
        <BoardView
          tasks={teamTasks}
          loading={false}
          error={false}
          onOpenTask={() => undefined}
          onMoveTask={() => undefined}
          readOnlyScope
          {...props}
        />
      </QueryProvider>
    </ApiProvider>,
  )
}

describe('visão Equipe no quadro', () => {
  it('não tem arrastar, seletor de estado nem "+" nas colunas', () => {
    renderTeam({ onCreateTask: () => undefined, onNewTask: () => undefined })
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /^Mover / })).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /^Nova tarefa em/ })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).toBeNull()
  })

  it('cada cartão é um botão com o nome completo: ID, título, estado, responsável e somente leitura', async () => {
    const api = createFakeApi()
    vi.spyOn(api.tasks, 'get').mockImplementation(({ taskId }) =>
      Promise.resolve(
        makeDetail({
          id: taskId,
          participations:
            taskId === ana.id ? [makeParticipation({ participantName: 'Ana Souza' })] : [],
          canEdit: false,
          readOnly: true,
        }),
      ),
    )
    renderTeam({}, api)
    expect(
      await screen.findByRole('button', {
        name: 'AB-B01 Tarefa B01, Desenvolvendo, Ana Souza, somente leitura',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'AB-B02 Tarefa B02, prioridade alta, Revisar, sem responsável, somente leitura',
      }),
    ).toBeTruthy()
  })

  it('abre o detalhe ao clicar no cartão', async () => {
    const onOpenTask = vi.fn()
    const user = userEvent.setup()
    renderTeam({ onOpenTask })
    await user.click(screen.getByRole('button', { name: /AB-B01 Tarefa B01/ }))
    expect(onOpenTask).toHaveBeenCalledWith(ana.id)
  })

  it('não mostra valores, comentários nem contagem de comentários nos cartões', () => {
    renderTeam({
      tasks: [{ ...ana, commentCount: 3, checklistProgress: { done: 1, total: 4, percent: 25 } }],
    })
    expect(screen.queryByRole('img', { name: /comentário/ })).toBeNull()
    expect(screen.queryByText('3')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/R\$/)
    expect(screen.getByText('1/4')).toBeTruthy()
  })

  it('mostra os sinais de alta prioridade, bloqueio e parada', () => {
    renderTeam({
      tasks: [bruno, carla, { ...ana, agingDays: 6 }],
    })
    expect(screen.getByText('Alta')).toBeTruthy()
    expect(screen.getByText('Bloqueada')).toBeTruthy()
    expect(screen.getByText('parada 6d')).toBeTruthy()
  })

  it('mostra o vazio da equipe sem botão de criação', () => {
    renderTeam({ tasks: [], onNewTask: () => undefined })
    expect(screen.getByText('Nenhuma tarefa da equipe nos seus projetos.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).toBeNull()
  })

  it('mostra erro curto com "Tentar de novo" que chama a recarga', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    renderTeam({ tasks: undefined, error: true, onRetry })
    expect(screen.getByRole('alert').textContent).toContain(
      'Não foi possível carregar a visão da equipe.',
    )
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('mostra o esqueleto enquanto carrega', () => {
    renderTeam({ tasks: undefined, loading: true })
    expect(screen.getByRole('status', { name: 'Carregando quadro' })).toBeTruthy()
  })

  it('o filtro Paradas e o medidor de WIP valem sobre as tarefas da equipe', async () => {
    const wipColumns: WipColumnDto[] = [
      { status: 'in_progress', count: 1, limit: 1, state: 'at_limit' },
      { status: 'review', count: 1, limit: null, state: 'none' },
    ]
    const user = userEvent.setup()
    renderTeam({
      tasks: [{ ...ana, agingDays: 5 }, bruno],
      wipColumns,
    })
    expect(screen.getByRole('img', { name: 'Desenvolvendo: 1 de 1, no limite' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Paradas · 1' }))
    expect(screen.getByRole('button', { name: /AB-B01 Tarefa B01/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /AB-B02 Tarefa B02/ })).toBeNull()
  })

  it('o editor de limite não aparece na Equipe, mesmo para quem pode editar', () => {
    renderTeam({
      canEditWipLimits: true,
      onSetWipLimit: () => undefined,
      wipColumns: [{ status: 'in_progress', count: 1, limit: 3, state: 'ok' }],
    })
    expect(screen.queryByRole('button', { name: /Definir limite/ })).toBeNull()
  })

  it('o título da coluna continua com a contagem da visão exibida', () => {
    renderTeam({ tasks: [ana] })
    const column = screen.getByRole('region', { name: 'Desenvolvendo, tarefas' })
    expect(within(column).getByLabelText('1 tarefas')).toBeTruthy()
  })
})
