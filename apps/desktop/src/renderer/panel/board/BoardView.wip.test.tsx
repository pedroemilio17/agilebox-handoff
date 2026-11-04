import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskDto, WipColumnDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { BoardView } from './BoardView'

afterEach(cleanup)

function makeTask(id: string, status: TaskDto['status']): TaskDto {
  return {
    id,
    number: Number(id.slice(-3)) || 1,
    key: `AB-${id.slice(-3)}`,
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    projectName: 'Projeto Aurora',
    title: `Tarefa ${id.slice(-3)}`,
    description: '',
    status,
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
}

const tasks = [
  makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B01', 'in_progress'),
  makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B02', 'in_progress'),
  makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B03', 'review'),
  makeTask('01J8Y4G2XK8Z1S6M3Q9W0A5B04', 'todo'),
]

const wipColumns: WipColumnDto[] = [
  { status: 'in_progress', count: 2, limit: 3, state: 'ok' },
  { status: 'review', count: 1, limit: null, state: 'none' },
]

function renderBoard(props: Partial<ComponentProps<typeof BoardView>> = {}) {
  const api = createFakeApi()
  return render(
    <ApiProvider api={api}>
      <QueryProvider>
        <BoardView
          tasks={tasks}
          loading={false}
          error={false}
          onOpenTask={() => undefined}
          onMoveTask={() => undefined}
          {...props}
        />
      </QueryProvider>
    </ApiProvider>,
  )
}

const column = (name: string) => screen.getByRole('region', { name: `${name}, tarefas` })

describe('Medidor de WIP no quadro', () => {
  it('mostra N/limite no estado dentro do limite', () => {
    renderBoard({ wipColumns: [wipColumns[0]!] })

    const meter = within(column('Desenvolvendo')).getByRole('img', {
      name: 'Desenvolvendo: 2 de 3, dentro do limite',
    })
    expect(meter.textContent).toContain('2/3')
    expect(within(column('Desenvolvendo')).getByText('Dentro do limite')).toBeTruthy()
  })

  it('mostra o estado no limite em âmbar com texto', () => {
    renderBoard({ wipColumns: [{ status: 'in_progress', count: 3, limit: 3, state: 'at_limit' }] })

    expect(
      within(column('Desenvolvendo')).getByRole('img', {
        name: 'Desenvolvendo: 3 de 3, no limite',
      }),
    ).toBeTruthy()
    expect(within(column('Desenvolvendo')).getByText('No limite')).toBeTruthy()
  })

  it('mostra o estado acima do limite com texto e ícone', () => {
    renderBoard({
      wipColumns: [{ status: 'review', count: 4, limit: 3, state: 'over' }],
    })

    expect(
      within(column('Revisar')).getByRole('img', { name: 'Revisar: 4 de 3, acima do limite' }),
    ).toBeTruthy()
    expect(within(column('Revisar')).getByText('Acima do limite')).toBeTruthy()
    expect(within(column('Revisar')).getByText('4/3')).toBeTruthy()
    expect(
      within(column('Revisar'))
        .getByRole('img', { name: 'Revisar: 4 de 3, acima do limite' })
        .querySelector('svg'),
    ).not.toBeNull()
  })

  it('sem limite definido, mostra só a contagem atual', () => {
    renderBoard({ wipColumns: [wipColumns[1]!] })

    expect(within(column('Revisar')).queryByRole('img', { name: /de /i })).toBeNull()
    expect(within(column('Revisar')).getByLabelText('1 tarefas')).toBeTruthy()
  })

  it('não mostra medidor nas colunas que não aceitam limite, mesmo que o servidor mande dados', () => {
    // Dados fora do contrato (colunas sem WIP) para provar que a tela ignora limites nelas.
    const outside = [
      { status: 'todo', count: 1, limit: 2, state: 'ok' },
      { status: 'done', count: 0, limit: 5, state: 'ok' },
    ] as unknown as WipColumnDto[]
    renderBoard({ wipColumns: outside })

    expect(screen.queryByRole('img', { name: /limite/i })).toBeNull()
    expect(within(column('A fazer')).getByLabelText('1 tarefas')).toBeTruthy()
  })

  it('colaborador vê a dica de escopo no medidor e não vê o botão de limite', () => {
    renderBoard({ wipColumns: [wipColumns[0]!], canEditWipLimits: false })

    const meter = within(column('Desenvolvendo')).getByRole('img', {
      name: 'Desenvolvendo: 2 de 3, dentro do limite',
    })
    expect(meter.getAttribute('title')).toBe('Conta só as tarefas que você vê.')
    expect(screen.queryByRole('button', { name: /Definir limite/ })).toBeNull()
  })

  it('gestor vê o botão de limite só nas duas colunas de WIP', () => {
    renderBoard({ wipColumns, canEditWipLimits: true, onSetWipLimit: vi.fn() })

    expect(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Definir limite de Revisar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Definir limite de A fazer/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Definir limite de Concluído/ })).toBeNull()
  })

  it('gestor salva o limite pela coluna e recebe o estado e o valor', async () => {
    const onSetWipLimit = vi.fn()
    renderBoard({ wipColumns, canEditWipLimits: true, onSetWipLimit })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Definir limite de Revisar' }))
    await user.type(screen.getByLabelText('Limite de tarefas'), '2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSetWipLimit).toHaveBeenCalledWith('review', 2)
  })
})
